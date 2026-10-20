import {
  ipcMain,
  shell,
  type BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type WebContents
} from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { is } from '@electron-toolkit/utils'

const trustedContents = new WeakSet<WebContents>()

export function isTrustedRendererUrl(value: string): boolean {
  try {
    const actual = new URL(value)
    const expected = new URL(
      is.dev && process.env.ELECTRON_RENDERER_URL
        ? process.env.ELECTRON_RENDERER_URL
        : pathToFileURL(join(__dirname, '../renderer/index.html')).href
    )
    actual.search = expected.search = ''
    actual.hash = expected.hash = ''
    return actual.href === expected.href
  } catch {
    return false
  }
}

export function assertTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): void {
  if (
    !trustedContents.has(event.sender) ||
    event.sender.isDestroyed() ||
    !event.senderFrame ||
    event.senderFrame !== event.sender.mainFrame ||
    !isTrustedRendererUrl(event.senderFrame.url)
  ) {
    throw new Error('The request did not come from a trusted Kuskus window.')
  }
}

export async function openExternalWebUrl(value: string): Promise<void> {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error('Only web links can be opened.')
  }
  await shell.openExternal(url.href)
}

export function secureWindow(window: BrowserWindow): void {
  const contents = window.webContents
  trustedContents.add(contents)
  contents.on('will-navigate', (event) => event.preventDefault())
  contents.on('will-frame-navigate', (event) => event.preventDefault())
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.setWindowOpenHandler(({ url }) => {
    void openExternalWebUrl(url).catch(() => undefined)
    return { action: 'deny' }
  })
  contents.once('destroyed', () => trustedContents.delete(contents))
}

// Keep sender authentication at registration so every privileged handler is covered.
export const trustedIpcMain = {
  handle(channel: string, listener: Parameters<typeof ipcMain.handle>[1]): void {
    ipcMain.handle(channel, (event, ...args) => {
      assertTrustedSender(event)
      return listener(event, ...args)
    })
  },
  on(channel: string, listener: Parameters<typeof ipcMain.on>[1]): void {
    ipcMain.on(channel, (event, ...args) => {
      try {
        assertTrustedSender(event)
      } catch {
        return
      }
      listener(event, ...args)
    })
  }
}
