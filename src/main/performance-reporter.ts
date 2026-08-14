import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { app, type BrowserWindow } from 'electron'

const outputPath = process.env.KUSKUS_PERFORMANCE_OUTPUT

export function startPerformanceReporter(window: BrowserWindow): void {
  if (!app.isPackaged || !outputPath) return

  let writes = Promise.resolve()
  const write = (event: string, data: unknown): void => {
    writes = writes.then(async () => {
      await mkdir(dirname(outputPath), { recursive: true })
      await appendFile(
        outputPath,
        `${JSON.stringify({ run: process.env.KUSKUS_PERFORMANCE_RUN ?? 'run', event, at: Date.now(), data })}\n`
      )
    })
  }
  const sampleMemory = async (checkpoint: string): Promise<void> => {
    const processes = app.getAppMetrics().map((metric) => ({
      type: metric.type,
      pid: metric.pid,
      workingSetKb: metric.memory.workingSetSize,
      peakWorkingSetKb: metric.memory.peakWorkingSetSize
    }))
    write(checkpoint, {
      processes,
      totalWorkingSetKb: processes.reduce((total, metric) => total + metric.workingSetKb, 0),
      main: await process.getProcessMemoryInfo()
    })
  }

  window.webContents.once('did-finish-load', () => {
    void window.webContents.executeJavaScript(`
      window.__kuskusLongTasks = [];
      new PerformanceObserver((list) => {
        window.__kuskusLongTasks.push(...list.getEntries().map((entry) => entry.duration));
      }).observe({ type: 'longtask', buffered: true });
    `)

    const poll = setInterval(() => {
      if (window.isDestroyed()) return
      void window.webContents
        .executeJavaScript(
          `performance.getEntriesByName('kuskus:renderer-entry-to-first-card').at(-1)?.duration ?? null`
        )
        .then((duration: number | null) => {
          if (duration === null) return
          clearInterval(poll)
          write('first-card', { milliseconds: duration })
          void sampleMemory('first-card-memory')
        })
    }, 100)
    poll.unref()
  })

  void sampleMemory('ready-memory')
  const duration = Math.max(1_000, Number(process.env.KUSKUS_PERFORMANCE_DURATION_MS) || 10_000)
  const finish = setTimeout(() => {
    if (window.isDestroyed()) return app.quit()
    void window.webContents
      .executeJavaScript(
        `({
        url: location.href,
        text: document.body.innerText.slice(0, 500),
        measures: performance.getEntriesByType('measure').map(({ name, duration }) => ({ name, duration })),
        longTasks: window.__kuskusLongTasks ?? []
      })`
      )
      .then(async (renderer: unknown) => {
        write('renderer', renderer)
        await sampleMemory('settled-memory')
        await writes
        app.quit()
      })
      .catch(async (error: unknown) => {
        write('error', error instanceof Error ? error.message : String(error))
        await writes
        app.quit()
      })
  }, duration)
  finish.unref()
}
