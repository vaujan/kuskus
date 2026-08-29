import { app, BrowserWindow, globalShortcut, nativeTheme } from 'electron'
import { join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
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
import { installApplicationMenu } from './window/app-menu'
import { WINDOW_CHANNELS, type GlobalCaptureShortcutStatus } from '../shared/window-contract'
import { CAPTURE_CHANNELS } from '../shared/capture-contract'
import { QuickCaptureWindowController } from './window/quick-capture-window'
import { CaptureShortcutStore } from './window/capture-shortcut-store'
import { NoteWindowController } from './window/note-window'
import { startPerformanceReporter } from './performance-reporter'
import { trackPerformanceIpcTimings } from './performance-log'
import { HyprlandGlobalCaptureController } from './hyprland/hyprland-global-capture'

type CaptureShortcutBackend = {
  start: (accelerator?: string) => GlobalCaptureShortcutStatus | Promise<GlobalCaptureShortcutStatus>
  getStatus: () => GlobalCaptureShortcutStatus
  setAccelerator: (
    accelerator: string
  ) => GlobalCaptureShortcutStatus | Promise<GlobalCaptureShortcutStatus>
  stop: () => void | Promise<void>
}

function isHyprlandSession(): boolean {
  return (
    process.env.XDG_CURRENT_DESKTOP?.toLowerCase().includes('hyprland') ?? false
  )
}


const demoUserDataPath = process.env.KUSKUS_DEMO_USER_DATA
const performanceUserDataPath = process.env.KUSKUS_PERFORMANCE_USER_DATA
performance.mark('kuskus:main-entry')
if (performanceUserDataPath && process.env.KUSKUS_PERFORMANCE_OUTPUT) {
  app.setPath('userData', resolve(performanceUserDataPath))
} else if (demoUserDataPath && !app.isPackaged) {
  app.setPath('userData', resolve(demoUserDataPath))
}

let mainWindow: BrowserWindow | null = null
let captureShortcutBackend: CaptureShortcutBackend | null = null
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

function openMainItem(itemId: string): void {
  quickCaptureWindow?.hide()
  const target = mainCaptureWindowTarget()
  const send = (): void => {
    const window = ensureMainWindow()
    if (!window.isDestroyed()) {
      window.webContents.send(CAPTURE_CHANNELS.mainItemRequested, itemId)
    }
  }
  target.reveal()
  if (target.isRendererReady()) send()
  else target.onceRendererReady(send)
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
    installApplicationMenu()

    libraryService = new LibraryService(join(app.getPath('userData'), 'kuskus-settings.json'))
    await libraryService.initialize()
    performance.mark('kuskus:library-service-initialized')
    performance.measure(
      'kuskus:main-entry-to-library-service',
      'kuskus:main-entry',
      'kuskus:library-service-initialized'
    )
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
    const persistedAccelerator = await new CaptureShortcutStore(
      join(app.getPath('userData'), 'capture-shortcut.json')
    ).load()
    const persistAccelerator = (accelerator: string): void => {
      const store = new CaptureShortcutStore(
        join(app.getPath('userData'), 'capture-shortcut.json')
      )
      void store.save(accelerator)
    }
    if (isHyprlandSession()) {
      captureShortcutBackend = new HyprlandGlobalCaptureController(globalCaptureWindowTarget, {
        socketDirectory: app.getPath('userData'),
        accelerator: persistedAccelerator ?? undefined,
        persistAccelerator
      })
    } else {
      captureShortcutBackend = new GlobalCaptureShortcutController(
        globalShortcut,
        globalCaptureWindowTarget,
        persistAccelerator
      )
    }

    const noteWindows = new NoteWindowController(libraryService)
    const backend = captureShortcutBackend
    registerWindowIpc(
      () => backend.getStatus(),
      (accelerator) => backend.setAccelerator(accelerator),
      (itemId) => noteWindows.open(itemId),
      (sender, approved) => noteWindows.resolveClose(sender, approved)
    )
    trackPerformanceIpcTimings()
    registerLibraryIpc(libraryService, () => noteWindows.closeAll())
    registerCaptureIpc(captureSessions, libraryService, {
      surfaceFor: (sender) => {
        if (quickCaptureWindow?.isSender(sender)) return 'quick'
        if (mainWindow?.webContents === sender) return 'main'
        return null
      },
      hideQuickCapture: () => quickCaptureWindow?.hide(),
      openMainCapture,
      openMainItem,
      openRecovery: openCaptureRecovery,
      setQuickCaptureHeight: (height) => quickCaptureWindow?.setHeight(height),
      setQuickCaptureBlurSuppressed: (suppressed) =>
        quickCaptureWindow?.setBlurSuppressed(suppressed)
    })

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    const window = ensureMainWindow()
    startPerformanceReporter(window, libraryService)
    await captureShortcutBackend.start()

    app.on('activate', () => {
      revealWindow(ensureMainWindow())
    })
  })
}

app.on('will-quit', () => {
  void captureShortcutBackend?.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
