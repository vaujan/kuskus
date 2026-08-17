import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { performance } from 'node:perf_hooks'
import { ipcMain, type IpcMain, type IpcMainInvokeEvent } from 'electron'

const outputPath = process.env.KUSKUS_PERFORMANCE_OUTPUT

export function performanceLoggingEnabled(): boolean {
  return outputPath !== undefined && outputPath !== ''
}

export function trackPerformanceIpcTimings(): void {
  if (process.env.KUSKUS_PERFORMANCE_TYPING !== '1' || !performanceLoggingEnabled()) return
  const originalHandle = ipcMain.handle.bind(ipcMain)
  ipcMain.handle = ((
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
  ) => {
    originalHandle(channel, (event, ...args) => {
      const startedAt = performance.now()
      const result = listener(event, ...args)
      void Promise.resolve(result).finally(() => {
        writePerformanceEvent('ipc-call', {
          channel,
          milliseconds: performance.now() - startedAt
        })
      })
      return result
    })
  }) as IpcMain['handle']
}

let writes = Promise.resolve()

export function writePerformanceEvent(event: string, data: unknown): void {
  if (!performanceLoggingEnabled()) return
  const target = outputPath as string
  writes = writes.then(async () => {
    await mkdir(dirname(target), { recursive: true })
    await appendFile(
      target,
      `${JSON.stringify({ run: process.env.KUSKUS_PERFORMANCE_RUN ?? 'run', event, at: Date.now(), data })}\n`
    )
  })
}

export function flushPerformanceLog(): Promise<void> {
  return writes
}
