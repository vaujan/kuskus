import type { KuskusLibraryApi } from '../shared/kuskus'

type DesktopPlatform =
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

interface ElectronWindowApi {
  platform: DesktopPlatform
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
}

declare global {
  interface Window {
    electron: {
      window: ElectronWindowApi
    }
    kuskus: KuskusLibraryApi
  }
}

export {}
