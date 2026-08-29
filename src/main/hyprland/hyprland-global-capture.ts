import { app } from 'electron'
import type { GlobalCaptureWindowTarget } from '../window/global-capture-shortcut'
import { createHyprlandSocketServer, type HyprlandSocketServer } from './socket-server'
import { createHyprctlClient, type HyprctlClient } from './hyprctl'
import type { GlobalCaptureShortcutStatus } from '../../shared/window-contract'

export const HYPRLAND_BIND_DESCRIPTION = 'kuskus-global-capture'

export const HYPRLAND_DEFAULT_ACCELERATOR = 'Control+Shift+Space'

/** Converts an Electron accelerator (Control+Shift+Space) to a Hyprland bind. */
export function toHyprlandAccelerator(accelerator: string): string {
  return accelerator
    .replace(/\bControl\b/g, 'CONTROL')
    .replace(/\bAlt\b/g, 'ALT')
    .replace(/\bShift\b/g, 'SHIFT')
    .replace(/\bMeta\b/g, 'SUPER')
    .replace(/\bCmdOrCtrl\b/g, 'CONTROL')
}

/** Converts a Hyprland bind back to the app's display form (Ctrl+Shift+Space). */
export function fromHyprlandAccelerator(accelerator: string): string {
  return accelerator
    .replace(/\bSUPER\b/g, 'Ctrl')
    .replace(/\bCONTROL\b/g, 'Ctrl')
    .replace(/\bSHIFT\b/g, 'Shift')
    .replace(/\bALT\b/g, 'Alt')
    // Hyprland keysyms are uppercase (SPACE); the app displays Space.
    .replace(/([A-Z]+)$/, (match) => match.charAt(0) + match.slice(1).toLowerCase())
}

/**
 * Global capture shortcut backend for Hyprland.
 *
 * Electron's `globalShortcut` cannot grab keys on Wayland compositors; Hyprland
 * exposes its own global keybinding system through `hyprctl eval`. This
 * controller:
 *
 *  - registers a Hyprland keybind via `hyprctl eval` using `hl.bind` with a Lua
 *    callback that runs `os.execute("printf x | nc -U <socket>")`,
 *  - listens for the bind's dispatch on a private Unix socket, and
 *  - routes the trigger into the same `GlobalCaptureWindowTarget` the X11 path
 *    uses, so the reveal/coalescing logic is shared.
 *
 * The Lua callback (rather than the string-based `o.bind`, which wraps to
 * `hl.dsp.exec_cmd`) is required because on this Hyprland build `exec_cmd`
 * returns "ok" but never actually runs the command; `os.execute` is the
 * verified-working path.
 *
 * Accelerators are exchanged in Electron form (Control+Shift+Space) and
 * converted internally to Hyprland form (SUPER+SHIFT+SPACE), matching how the
 * X11 backend and the settings store speak.
 */
export class HyprlandGlobalCaptureController {
  private readonly socketServer: HyprlandSocketServer
  private readonly hyprctl: HyprctlClient
  private socketPath: string | null = null
  private registered = false
  private bindInstalled = false
  private readonly pendingTargets = new WeakSet<GlobalCaptureWindowTarget>()
  private accelerator: string

  constructor(
    private readonly getWindowTarget: () => GlobalCaptureWindowTarget,
    options: {
      socketDirectory?: string
      hyprctl?: HyprctlClient
      socketServer?: HyprlandSocketServer
      accelerator?: string
      persistAccelerator?: (accelerator: string) => void
    } = {}
  ) {
    this.accelerator = toHyprlandAccelerator(options.accelerator ?? HYPRLAND_DEFAULT_ACCELERATOR)
    this.hyprctl = options.hyprctl ?? createHyprctlClient()
    this.socketServer =
      options.socketServer ??
      createHyprlandSocketServer(options.socketDirectory ?? app.getPath('userData'))
    this.persistAccelerator = options.persistAccelerator
  }

  private readonly persistAccelerator?: (accelerator: string) => void

  async start(): Promise<GlobalCaptureShortcutStatus> {
    try {
      if (!this.socketPath) {
        this.socketPath = await this.socketServer.start()
        this.socketServer.onTrigger(() => this.activate())
      }
      await this.installBind()
      this.registered = true
    } catch (error) {
      // Hyprland may be absent (X11 session, other compositor, or hyprctl not
      // on PATH). Leave `registered` false so the UI reports it accurately.
      console.warn('[kuskus] Hyprland global capture unavailable:', error)
      this.registered = false
    }
    return this.getStatus()
  }

  async stop(): Promise<void> {
    if (this.bindInstalled) {
      try {
        await this.hyprctl.eval(`hl.unbind(${this.quote(this.accelerator)})`)
      } catch {
        // Best effort.
      }
      this.bindInstalled = false
    }
    this.socketServer.stop()
    this.socketPath = null
    this.registered = false
  }

  getStatus(): GlobalCaptureShortcutStatus {
    return {
      accelerator: fromHyprlandAccelerator(this.accelerator),
      registered: this.registered
    }
  }

  async setAccelerator(accelerator: string): Promise<GlobalCaptureShortcutStatus> {
    this.accelerator = toHyprlandAccelerator(accelerator)
    try {
      if (!this.socketPath) {
        this.socketPath = await this.socketServer.start()
        this.socketServer.onTrigger(() => this.activate())
      }
      await this.installBind()
      this.registered = true
      this.persistAccelerator?.(accelerator)
    } catch (error) {
      console.warn('[kuskus] Hyprland global capture unavailable:', error)
      this.registered = false
    }
    return this.getStatus()
  }

  private async installBind(): Promise<void> {
    const socketPath = this.socketPath
    if (!socketPath) throw new Error('Socket is not listening.')

    if (this.bindInstalled) {
      await this.uninstallBind()
    }

    // `hl.bind` with a Lua function callback is the verified path: on this
    // Hyprland build `hl.dsp.exec_cmd` (used by string-based `o.bind`) returns
    // "ok" but never runs the command. The callback runs `os.execute`, which is
    // the verified-working way to run a command from the Lua callback. `nc -U`
    // writes a byte into our socket, which the socket server treats as a
    // trigger. The socket path comes from `app.getPath('userData')`, which does
    // not contain quotes or spaces on the platforms we target, so it can be
    // embedded in the command directly.
    const command = `printf x | nc -U ${socketPath}`
    const lua = [
      'hl.bind(',
      this.quote(this.accelerator),
      ', function() os.execute(',
      this.quote(command),
      ') end, { description = ',
      this.quote(HYPRLAND_BIND_DESCRIPTION),
      ' })'
    ].join('')

    await this.hyprctl.eval(lua)
    this.bindInstalled = true
  }

  private async uninstallBind(): Promise<void> {
    if (!this.bindInstalled) return
    try {
      await this.hyprctl.eval(`hl.unbind(${this.quote(this.accelerator)})`)
    } finally {
      this.bindInstalled = false
    }
  }

  private quote(value: string): string {
    // Lua single-quoted strings do not escape `\'`; use double quotes when the
    // value contains a single quote, escaping double quotes and backslashes.
    if (value.includes("'")) {
      return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    }
    return `'${value}'`
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
