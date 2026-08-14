import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

export function resolveTheme(value: string | null): Theme {
  return value === 'light' ? 'light' : 'dark'
}

export function applyTheme(
  theme: Theme,
  root: Pick<HTMLElement, 'classList' | 'style'> = document.documentElement
): void {
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
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
