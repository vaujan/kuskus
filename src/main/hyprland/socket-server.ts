import { createServer, type Server } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Socket } from 'node:net'

/**
 * A tiny Unix-domain socket server. Hyprland binds are told to write a line
 * into this socket (via `socat - UNIX-CONNECT:path`), which wakes the main
 * process and triggers the capture flow. The socket lives under the app's
 * userData directory so only the app's own user can reach it.
 */
export interface HyprlandSocketServer {
  start: () => Promise<string>
  stop: () => void
  onTrigger: (callback: () => void) => void
}

export function createHyprlandSocketServer(directory: string): HyprlandSocketServer {
  const socketPath = join(directory, 'kuskus-capture.sock')
  let server: Server | null = null
  const listeners = new Set<() => void>()

  function handleConnection(socket: Socket): void {
    socket.on('data', (chunk: Buffer) => {
      if (chunk.toString().trim()) {
        for (const callback of listeners) callback()
      }
    })
    socket.on('error', () => {})
  }

  return {
    start(): Promise<string> {
      return new Promise((resolve, reject) => {
        const next = createServer(handleConnection)
        server = next
        next.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            // A previous instance left a stale socket; remove and retry once.
            rmSync(socketPath, { force: true })
            next.listen(socketPath, () => resolve(socketPath))
            return
          }
          reject(error)
        })
        next.listen(socketPath, () => resolve(socketPath))
      })
    },

    stop(): void {
      server?.close()
      server = null
      rmSync(socketPath, { force: true })
    },

    onTrigger(callback: () => void): void {
      listeners.add(callback)
    }
  }
}

// Re-exported for tests to build a temp socket dir without coupling to userData.
export function createTempSocketDirectory(): string {
  return mkdtempSync(join(tmpdir(), 'kuskus-socket-'))
}
