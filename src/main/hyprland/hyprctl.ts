import { execFile } from 'node:child_process'

/**
 * Thin wrapper around the `hyprctl` binary. Hyprland ships `hyprctl` with the
 * compositor; on Wayland/Hyprland it talks to the compositor's socket directly
 * (no X server involved), so it works even when the app itself runs under
 * XWayland or native Wayland.
 */
export interface HyprctlClient {
  /** Issue a `hyprctl keyword` config change (e.g. adding a bind). */
  keyword: (name: string, value: string) => Promise<string>
  /** Issue a `hyprctl dispatch` (e.g. exec). */
  dispatch: (dispatcher: string, args: string) => Promise<string>
  /** Run a Lua snippet via `hyprctl eval`. */
  eval: (code: string) => Promise<string>
}

export function createHyprctlClient(binary = 'hyprctl'): HyprctlClient {
  function run(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(binary, args, { timeout: 10_000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`hyprctl ${args.join(' ')} failed: ${stderr?.trim() || error.message}`))
          return
        }
        resolve(stdout.trim())
      })
    })
  }

  return {
    keyword: (name, value) => run(['keyword', name, value]),
    dispatch: (dispatcher, args) => run(['dispatch', dispatcher, args]),
    eval: (code) => run(['eval', code])
  }
}
