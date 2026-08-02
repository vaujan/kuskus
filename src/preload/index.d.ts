import type { KuskusLibraryApi } from '../shared/library-contract'
import type { CaptureApi } from '../shared/capture-contract'
import type { ElectronWindowApi } from '../shared/window-contract'

declare global {
  interface Window {
    electron: {
      window: ElectronWindowApi
    }
    kuskus: KuskusLibraryApi
    capture: CaptureApi
  }
}

export {}
