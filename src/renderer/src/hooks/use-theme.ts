import { useEffect } from 'react'

import { useSetting } from '@/settings/settings-context'
import { applyTheme, type Theme } from '@/hooks/theme'

export type { Theme }

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useSetting<Theme>('theme')

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return [theme, setTheme]
}
