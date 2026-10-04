import { createRoot } from 'react-dom/client'

import './preview.css'
import App from '../../src/renderer/src/App'
import { installHeroPreview } from '../../src/renderer/src/demo/app-preview-fixtures'
import {
  applyControlStyle,
  applyTheme,
  DEFAULT_TYPOGRAPHY
} from '../../src/renderer/src/hooks/theme'
import { SettingsProvider } from '../../src/renderer/src/settings/settings-context'

applyTheme('light', 'kuskus', DEFAULT_TYPOGRAPHY)
applyControlStyle('skeuomorphic')
localStorage.setItem('kuskus-color-mode', 'light')
installHeroPreview()

createRoot(document.getElementById('root')!).render(
  <SettingsProvider>
    <App />
  </SettingsProvider>
)
