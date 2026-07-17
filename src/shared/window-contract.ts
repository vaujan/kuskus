export const WINDOW_CHANNELS = {
  minimize: 'window:minimize',
  toggleMaximize: 'window:toggle-maximize',
  close: 'window:close',
  isMaximized: 'window:is-maximized',
  maximizedChanged: 'window:maximized-changed',
  setZoomFactor: 'window:set-zoom-factor',
  zoomShortcut: 'window:zoom-shortcut'
} as const

export const APP_ZOOM_FACTORS = [0.8, 0.9, 1, 1.1, 1.2, 1.25] as const
export type AppZoomShortcut = 'in' | 'out' | 'reset'

export type DesktopPlatform =
  | 'aix'
  | 'android'
  | 'darwin'
  | 'freebsd'
  | 'haiku'
  | 'linux'
  | 'openbsd'
  | 'sunos'
  | 'win32'
  | 'cygwin'
  | 'netbsd'

export interface ElectronWindowApi {
  platform: DesktopPlatform
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
  setZoomFactor: (zoomFactor: number) => Promise<number>
  onZoomShortcut: (callback: (shortcut: AppZoomShortcut) => void) => () => void
}
