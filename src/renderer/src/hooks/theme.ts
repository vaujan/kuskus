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
