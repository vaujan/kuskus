import {
  FOCUS_RAIL_DENSITY_STORAGE_KEY,
  parseFocusRailDensity
} from '@/features/items/focus-view-state'
import { ITEM_SORT_STORAGE_KEY, parseItemSort } from '@/features/items/item-sort'
import { parseLibraryView } from '@/features/items/item-view'
import { NOTE_VIM_MODE_STORAGE_KEY, parseNoteVimEnabled } from '@/features/items/note-vim-mode'
import {
  DEFAULT_TYPOGRAPHY,
  resolveColorMode,
  resolveColorTheme,
  resolveFontPreference
} from '@/hooks/theme'

export type SettingKey =
  | 'colorMode'
  | 'colorTheme'
  | 'uiFont'
  | 'uiFontFallback'
  | 'codeFont'
  | 'codeFontFallback'
  | 'libraryView'
  | 'itemSort'
  | 'vimEnabled'
  | 'railDensity'

export type SettingValue = string | boolean

export interface SettingDefinition<T extends SettingValue = SettingValue> {
  key: SettingKey
  storageKey: string
  default: T
  parse: (stored: string | null) => T
}

export const SETTINGS_SCHEMA: readonly SettingDefinition[] = [
  {
    key: 'colorMode',
    storageKey: 'kuskus-color-mode',
    default: 'dark',
    parse: resolveColorMode
  },
  {
    key: 'colorTheme',
    storageKey: 'kuskus-color-theme',
    default: 'kuskus',
    parse: resolveColorTheme
  },
  {
    key: 'uiFont',
    storageKey: 'kuskus-ui-font',
    default: DEFAULT_TYPOGRAPHY.uiFont,
    parse: (value) => resolveFontPreference(value, DEFAULT_TYPOGRAPHY.uiFont)
  },
  {
    key: 'uiFontFallback',
    storageKey: 'kuskus-ui-font-fallback',
    default: DEFAULT_TYPOGRAPHY.uiFontFallback,
    parse: (value) => resolveFontPreference(value, DEFAULT_TYPOGRAPHY.uiFontFallback, true)
  },
  {
    key: 'codeFont',
    storageKey: 'kuskus-code-font',
    default: DEFAULT_TYPOGRAPHY.codeFont,
    parse: (value) => resolveFontPreference(value, DEFAULT_TYPOGRAPHY.codeFont)
  },
  {
    key: 'codeFontFallback',
    storageKey: 'kuskus-code-font-fallback',
    default: DEFAULT_TYPOGRAPHY.codeFontFallback,
    parse: (value) => resolveFontPreference(value, DEFAULT_TYPOGRAPHY.codeFontFallback, true)
  },
  {
    key: 'libraryView',
    storageKey: 'kuskus-library-view',
    default: 'visual',
    parse: parseLibraryView
  },
  {
    key: 'itemSort',
    storageKey: ITEM_SORT_STORAGE_KEY,
    default: 'added-desc',
    parse: parseItemSort
  },
  {
    key: 'vimEnabled',
    storageKey: NOTE_VIM_MODE_STORAGE_KEY,
    default: false,
    parse: parseNoteVimEnabled
  },
  {
    key: 'railDensity',
    storageKey: FOCUS_RAIL_DENSITY_STORAGE_KEY,
    default: 'visual',
    parse: parseFocusRailDensity
  }
] as const satisfies readonly SettingDefinition[]

export function findSetting<T extends SettingValue = SettingValue>(
  key: SettingKey
): SettingDefinition<T> {
  const definition = SETTINGS_SCHEMA.find((setting) => setting.key === key)
  if (!definition) throw new Error(`Unknown setting: ${key}`)
  return definition as unknown as SettingDefinition<T>
}
