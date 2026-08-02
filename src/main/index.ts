import { app, BrowserWindow, globalShortcut, nativeTheme } from 'electron'
import { join, resolve } from 'node:path'
import { electronApp, optimizer } from '@electron-toolkit/utils'

import { registerLibraryIpc } from './ipc/library-handlers'
import { registerCaptureIpc } from './ipc/capture-handlers'
import { registerWindowIpc } from './ipc/window-handlers'
import { CaptureSessionService } from './capture/capture-session-service'
import { LibraryService } from './library/library-service'
import { createMainWindow } from './window/create-main-window'
import {
  GlobalCaptureShortcutController,
  revealWindow,
  type GlobalCaptureWindowTarget
} from './window/global-capture-shortcut'
import { WINDOW_CHANNELS } from '../shared/window-contract'
import { CAPTURE_CHANNELS } from '../shared/capture-contract'
import { QuickCaptureWindowController } from './window/quick-capture-window'

const demoUserDataPath = process.env.KUSKUS_DEMO_USER_DATA
if (demoUserDataPath && !app.isPackaged) {
  app.setPath('userData', resolve(demoUserDataPath))
}

let mainWindow: BrowserWindow | null = null
let globalCaptureShortcut: GlobalCaptureShortcutController | null = null
let quickCaptureWindow: QuickCaptureWindowController | null = null
let libraryService: LibraryService | null = null
const globalCaptureWindowTargets = new WeakMap<BrowserWindow, GlobalCaptureWindowTarget>()

function ensureMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow
  mainWindow = createMainWindow()
  const createdWindow = mainWindow
  createdWindow.on('closed', () => {
    if (mainWindow === createdWindow) {
      mainWindow = null
      quickCaptureWindow?.destroy()
    }
  })
  return createdWindow
}

function mainCaptureWindowTarget(): GlobalCaptureWindowTarget {
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

function globalCaptureWindowTarget(): GlobalCaptureWindowTarget {
  if (libraryService?.isReadyForCapture() && quickCaptureWindow) {
    return quickCaptureWindow.target()
  }
  return mainCaptureWindowTarget()
}

function openMainCapture(): void {
  quickCaptureWindow?.hide()
  const target = mainCaptureWindowTarget()
  target.reveal()
  if (target.isRendererReady()) target.sendCaptureRequest()
  else target.onceRendererReady(target.sendCaptureRequest)
}

function openCaptureRecovery(): void {
  quickCaptureWindow?.hide()
  const target = mainCaptureWindowTarget()
  const send = (): void => {
    const window = ensureMainWindow()
    if (!window.isDestroyed()) {
      window.webContents.send(CAPTURE_CHANNELS.recoveryRequested)
    }
  }
  target.reveal()
  if (target.isRendererReady()) send()
  else target.onceRendererReady(send)
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

    libraryService = new LibraryService(join(app.getPath('userData'), 'kuskus-settings.json'))
    await libraryService.initialize()
    const captureSessions = new CaptureSessionService(
      join(app.getPath('userData'), 'kuskus-capture-sessions.json')
    )
    await captureSessions.initialize()
    quickCaptureWindow = new QuickCaptureWindowController()
    let reducedTransparency = nativeTheme.prefersReducedTransparency
    nativeTheme.on('updated', () => {
      const nextReducedTransparency = nativeTheme.prefersReducedTransparency
      if (nextReducedTransparency === reducedTransparency) return
      reducedTransparency = nextReducedTransparency
      quickCaptureWindow?.setReducedTransparency(nextReducedTransparency)
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send(
            WINDOW_CHANNELS.reducedTransparencyChanged,
            nextReducedTransparency
          )
        }
      }
    })
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
    registerCaptureIpc(captureSessions, libraryService, {
      surfaceFor: (sender) => {
        if (quickCaptureWindow?.isSender(sender)) return 'quick'
        if (mainWindow?.webContents === sender) return 'main'
        return null
      },
      hideQuickCapture: () => quickCaptureWindow?.hide(),
      openMainCapture,
      openRecovery: openCaptureRecovery,
      setQuickCaptureHeight: (height) => quickCaptureWindow?.setHeight(height),
      setQuickCaptureBlurSuppressed: (suppressed) =>
        quickCaptureWindow?.setBlurSuppressed(suppressed)
    })

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
