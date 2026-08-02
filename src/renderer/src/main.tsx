import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { QuickCaptureApp } from './features/capture/quick-capture-app'
import { initializeTranslucentBackground } from './hooks/use-translucent-background'

const savedTheme = localStorage.getItem('kuskus-theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const useDarkTheme =
  savedTheme === 'dark' || (savedTheme === 'system' && prefersDark) || !savedTheme

document.documentElement.classList.toggle('dark', useDarkTheme)
document.documentElement.style.colorScheme = useDarkTheme ? 'dark' : 'light'
const searchParams = new URLSearchParams(window.location.search)
const isQuickCapture = searchParams.get('surface') === 'quick-capture'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isQuickCapture ? <QuickCaptureApp /> : <App />}</StrictMode>
)
