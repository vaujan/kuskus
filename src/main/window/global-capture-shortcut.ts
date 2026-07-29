import type { GlobalCaptureShortcutStatus } from '../../shared/window-contract'

export const GLOBAL_CAPTURE_ACCELERATOR = 'Control+Shift+Space'
export const GLOBAL_CAPTURE_SHORTCUT_LABEL = 'Ctrl+Shift+Space'

export interface CaptureShortcutRegistrar {
  register: (accelerator: string, callback: () => void) => boolean
  unregister: (accelerator: string) => void
}

export interface GlobalCaptureWindowTarget {
  reveal: () => void
  isRendererReady: () => boolean
  sendCaptureRequest: () => void
  onceRendererReady: (callback: () => void) => void
}

export interface RevealableWindow {
  isDestroyed: () => boolean
  isMinimized: () => boolean
  isVisible: () => boolean
  restore: () => void
  show: () => void
  focus: () => void
}

export function revealWindow(window: RevealableWindow): void {
  if (window.isDestroyed()) return
  if (window.isMinimized()) window.restore()
  if (!window.isVisible()) window.show()
  window.focus()
}

export class GlobalCaptureShortcutController {
  private registered = false
  private readonly pendingTargets = new WeakSet<GlobalCaptureWindowTarget>()

  constructor(
    private readonly registrar: CaptureShortcutRegistrar,
    private readonly getWindowTarget: () => GlobalCaptureWindowTarget
  ) {}

  start(): GlobalCaptureShortcutStatus {
    if (!this.registered) {
      this.registered = this.registrar.register(GLOBAL_CAPTURE_ACCELERATOR, () => this.activate())
    }
    return this.getStatus()
  }

  stop(): void {
    if (!this.registered) return
    this.registrar.unregister(GLOBAL_CAPTURE_ACCELERATOR)
    this.registered = false
  }

  getStatus(): GlobalCaptureShortcutStatus {
    return {
      accelerator: GLOBAL_CAPTURE_SHORTCUT_LABEL,
      registered: this.registered
    }
  }

  private activate(): void {
    const target = this.getWindowTarget()
    target.reveal()
    if (target.isRendererReady()) {
      target.sendCaptureRequest()
      return
    }
    if (this.pendingTargets.has(target)) return

    this.pendingTargets.add(target)
    target.onceRendererReady(() => {
      this.pendingTargets.delete(target)
      target.sendCaptureRequest()
    })
  }
}
