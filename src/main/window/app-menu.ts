import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'

function editCommand(handler: (window: BrowserWindow) => void) {
  return (_item: Electron.MenuItem, window: Electron.BaseWindow | undefined): void => {
    if (window instanceof BrowserWindow) handler(window)
  }
}

export function installApplicationMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: editCommand((window) => window.webContents.undo())
        },
        {
          label: 'Redo',
          accelerator: 'Shift+CmdOrCtrl+Z',
          click: editCommand((window) => window.webContents.redo())
        },
        { type: 'separator' },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          click: editCommand((window) => window.webContents.cut())
        },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: editCommand((window) => window.webContents.copy())
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: editCommand((window) => window.webContents.paste())
        },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: editCommand((window) => window.webContents.selectAll())
        },
        { type: 'separator' },
        { role: 'delete' }
      ]
    },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    ...(isMac ? [] : [{ role: 'help' as const }])
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
