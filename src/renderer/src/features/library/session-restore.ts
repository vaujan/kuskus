import type { LibraryDto } from '../../../../shared/library-contract'
import type { LibraryDestination } from '@/features/shell/library-sidebar'
import type { ItemTypeFilter } from '@/features/items/item-view'
import type { NoteMode } from '@/features/items/note-view-mode'

const SESSION_STORAGE_KEY_PREFIX = 'kuskus-session:v1'

const ITEM_TYPE_FILTERS: readonly ItemTypeFilter[] = ['note', 'image', 'url', 'file']
const NOTE_MODES: readonly NoteMode[] = ['read', 'live', 'markdown', 'split']

export interface AppSessionState {
  destination: LibraryDestination
  typeFilters: ItemTypeFilter[]
  recentItemIds: string[]
  focusItemId: string | null
  focusDetailOpen: boolean
  focusNoteExpanded: boolean
  focusNoteMode: NoteMode | null
}

function appSessionStorageKey(libraryPath: string): string {
  return `${SESSION_STORAGE_KEY_PREFIX}:${libraryPath}`
}

function resolveDestination(value: unknown, library: LibraryDto): LibraryDestination {
  if (!value || typeof value !== 'object' || !('type' in value)) return { type: 'inbox' }
  const type = (value as { type?: unknown }).type
  if (
    type === 'inbox' ||
    type === 'all' ||
    type === 'pinned' ||
    type === 'archive' ||
    type === 'trash'
  ) {
    return { type }
  }
  if (type === 'collection') {
    const collectionId = (value as { collectionId?: unknown }).collectionId
    if (
      typeof collectionId === 'string' &&
      library.collections.some((collection) => collection.id === collectionId)
    ) {
      return { type: 'collection', collectionId }
    }
  }
  return { type: 'inbox' }
}

export function readAppSession(library: LibraryDto): AppSessionState | null {
  let stored: unknown
  try {
    stored = JSON.parse(localStorage.getItem(appSessionStorageKey(library.path)) ?? '')
  } catch {
    return null
  }
  if (!stored || typeof stored !== 'object') return null
  const record = stored as Record<string, unknown>

  const destination = resolveDestination(record.destination, library)
  const typeFilters = Array.isArray(record.typeFilters)
    ? record.typeFilters.filter((value): value is ItemTypeFilter =>
        ITEM_TYPE_FILTERS.includes(value as ItemTypeFilter)
      )
    : []
  const recentItemIds = Array.isArray(record.recentItemIds)
    ? record.recentItemIds
        .filter(
          (value): value is string =>
            typeof value === 'string' && library.items.some((item) => item.id === value)
        )
        .slice(0, 8)
    : []

  let focusItemId: string | null = null
  if (
    typeof record.focusItemId === 'string' &&
    library.items.some((item) => item.id === record.focusItemId)
  ) {
    focusItemId = record.focusItemId
  }
  const focusItem = focusItemId ? library.items.find((item) => item.id === focusItemId) : null

  return {
    destination,
    typeFilters,
    recentItemIds,
    focusItemId,
    focusDetailOpen: focusItemId !== null && record.focusDetailOpen === true,
    focusNoteExpanded: focusItem?.type === 'note' && record.focusNoteExpanded === true,
    focusNoteMode:
      focusItem?.type === 'note' && NOTE_MODES.includes(record.focusNoteMode as NoteMode)
        ? (record.focusNoteMode as NoteMode)
        : null
  }
}

export function writeAppSession(libraryPath: string, state: AppSessionState): void {
  try {
    localStorage.setItem(
      appSessionStorageKey(libraryPath),
      JSON.stringify({
        destination: state.destination,
        typeFilters: state.typeFilters,
        recentItemIds: state.recentItemIds,
        focusItemId: state.focusItemId,
        focusDetailOpen: state.focusDetailOpen,
        focusNoteExpanded: state.focusNoteExpanded,
        focusNoteMode: state.focusNoteMode
      })
    )
  } catch {
    // Session state is optional UI context; the vault remains authoritative.
  }
}
