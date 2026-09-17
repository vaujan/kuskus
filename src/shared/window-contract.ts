export const WINDOW_CHANNELS = {
  minimize: 'window:minimize',
  toggleMaximize: 'window:toggle-maximize',
  close: 'window:close',
  isMaximized: 'window:is-maximized',
  maximizedChanged: 'window:maximized-changed',
  setZoomFactor: 'window:set-zoom-factor',
  setNativeThemeSource: 'window:set-native-theme-source',
  setTranslucentBackground: 'window:set-translucent-background',
  reducedTransparencyChanged: 'window:reduced-transparency-changed',
  zoomShortcut: 'window:zoom-shortcut',
  edit: 'window:edit',
  getGlobalCaptureShortcutStatus: 'window:get-global-capture-shortcut-status',
  setGlobalCaptureShortcut: 'window:set-global-capture-shortcut',
  globalCaptureRequested: 'window:global-capture-requested',
  openSettingsWindow: 'window:open-settings-window',
  openNoteWindow: 'window:open-note-window',
  noteWindowCloseRequested: 'window:note-window-close-requested',
  resolveNoteWindowClose: 'window:resolve-note-window-close'
} as const

export const APP_ZOOM_FACTORS = [0.8, 0.9, 1, 1.1, 1.2, 1.25] as const
export type AppZoomShortcut = 'in' | 'out' | 'reset'
export type EditCommand = 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll'
export type NativeThemeSource = 'dark' | 'light' | 'system'
export const TRANSLUCENT_BACKGROUND_STORAGE_KEY = 'kuskus-translucent-background:v1'
export const LEGACY_TRANSLUCENT_BACKGROUND_STORAGE_KEY = 'kuskus-translucent-background'

export function resolveTranslucentBackgroundPreference(storedValue: string | null): boolean {
  return storedValue !== 'false'
}

export function parseNativeThemeSource(value: unknown): NativeThemeSource {
  if (value === 'dark' || value === 'light' || value === 'system') return value
  throw new Error('Unsupported native theme source.')
}

export interface GlobalCaptureShortcutStatus {
  accelerator: string
  registered: boolean
}

export interface TranslucentBackgroundStatus {
  supported: boolean
  enabled: boolean
  reducedTransparency: boolean
}

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
  setNativeThemeSource: (source: NativeThemeSource) => void
  setTranslucentBackground: (enabled: boolean) => Promise<TranslucentBackgroundStatus>
  onReducedTransparencyChange: (callback: (reduced: boolean) => void) => () => void
  onZoomShortcut: (callback: (shortcut: AppZoomShortcut) => void) => () => void
  edit: (command: EditCommand) => void
  getGlobalCaptureShortcutStatus: () => Promise<GlobalCaptureShortcutStatus>
  setGlobalCaptureShortcut: (accelerator: string) => Promise<GlobalCaptureShortcutStatus>
  onGlobalCaptureRequested: (callback: () => void) => () => void
  openSettingsWindow: () => Promise<void>
  openNoteWindow: (itemId: string) => Promise<void>
  onNoteWindowCloseRequested: (callback: () => void) => () => void
  resolveNoteWindowClose: (approved: boolean) => void
}
