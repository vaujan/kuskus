import { BrowserWindow } from 'electron'

import { WINDOW_CHANNELS } from '../../shared/window-contract'

export function installMaximizedStateUpdates(window: BrowserWindow): void {
  const send = (): void => {
    if (!window.isDestroyed()) {
      window.webContents.send(WINDOW_CHANNELS.maximizedChanged, window.isMaximized())
    }
  }

  window.on('maximize', send)
  window.on('unmaximize', send)
  window.on('ready-to-show', send)
}
