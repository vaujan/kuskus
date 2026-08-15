import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'

import icon from '../../../resources/icon.png?asset'
import { WINDOW_CHANNELS, type AppZoomShortcut } from '../../shared/window-contract'
import { OPAQUE_WINDOW_BACKGROUND } from './window-material'
import { installDevToolsShortcut } from './devtools-shortcut'
import { installTextContextMenu } from './text-context-menu'

export function createMainWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const mainWindow = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 680,
    minHeight: 500,
    show: false,
    backgroundColor: OPAQUE_WINDOW_BACKGROUND,
    autoHideMenuBar: true,
    frame: isMac,
    ...(isMac ? { titleBarStyle: 'hiddenInset' as const } : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  const sendMaximizedState = (): void => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(WINDOW_CHANNELS.maximizedChanged, mainWindow.isMaximized())
    }
  }

  mainWindow.on('maximize', sendMaximizedState)
  mainWindow.on('unmaximize', sendMaximizedState)
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    sendMaximizedState()
  })

  installTextContextMenu(mainWindow)
  installDevToolsShortcut(mainWindow)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return

    let shortcut: AppZoomShortcut | null = null
    if (input.key === '+' || input.key === '=' || ['Equal', 'NumpadAdd'].includes(input.code)) {
      shortcut = 'in'
    } else if (
      input.key === '-' ||
      input.key === '_' ||
      ['Minus', 'NumpadSubtract'].includes(input.code)
    ) {
      shortcut = 'out'
    } else if (input.key === '0' || ['Digit0', 'Numpad0'].includes(input.code)) {
      shortcut = 'reset'
    }

    if (!shortcut) return
    event.preventDefault()
    mainWindow.webContents.send(WINDOW_CHANNELS.zoomShortcut, shortcut)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
