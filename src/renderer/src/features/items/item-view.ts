import type { LibraryItemDto } from '../../../../shared/library-contract'

export type LibraryView = 'visual' | 'grid' | 'list'
export type ItemTypeFilter = LibraryItemDto['type']

export const ITEM_TYPE_FILTERS: ItemTypeFilter[] = ['note', 'image', 'url']
