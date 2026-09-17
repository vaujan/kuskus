export type ColorMode = 'dark' | 'light' | 'system'

export type ColorTheme =
  | 'kuskus'
  | 'graphite'
  | 'github'
  | 'ayu'
  | 'material'
  | 'moss'
  | 'clay'
  | 'solarized'
  | 'catppuccin'
  | 'tokyo-storm'
  | 'monokai'
  | 'one'
  | 'dracula'
  | 'gruvbox'
  | 'nord'

export type FontPreference =
  'inter' | 'plex' | 'system-ui' | 'system-mono' | 'none' | `local:${string}`

export type BaseFontSize = '13' | '14' | '15' | '16' | '17' | '18' | '20'

export interface TypographyPreferences {
  uiFont: FontPreference
  uiFontFallback: FontPreference
  contentFont: FontPreference
  contentFontFallback: FontPreference
  codeFont: FontPreference
  codeFontFallback: FontPreference
  sourceFontSize: BaseFontSize
  contentFontSize: BaseFontSize
}

export const DEFAULT_TYPOGRAPHY: TypographyPreferences = {
  uiFont: 'inter',
  uiFontFallback: 'system-ui',
  contentFont: 'inter',
  contentFontFallback: 'system-ui',
  codeFont: 'system-mono',
  codeFontFallback: 'none',
  sourceFontSize: '14',
  contentFontSize: '16'
}

export type ResolvedTheme = 'dark' | 'light'

export function resolveColorMode(value: string | null): ColorMode {
  return value === 'light' || value === 'system' ? value : 'dark'
}

export function resolveColorTheme(value: string | null): ColorTheme {
  return value === 'graphite' ||
    value === 'github' ||
    value === 'ayu' ||
    value === 'material' ||
    value === 'moss' ||
    value === 'clay' ||
    value === 'solarized' ||
    value === 'catppuccin' ||
    value === 'tokyo-storm' ||
    value === 'monokai' ||
    value === 'one' ||
    value === 'dracula' ||
    value === 'gruvbox' ||
    value === 'nord'
    ? value
    : 'kuskus'
}

function isLocalFontPreference(value: string): value is `local:${string}` {
  const family = value.slice('local:'.length)
  const hasControlCharacter = [...family].some((character) => character.charCodeAt(0) < 32)
  return (
    value.startsWith('local:') && family.length > 0 && family.length <= 120 && !hasControlCharacter
  )
}

export function resolveFontPreference(
  value: string | null,
  fallback: FontPreference,
  allowNone = false
): FontPreference {
  if (
    value === 'inter' ||
    value === 'plex' ||
    value === 'system-ui' ||
    value === 'system-mono' ||
    (allowNone && value === 'none') ||
    (value !== null && isLocalFontPreference(value))
  ) {
    return value
  }
  return fallback
}

export function resolveBaseFontSize(value: string | null, fallback: BaseFontSize): BaseFontSize {
  return value === '13' ||
    value === '14' ||
    value === '15' ||
    value === '16' ||
    value === '17' ||
    value === '18' ||
    value === '20'
    ? value
    : fallback
}

export function createLocalFontPreference(family: string): FontPreference | null {
  const value = `local:${family.trim()}`
  return isLocalFontPreference(value) ? value : null
}

export function getFontPreferenceLabel(value: FontPreference): string {
  if (value.startsWith('local:')) return value.slice('local:'.length)
  if (value === 'inter') return 'Inter'
  if (value === 'plex') return 'IBM Plex Sans'
  if (value === 'system-ui') return 'System default'
  if (value === 'system-mono') return 'System monospace'
  return 'Generic only'
}

function fontPreferenceFamily(value: FontPreference): string | null {
  if (value.startsWith('local:')) return JSON.stringify(value.slice('local:'.length))
  if (value === 'inter') return "'Inter Variable'"
  if (value === 'plex') return "'IBM Plex Sans Variable'"
  if (value === 'system-ui') return 'system-ui'
  if (value === 'system-mono') return 'ui-monospace'
  return null
}

export function createFontStack(
  primary: FontPreference,
  fallback: FontPreference,
  generic: 'sans-serif' | 'monospace'
): string {
  const families = [fontPreferenceFamily(primary), fontPreferenceFamily(fallback), generic]
  return [...new Set(families.filter((family): family is string => family !== null))].join(', ')
}

export function resolveSystemTheme(prefersDark: boolean): ResolvedTheme {
  return prefersDark ? 'dark' : 'light'
}

export function resolveAppliedTheme(mode: ColorMode): ResolvedTheme {
  return mode === 'light'
    ? 'light'
    : mode === 'system'
      ? resolveSystemTheme(window.matchMedia('(prefers-color-scheme: dark)').matches)
      : 'dark'
}

export function applyTheme(
  mode: ResolvedTheme,
  colorTheme: ColorTheme,
  typography: TypographyPreferences,
  root: Pick<HTMLElement, 'classList' | 'dataset' | 'style'> = document.documentElement
): void {
  root.classList.toggle('dark', mode === 'dark')
  root.dataset.colorTheme = colorTheme
  root.style.colorScheme = mode
  root.style.setProperty(
    '--font-ui',
    createFontStack(typography.uiFont, typography.uiFontFallback, 'sans-serif')
  )
  root.style.setProperty(
    '--font-code',
    createFontStack(typography.codeFont, typography.codeFontFallback, 'monospace')
  )
  root.style.setProperty(
    '--font-content',
    createFontStack(typography.contentFont, typography.contentFontFallback, 'sans-serif')
  )
  root.style.setProperty('--markdown-source-font-size', `${typography.sourceFontSize}px`)
  root.style.setProperty('--markdown-content-font-size', `${typography.contentFontSize}px`)
}
