import {
  FOCUS_RAIL_DENSITY_STORAGE_KEY,
  parseFocusRailDensity
} from '@/features/items/focus-view-state'
import { ITEM_SORT_STORAGE_KEY, parseItemSort } from '@/features/items/item-sort'
import { parseLibraryView } from '@/features/items/item-view'
import { NOTE_VIM_MODE_STORAGE_KEY, parseNoteVimEnabled } from '@/features/items/note-vim-mode'
import {
  DEFAULT_TYPOGRAPHY,
  resolveBaseFontSize,
  resolveColorMode,
  resolveColorTheme,
  resolveControlStyle,
  resolveFontPreference
} from '@/hooks/theme'

export type SettingKey =
  | 'colorMode'
  | 'colorTheme'
  | 'controlStyle'
  | 'uiFont'
  | 'contentFont'
  | 'codeFont'
  | 'sourceFontSize'
  | 'contentFontSize'
  | 'sourceLineNumbers'
  | 'contentFolding'
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
    key: 'controlStyle',
    storageKey: 'kuskus-control-style',
    default: 'skeuomorphic',
    parse: resolveControlStyle
  },
  {
    key: 'uiFont',
    storageKey: 'kuskus-ui-font',
    default: DEFAULT_TYPOGRAPHY.uiFont,
    parse: (value) => resolveFontPreference(value, DEFAULT_TYPOGRAPHY.uiFont)
  },
  {
    key: 'contentFont',
    storageKey: 'kuskus-content-font',
    default: DEFAULT_TYPOGRAPHY.contentFont,
    parse: (value) => resolveFontPreference(value, DEFAULT_TYPOGRAPHY.contentFont)
  },
  {
    key: 'codeFont',
    storageKey: 'kuskus-code-font',
    default: DEFAULT_TYPOGRAPHY.codeFont,
    parse: (value) => resolveFontPreference(value, DEFAULT_TYPOGRAPHY.codeFont)
  },
  {
    key: 'sourceFontSize',
    storageKey: 'kuskus-markdown-source-font-size',
    default: DEFAULT_TYPOGRAPHY.sourceFontSize,
    parse: (value) => resolveBaseFontSize(value, DEFAULT_TYPOGRAPHY.sourceFontSize)
  },
  {
    key: 'contentFontSize',
    storageKey: 'kuskus-markdown-content-font-size',
    default: DEFAULT_TYPOGRAPHY.contentFontSize,
    parse: (value) => resolveBaseFontSize(value, DEFAULT_TYPOGRAPHY.contentFontSize)
  },
  {
    key: 'sourceLineNumbers',
    storageKey: 'kuskus-source-line-numbers',
    default: true,
    parse: (value) => value !== 'false'
  },
  {
    key: 'contentFolding',
    storageKey: 'kuskus-content-folding',
    default: true,
    parse: (value) => value !== 'false'
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
