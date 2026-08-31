import {
  FOCUS_RAIL_DENSITY_STORAGE_KEY,
  parseFocusRailDensity
} from '@/features/items/focus-view-state'
import { ITEM_SORT_STORAGE_KEY, parseItemSort } from '@/features/items/item-sort'
import { parseLibraryView } from '@/features/items/item-view'
import {
  NOTE_INLINE_TITLE_STORAGE_KEY,
  parseNoteInlineTitle
} from '@/features/items/note-inline-title'
import {
  NOTE_READING_WIDTH_STORAGE_KEY,
  parseNoteReadingWidth
} from '@/features/items/note-reading-width'
import { NOTE_VIM_MODE_STORAGE_KEY, parseNoteVimEnabled } from '@/features/items/note-vim-mode'

export type SettingKey =
  | 'theme'
  | 'libraryView'
  | 'itemSort'
  | 'vimEnabled'
  | 'readingWidth'
  | 'inlineTitle'
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
    key: 'theme',
    storageKey: 'kuskus-theme',
    default: 'dark',
    parse: (stored) => (stored === 'light' || stored === 'system' ? stored : 'dark')
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
    key: 'readingWidth',
    storageKey: NOTE_READING_WIDTH_STORAGE_KEY,
    default: 'comfortable',
    parse: parseNoteReadingWidth
  },
  {
    key: 'inlineTitle',
    storageKey: NOTE_INLINE_TITLE_STORAGE_KEY,
    default: true,
    parse: parseNoteInlineTitle
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
