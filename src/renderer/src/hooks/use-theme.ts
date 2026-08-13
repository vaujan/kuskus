import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light' | 'solarized-dark' | 'solarized-light'

export function resolveTheme(value: string | null): Theme {
  return value === 'light' || value === 'solarized-dark' || value === 'solarized-light'
    ? value
    : 'dark'
}

export function applyTheme(
  theme: Theme,
  root: Pick<HTMLElement, 'classList' | 'style'> = document.documentElement
): void {
  const mode = theme.endsWith('dark') ? 'dark' : 'light'
  root.classList.toggle('dark', mode === 'dark')
  root.classList.toggle('solarized', theme.startsWith('solarized'))
  root.style.colorScheme = mode
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    resolveTheme(localStorage.getItem('kuskus-theme'))
  )

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('kuskus-theme', theme)
  }, [theme])

  return [theme, setTheme]
}
