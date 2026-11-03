import type { KusuLibraryApi } from '../shared/library-contract'
import type { CaptureApi } from '../shared/capture-contract'
import type { UpdateApi } from '../shared/update-contract'
import type { ElectronWindowApi } from '../shared/window-contract'

declare global {
  interface Window {
    electron: {
      window: ElectronWindowApi
      updates: UpdateApi
    }
    kusu: KusuLibraryApi
    capture: CaptureApi
  }
}

export {}
