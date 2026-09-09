import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  applyTheme,
  DEFAULT_TYPOGRAPHY,
  resolveAppliedTheme,
  resolveColorMode,
  resolveColorTheme,
  resolveFontPreference
} from './hooks/theme'
import { initializeTranslucentBackground } from './hooks/use-translucent-background'
import { SettingsProvider } from './settings/settings-context'

performance.mark('kuskus:renderer-entry')

const initialColorMode = resolveColorMode(localStorage.getItem('kuskus-color-mode'))
window.electron.window.setNativeThemeSource(initialColorMode)
applyTheme(
  resolveAppliedTheme(initialColorMode),
  resolveColorTheme(localStorage.getItem('kuskus-color-theme')),
  {
    uiFont: resolveFontPreference(
      localStorage.getItem('kuskus-ui-font'),
      DEFAULT_TYPOGRAPHY.uiFont
    ),
    uiFontFallback: resolveFontPreference(
      localStorage.getItem('kuskus-ui-font-fallback'),
      DEFAULT_TYPOGRAPHY.uiFontFallback,
      true
    ),
    codeFont: resolveFontPreference(
      localStorage.getItem('kuskus-code-font'),
      DEFAULT_TYPOGRAPHY.codeFont
    ),
    codeFontFallback: resolveFontPreference(
      localStorage.getItem('kuskus-code-font-fallback'),
      DEFAULT_TYPOGRAPHY.codeFontFallback,
      true
    )
  }
)
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
        <SettingsProvider>
          <QuickCaptureApp />
        </SettingsProvider>
      </StrictMode>
    )
  })
} else if (isNoteWindow) {
  void import('./features/items/note-window-app').then(({ NoteWindowApp }) => {
    performance.mark('kuskus:surface-module-loaded')
    root.render(
      <StrictMode>
        <SettingsProvider>
          <NoteWindowApp itemId={searchParams.get('itemId') ?? ''} />
        </SettingsProvider>
      </StrictMode>
    )
  })
} else {
  void import('./App').then(({ default: App }) => {
    performance.mark('kuskus:surface-module-loaded')
    root.render(
      <StrictMode>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </StrictMode>
    )
  })
}
