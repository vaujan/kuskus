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
  private accelerator = GLOBAL_CAPTURE_ACCELERATOR
  private label = GLOBAL_CAPTURE_SHORTCUT_LABEL

  constructor(
    private readonly registrar: CaptureShortcutRegistrar,
    private readonly getWindowTarget: () => GlobalCaptureWindowTarget,
    private readonly persistAccelerator?: (accelerator: string) => void
  ) {}

  start(initialAccelerator?: string): GlobalCaptureShortcutStatus {
    if (initialAccelerator) {
      this.accelerator = initialAccelerator
      this.label = initialAccelerator
    }
    if (!this.registered) {
      this.registered = this.registrar.register(this.accelerator, () => this.activate())
    }
    return this.getStatus()
  }

  stop(): void {
    if (!this.registered) return
    this.registrar.unregister(this.accelerator)
    this.registered = false
  }

  getStatus(): GlobalCaptureShortcutStatus {
    return {
      accelerator: this.label,
      registered: this.registered
    }
  }

  setAccelerator(accelerator: string): GlobalCaptureShortcutStatus {
    const previousAccelerator = this.accelerator
    const previousLabel = this.label
    const previousRegistered = this.registered

    if (previousRegistered) this.registrar.unregister(previousAccelerator)

    this.accelerator = accelerator
    this.label = accelerator
    this.registered = this.registrar.register(accelerator, () => this.activate())

    if (!this.registered && previousRegistered) {
      // The new accelerator collides with another app's shortcut — roll back so
      // the previous shortcut stays live instead of silently losing capture.
      this.registrar.register(previousAccelerator, () => this.activate())
      this.accelerator = previousAccelerator
      this.label = previousLabel
      this.registered = true
    }

    if (this.registered) this.persistAccelerator?.(this.accelerator)
    return this.getStatus()
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
