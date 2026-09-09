import type { LibraryItemDto } from '../../../../shared/library-contract'

export const MAX_RECENT_SEARCH_ITEMS = 8

export function addRecentSearchItem(itemIds: readonly string[], itemId: string): string[] {
  return [itemId, ...itemIds.filter((candidate) => candidate !== itemId)].slice(
    0,
    MAX_RECENT_SEARCH_ITEMS
  )
}

export function resolveRecentSearchItems(
  items: readonly LibraryItemDto[],
  itemIds: readonly string[]
): LibraryItemDto[] {
  const itemsById = new Map(items.map((item) => [item.id, item]))
  return itemIds
    .map((itemId) => itemsById.get(itemId))
    .filter((item): item is LibraryItemDto => item !== undefined && !item.referencedAttachment)
}
