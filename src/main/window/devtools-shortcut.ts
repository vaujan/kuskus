import type { BrowserWindow } from 'electron'

export function installDevToolsShortcut(window: BrowserWindow): void {
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key !== 'F12' && input.code !== 'F12') return
    event.preventDefault()
    if (window.webContents.isDevToolsOpened()) window.webContents.closeDevTools()
    else window.webContents.openDevTools({ mode: 'detach' })
  })
}
