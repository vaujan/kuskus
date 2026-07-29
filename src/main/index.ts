import { app, BrowserWindow, globalShortcut } from 'electron'
import { join, resolve } from 'node:path'
import { electronApp, optimizer } from '@electron-toolkit/utils'

import { registerLibraryIpc } from './ipc/library-handlers'
import { registerWindowIpc } from './ipc/window-handlers'
import { LibraryService } from './library/library-service'
import { createMainWindow } from './window/create-main-window'
import {
  GlobalCaptureShortcutController,
  revealWindow,
  type GlobalCaptureWindowTarget
} from './window/global-capture-shortcut'
import { WINDOW_CHANNELS } from '../shared/window-contract'

const demoUserDataPath = process.env.KUSKUS_DEMO_USER_DATA
if (demoUserDataPath && !app.isPackaged) {
  app.setPath('userData', resolve(demoUserDataPath))
}

let mainWindow: BrowserWindow | null = null
let globalCaptureShortcut: GlobalCaptureShortcutController | null = null
const globalCaptureWindowTargets = new WeakMap<BrowserWindow, GlobalCaptureWindowTarget>()

function ensureMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow
  mainWindow = createMainWindow()
  const createdWindow = mainWindow
  createdWindow.on('closed', () => {
    if (mainWindow === createdWindow) mainWindow = null
  })
  return createdWindow
}

function globalCaptureWindowTarget(): GlobalCaptureWindowTarget {
  const window = ensureMainWindow()
  const existingTarget = globalCaptureWindowTargets.get(window)
  if (existingTarget) return existingTarget
  const target: GlobalCaptureWindowTarget = {
    reveal: () => revealWindow(window),
    isRendererReady: () => !window.isDestroyed() && !window.webContents.isLoadingMainFrame(),
    sendCaptureRequest: () => {
      if (!window.isDestroyed()) {
        window.webContents.send(WINDOW_CHANNELS.globalCaptureRequested)
      }
    },
    onceRendererReady: (callback) => window.webContents.once('did-finish-load', callback)
  }
  globalCaptureWindowTargets.set(window, target)
  return target
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (app.isReady()) revealWindow(ensureMainWindow())
  })

  void app.whenReady().then(async () => {
    electronApp.setAppUserModelId('app.kuskus.desktop')

    const libraryService = new LibraryService(join(app.getPath('userData'), 'kuskus-settings.json'))
    await libraryService.initialize()
    globalCaptureShortcut = new GlobalCaptureShortcutController(
      globalShortcut,
      globalCaptureWindowTarget
    )
    registerWindowIpc(
      () =>
        globalCaptureShortcut?.getStatus() ?? {
          accelerator: 'Ctrl+Shift+Space',
          registered: false
        }
    )
    registerLibraryIpc(libraryService)

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    ensureMainWindow()
    globalCaptureShortcut.start()

    app.on('activate', () => {
      revealWindow(ensureMainWindow())
    })
  })
}

app.on('will-quit', () => globalCaptureShortcut?.stop())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
