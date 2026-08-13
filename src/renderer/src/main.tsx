import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyTheme, resolveTheme } from './hooks/use-theme'
import { initializeTranslucentBackground } from './hooks/use-translucent-background'

performance.mark('kuskus:renderer-entry')

applyTheme(resolveTheme(localStorage.getItem('kuskus-theme')))
const searchParams = new URLSearchParams(window.location.search)
const surface = searchParams.get('surface')
const isQuickCapture = surface === 'quick-capture'
const isNoteWindow = surface === 'note-window'
if (isQuickCapture) {
  document.documentElement.dataset.surface = 'quick-capture'
  const acrylicCapable = searchParams.get('acrylic-capable') === 'true'
  const applyQuickCaptureMaterial = (reducedTransparency: boolean): void => {
    document.documentElement.dataset.quickCaptureMaterial =
      acrylicCapable && !reducedTransparency ? 'acrylic' : 'opaque'
  }
  document.documentElement.dataset.quickCaptureCorners =
    searchParams.get('corners') === 'native' ? 'native' : 'css'
  applyQuickCaptureMaterial(searchParams.get('reduced-transparency') === 'true')
  window.electron.window.onReducedTransparencyChange(applyQuickCaptureMaterial)
} else void initializeTranslucentBackground()

const root = createRoot(document.getElementById('root')!)
if (isQuickCapture) {
  void import('./features/capture/quick-capture-app').then(({ QuickCaptureApp }) => {
    performance.mark('kuskus:surface-module-loaded')
    root.render(
      <StrictMode>
        <QuickCaptureApp />
      </StrictMode>
    )
  })
} else if (isNoteWindow) {
  void import('./features/items/note-window-app').then(({ NoteWindowApp }) => {
    performance.mark('kuskus:surface-module-loaded')
    root.render(
      <StrictMode>
        <NoteWindowApp itemId={searchParams.get('itemId') ?? ''} />
      </StrictMode>
    )
  })
} else {
  void import('./App').then(({ default: App }) => {
    performance.mark('kuskus:surface-module-loaded')
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  })
}
