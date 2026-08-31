export type Theme = 'dark' | 'light' | 'system'

export type ResolvedTheme = 'dark' | 'light'

export function resolveTheme(value: string | null): Theme {
  return value === 'light' || value === 'system' ? value : 'dark'
}

export function resolveSystemTheme(prefersDark: boolean): ResolvedTheme {
  return prefersDark ? 'dark' : 'light'
}

export function resolveAppliedTheme(theme: Theme): ResolvedTheme {
  return theme === 'light'
    ? 'light'
    : theme === 'system'
      ? resolveSystemTheme(window.matchMedia('(prefers-color-scheme: dark)').matches)
      : 'dark'
}

export function applyTheme(
  theme: ResolvedTheme,
  root: Pick<HTMLElement, 'classList' | 'style'> = document.documentElement
): void {
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}
