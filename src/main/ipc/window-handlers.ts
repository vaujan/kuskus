import { BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'

import { WINDOW_CHANNELS } from '../../shared/window-contract'

function windowFromEvent(event: IpcMainEvent | IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

export function registerWindowIpc(): void {
  ipcMain.on(WINDOW_CHANNELS.minimize, (event) => windowFromEvent(event)?.minimize())
  ipcMain.on(WINDOW_CHANNELS.toggleMaximize, (event) => {
    const window = windowFromEvent(event)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  ipcMain.on(WINDOW_CHANNELS.close, (event) => windowFromEvent(event)?.close())
  ipcMain.handle(
    WINDOW_CHANNELS.isMaximized,
    (event) => windowFromEvent(event)?.isMaximized() ?? false
  )
}
