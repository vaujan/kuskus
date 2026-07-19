import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const savedTheme = localStorage.getItem('kuskus-theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const useDarkTheme =
  savedTheme === 'dark' || (savedTheme === 'system' && prefersDark) || !savedTheme

document.documentElement.classList.toggle('dark', useDarkTheme)
document.documentElement.style.colorScheme = useDarkTheme ? 'dark' : 'light'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
