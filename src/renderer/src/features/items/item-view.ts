import type { LibraryItemDto } from '../../../../shared/library-contract'

export type LibraryView = 'visual' | 'grid'
export type ItemTypeFilter = LibraryItemDto['type']

export const ITEM_TYPE_FILTERS: ItemTypeFilter[] = ['note', 'image', 'url', 'file']

export function parseLibraryView(value: string | null): LibraryView {
  if (value === 'grid') return value
  return 'visual'
}
