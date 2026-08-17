import { app, type BrowserWindow } from 'electron'
import {
  flushPerformanceLog,
  performanceLoggingEnabled,
  writePerformanceEvent
} from './performance-log'
import type { LibraryService } from './library/library-service'

const typingEnabled = process.env.KUSKUS_PERFORMANCE_TYPING === '1'

const TYPING_INSTRUMENTATION = `
  (() => {
    const state = (window.__kuskusTyping = { keyLatencies: [], droppedFrames: 0, longTasks: [] });
    let lastFrame = performance.now();
    const frame = () => {
      const now = performance.now();
      if (now - lastFrame > 25) state.droppedFrames += 1;
      lastFrame = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    let pendingKeyAt = null;
    window.addEventListener('keydown', () => {
      if (pendingKeyAt !== null) return;
      pendingKeyAt = performance.now();
      requestAnimationFrame(() => {
        if (pendingKeyAt !== null) {
          state.keyLatencies.push(performance.now() - pendingKeyAt);
          pendingKeyAt = null;
        }
      });
    });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) state.longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
  })();
  window.__kuskusLongTasks = window.__kuskusTyping.longTasks;
`

const TYPING_RESET = `(() => { const s = window.__kuskusTyping; if (s) { s.keyLatencies = []; s.droppedFrames = 0; s.longTasks = []; } return !!s })()`

const TYPING_READ = `(() => { const s = window.__kuskusTyping; return s ? { keyLatencies: s.keyLatencies, droppedFrames: s.droppedFrames, longTasks: s.longTasks } : null })()`

const FOCUS_SEARCH = `(() => {
  const input = document.querySelector('input[type="search"]');
  if (!input) return false;
  input.focus();
  return true;
})()`

const CLEAR_SEARCH = `(() => {
  const input = document.querySelector('input[type="search"]');
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '');
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`

const OPEN_FIRST_NOTE = `(() => {
  const card = document.querySelector('[aria-label^="Open note "]');
  if (!card) return false;
  card.click();
  return true;
})()`

const FOCUS_EDITOR = `(() => {
  const editor =
    document.querySelector('[aria-label="Markdown editor"]') ??
    document.querySelector('[aria-label="Rich Markdown editor"]');
  if (!editor) return false;
  editor.focus();
  return true;
})()`

export function startPerformanceReporter(
  window: BrowserWindow,
  libraryService: LibraryService
): void {
  if (!app.isPackaged || !performanceLoggingEnabled()) return

  const wait = (milliseconds: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, milliseconds))

  const sendKey = (
    window: BrowserWindow,
    type: 'keyDown' | 'keyUp' | 'char',
    char: string
  ): void => {
    window.webContents.sendInputEvent({ type, keyCode: char })
  }

  const typeKey = async (char: string): Promise<void> => {
    sendKey(window, 'keyDown', char)
    sendKey(window, 'char', char)
    sendKey(window, 'keyUp', char)
  }

  const sampleMemory = async (checkpoint: string): Promise<void> => {
    const processes = app.getAppMetrics().map((metric) => ({
      type: metric.type,
      pid: metric.pid,
      workingSetKb: metric.memory.workingSetSize,
      peakWorkingSetKb: metric.memory.peakWorkingSetSize
    }))
    writePerformanceEvent(checkpoint, {
      processes,
      totalWorkingSetKb: processes.reduce((total, metric) => total + metric.workingSetKb, 0),
      main: await process.getProcessMemoryInfo()
    })
  }

  const runTypingScenario = async (): Promise<void> => {
    if (!typingEnabled) return
    try {
      await window.webContents.executeJavaScript(TYPING_INSTRUMENTATION)
    } catch {
      return
    }

    const summarize = (data: unknown): unknown =>
      data ? data : { keyLatencies: [], droppedFrames: 0, longTasks: [] }

    const scansBefore = libraryService.getPerformanceVaultScanCount()

    await window.webContents.executeJavaScript(TYPING_RESET)
    const searchFocused = await window.webContents.executeJavaScript(FOCUS_SEARCH)
    if (searchFocused) {
      for (const char of 'alpha') {
        await typeKey(char)
        await wait(25)
      }
      await wait(250)
      await window.webContents.executeJavaScript(CLEAR_SEARCH)
      await wait(250)
    }
    const search = summarize(await window.webContents.executeJavaScript(TYPING_READ))

    await window.webContents.executeJavaScript(TYPING_RESET)
    const noteOpened = await window.webContents.executeJavaScript(OPEN_FIRST_NOTE)
    if (noteOpened) {
      await wait(600)
      const editorFocused = await window.webContents.executeJavaScript(FOCUS_EDITOR)
      if (editorFocused) {
        await wait(50)
        for (let index = 0; index < 10; index += 1) {
          await typeKey(String(index % 10))
          await wait(25)
        }
      }
      await wait(1_500)
    }
    const note = summarize(await window.webContents.executeJavaScript(TYPING_READ))

    writePerformanceEvent('typing', {
      search,
      note,
      vaultScans: libraryService.getPerformanceVaultScanCount() - scansBefore
    })
  }

  window.webContents.once('did-finish-load', () => {
    void window.webContents.executeJavaScript(
      typingEnabled
        ? TYPING_INSTRUMENTATION
        : `
          window.__kuskusLongTasks = [];
          new PerformanceObserver((list) => {
            window.__kuskusLongTasks.push(...list.getEntries().map((entry) => entry.duration));
          }).observe({ type: 'longtask', buffered: true });
        `
    )

    const poll = setInterval(() => {
      if (window.isDestroyed()) return
      void window.webContents
        .executeJavaScript(
          `performance.getEntriesByName('kuskus:renderer-entry-to-first-card').at(-1)?.duration ?? null`
        )
        .then(async (duration: number | null) => {
          if (duration === null) return
          clearInterval(poll)
          writePerformanceEvent('first-card', { milliseconds: duration })
          await sampleMemory('first-card-memory')
          await runTypingScenario()
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
        writePerformanceEvent('renderer', renderer)
        await sampleMemory('settled-memory')
        await flushPerformanceLog()
        app.quit()
      })
      .catch(async (error: unknown) => {
        writePerformanceEvent('error', error instanceof Error ? error.message : String(error))
        await flushPerformanceLog()
        app.quit()
      })
  }, duration)
  finish.unref()
}
