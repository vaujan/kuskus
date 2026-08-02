import { BrowserWindow, nativeTheme, screen, shell, type WebContents } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'

import { CAPTURE_CHANNELS } from '../../shared/capture-contract'
import { WINDOW_CHANNELS } from '../../shared/window-contract'
import type { GlobalCaptureWindowTarget } from './global-capture-shortcut'
import {
  calculateQuickCaptureBounds,
  QUICK_CAPTURE_INITIAL_HEIGHT,
  QUICK_CAPTURE_WIDTH
} from './quick-capture-bounds'
import {
  resolveQuickCapturePresentation,
  type QuickCaptureMaterial,
  type QuickCapturePresentation
} from './quick-capture-material'
import { OPAQUE_WINDOW_BACKGROUND } from './window-material'

export class QuickCaptureWindowController {
  private window: BrowserWindow | null = null
  private requestedHeight = QUICK_CAPTURE_INITIAL_HEIGHT
  private blurSuppressed = false
  private reducedTransparency = nativeTheme.prefersReducedTransparency
  private readonly captureTarget: GlobalCaptureWindowTarget

  constructor() {
    this.captureTarget = {
      reveal: () => this.reveal(),
      isRendererReady: () =>
        this.window !== null &&
        !this.window.isDestroyed() &&
        !this.window.webContents.isLoadingMainFrame(),
      sendCaptureRequest: () => this.sendActivation(),
      onceRendererReady: (callback) => {
        const window = this.ensureWindow()
        window.webContents.once('did-finish-load', () => {
          this.showAndFocus(window)
          callback()
        })
      }
    }

    screen.on('display-metrics-changed', () => {
      if (this.window?.isVisible()) this.position(this.window)
    })
    screen.on('display-removed', () => {
      if (this.window?.isVisible()) this.position(this.window)
    })
  }

  target(): GlobalCaptureWindowTarget {
    return this.captureTarget
  }

  isSender(sender: WebContents): boolean {
    return this.window?.webContents === sender
  }

  hide(): void {
    if (this.window && !this.window.isDestroyed()) this.window.hide()
  }

  setHeight(height: number): void {
    if (!Number.isFinite(height)) return
    this.requestedHeight = height
    if (this.window && !this.window.isDestroyed()) this.position(this.window)
  }

  setBlurSuppressed(suppressed: boolean): void {
    this.blurSuppressed = suppressed
  }

  setReducedTransparency(reduced: boolean): void {
    if (this.reducedTransparency === reduced) return
    this.reducedTransparency = reduced
    const presentation = this.resolvePresentation()
    if (this.window && !this.window.isDestroyed()) {
      this.applyMaterial(this.window, presentation.material)
    }
  }

  destroy(): void {
    const window = this.window
    this.window = null
    if (window && !window.isDestroyed()) window.destroy()
  }

  private reveal(): void {
    const window = this.ensureWindow()
    this.position(window)
    if (!window.webContents.isLoadingMainFrame()) this.showAndFocus(window)
  }

  private showAndFocus(window: BrowserWindow): void {
    if (window.isDestroyed()) return
    this.position(window)
    window.show()
    window.focus()
  }

  private sendActivation(): void {
    const window = this.window
    if (!window || window.isDestroyed()) return
    window.webContents.send(CAPTURE_CHANNELS.quickCaptureActivated)
  }

  private position(window: BrowserWindow): void {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    window.setBounds(calculateQuickCaptureBounds(display.workArea, this.requestedHeight), false)
  }

  private resolvePresentation(): QuickCapturePresentation {
    return resolveQuickCapturePresentation(
      process.platform,
      process.getSystemVersion(),
      this.reducedTransparency
    )
  }

  private applyMaterial(window: BrowserWindow, material: QuickCaptureMaterial): void {
    if (process.platform !== 'win32') return
    if (material === 'acrylic') {
      window.setBackgroundColor('#00000000')
      window.setBackgroundMaterial('acrylic')
    } else {
      window.setBackgroundMaterial('none')
      window.setBackgroundColor(OPAQUE_WINDOW_BACKGROUND)
    }
  }

  private ensureWindow(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) return this.window
    const presentation = this.resolvePresentation()
    const usesNativeCorners = presentation.corners === 'native'
    const window = new BrowserWindow({
      width: QUICK_CAPTURE_WIDTH,
      height: QUICK_CAPTURE_INITIAL_HEIGHT,
      show: false,
      frame: false,
      transparent: !usesNativeCorners,
      backgroundColor:
        presentation.material === 'acrylic' || !usesNativeCorners
          ? '#00000000'
          : OPAQUE_WINDOW_BACKGROUND,
      ...(presentation.material === 'acrylic' ? { backgroundMaterial: 'acrylic' as const } : {}),
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      ...(process.platform === 'win32' ? { thickFrame: usesNativeCorners } : {}),
      roundedCorners: true,
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    this.window = window
    this.position(window)

    window.on('blur', () => {
      if (!this.blurSuppressed) window.hide()
    })
    window.on('closed', () => {
      if (this.window === window) this.window = null
    })
    window.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url)
      return { action: 'deny' }
    })
    window.webContents.on('did-finish-load', () => {
      window.webContents.send(WINDOW_CHANNELS.reducedTransparencyChanged, this.reducedTransparency)
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const url = new URL(process.env['ELECTRON_RENDERER_URL'])
      url.searchParams.set('surface', 'quick-capture')
      url.searchParams.set('material', presentation.material)
      url.searchParams.set('corners', presentation.corners)
      url.searchParams.set('acrylic-capable', String(presentation.acrylicCapable))
      url.searchParams.set('reduced-transparency', String(this.reducedTransparency))
      void window.loadURL(url.toString())
    } else {
      void window.loadFile(join(__dirname, '../renderer/index.html'), {
        query: {
          surface: 'quick-capture',
          material: presentation.material,
          corners: presentation.corners,
          'acrylic-capable': String(presentation.acrylicCapable),
          'reduced-transparency': String(this.reducedTransparency)
        }
      })
    }
    return window
  }
}
