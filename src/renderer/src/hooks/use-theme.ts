import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem('kuskus-theme') === 'light' ? 'light' : 'dark'
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('kuskus-theme', theme)
  }, [theme])

  return [theme, setTheme]
}
