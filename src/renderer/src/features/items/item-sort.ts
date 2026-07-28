import { ITEM_TYPE_FILTERS } from '@/features/items/item-view'
import type { LibraryItemDto } from '../../../../shared/library-contract'

export type ItemSort = 'added-desc' | 'added-asc' | 'title-asc' | 'title-desc' | 'type'

export const DEFAULT_ITEM_SORT: ItemSort = 'added-desc'

export const ITEM_SORT_STORAGE_KEY = 'kuskus-item-sort'

export const ITEM_SORT_OPTIONS: { value: ItemSort; label: string }[] = [
  { value: 'added-desc', label: 'Newest first' },
  { value: 'added-asc', label: 'Oldest first' },
  { value: 'title-asc', label: 'Title A–Z' },
  { value: 'title-desc', label: 'Title Z–A' },
  { value: 'type', label: 'Group by type' }
]

export function parseItemSort(stored: string | null): ItemSort {
  return ITEM_SORT_OPTIONS.some((option) => option.value === stored)
    ? (stored as ItemSort)
    : DEFAULT_ITEM_SORT
}

const titleCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

function compareById(a: LibraryItemDto, b: LibraryItemDto): number {
  return a.id.localeCompare(b.id)
}

function compareNewestFirst(a: LibraryItemDto, b: LibraryItemDto): number {
  return b.createdAt.localeCompare(a.createdAt) || compareById(a, b)
}

// Every comparator ends in a deterministic tiebreaker so keyboard focus order,
// range selection, and detail navigation stay stable for same-date or same-title items.
const SORT_COMPARATORS: Record<ItemSort, (a: LibraryItemDto, b: LibraryItemDto) => number> = {
  'added-desc': compareNewestFirst,
  'added-asc': (a, b) => a.createdAt.localeCompare(b.createdAt) || compareById(a, b),
  'title-asc': (a, b) => titleCollator.compare(a.title, b.title) || compareNewestFirst(a, b),
  'title-desc': (a, b) => titleCollator.compare(b.title, a.title) || compareNewestFirst(a, b),
  type: (a, b) =>
    ITEM_TYPE_FILTERS.indexOf(a.type) - ITEM_TYPE_FILTERS.indexOf(b.type) ||
    compareNewestFirst(a, b)
}

export function sortItems(items: LibraryItemDto[], sort: ItemSort): LibraryItemDto[] {
  return [...items].sort(SORT_COMPARATORS[sort])
}
