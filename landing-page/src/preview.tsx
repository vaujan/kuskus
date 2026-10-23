import { createRoot } from 'react-dom/client'

import './preview.css'
import { SettingsProvider } from '../../src/renderer/src/settings/settings-context'
import Demo from './demo-app'

createRoot(document.getElementById('root')!).render(
  <SettingsProvider>
    <Demo />
  </SettingsProvider>
)
