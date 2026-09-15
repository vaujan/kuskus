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
import {
  resolveTranslucentBackgroundPreference,
  TRANSLUCENT_BACKGROUND_STORAGE_KEY
} from '../../shared/window-contract'

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
  const applyQuickCaptureMaterial = (): void => {
    const requested = resolveTranslucentBackgroundPreference(
      localStorage.getItem(TRANSLUCENT_BACKGROUND_STORAGE_KEY)
    )
    void window.electron.window.setTranslucentBackground(requested).then(
      (status) => {
        document.documentElement.dataset.quickCaptureMaterial = status.enabled
          ? 'acrylic'
          : 'opaque'
      },
      () => {
        document.documentElement.dataset.quickCaptureMaterial = 'opaque'
      }
    )
  }
  document.documentElement.dataset.quickCaptureCorners =
    searchParams.get('corners') === 'native' ? 'native' : 'css'
  applyQuickCaptureMaterial()
  window.electron.window.onReducedTransparencyChange(applyQuickCaptureMaterial)
  window.addEventListener('storage', (event) => {
    if (event.key === TRANSLUCENT_BACKGROUND_STORAGE_KEY) applyQuickCaptureMaterial()
  })
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
