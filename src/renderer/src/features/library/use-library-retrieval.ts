import { useCallback, useMemo } from 'react'

import { getFolderSubtreeIds } from '@/features/collections/folder-tree'
import { sortItems, type ItemSort } from '@/features/items/item-sort'
import type { ItemTypeFilter } from '@/features/items/item-view'
import type { LibraryDestination } from '@/features/shell/library-sidebar'
import type { LibraryDto, LibraryItemDto } from '../../../../shared/library-contract'

function itemMatchesDestination(
  item: LibraryItemDto,
  destination: LibraryDestination,
  collectionSubtreeIds: ReadonlySet<string> | null,
  pinnedItemIds: ReadonlySet<string>
): boolean {
  if (destination.type === 'all') {
    return item.location.type === 'inbox' || item.location.type === 'collection'
  }
  if (destination.type === 'pinned') {
    return (
      pinnedItemIds.has(item.id) &&
      (item.location.type === 'inbox' || item.location.type === 'collection')
    )
  }
  if (destination.type === 'collection') {
    return (
      item.location.type === 'collection' &&
      (collectionSubtreeIds?.has(item.location.collectionId) ??
        item.location.collectionId === destination.collectionId)
    )
  }
  return item.location.type === destination.type
}

export function useLibraryRetrieval({
  library,
  destination,
  typeFilters,
  sort,
  showReferencedAttachments,
  excludedItemId
}: {
  library: LibraryDto
  destination: LibraryDestination
  typeFilters: ItemTypeFilter[]
  sort: ItemSort
  showReferencedAttachments: boolean
  excludedItemId: string | null
}): {
  visibleItems: LibraryItemDto[]
  destinationItems: LibraryItemDto[]
  matchesCurrentRetrieval: (item: LibraryItemDto) => boolean
} {
  const collectionSubtreeIds = useMemo(
    () =>
      destination.type === 'collection'
        ? getFolderSubtreeIds(library.collections, destination.collectionId)
        : null,
    [destination, library.collections]
  )
  const pinnedItemIds = useMemo(() => new Set(library.pinnedItemIds), [library.pinnedItemIds])
  const matchesCurrentRetrieval = useCallback(
    (item: LibraryItemDto): boolean =>
      (showReferencedAttachments || !item.referencedAttachment) &&
      itemMatchesDestination(item, destination, collectionSubtreeIds, pinnedItemIds) &&
      (typeFilters.length === 0 || typeFilters.includes(item.type)),
    [collectionSubtreeIds, destination, pinnedItemIds, showReferencedAttachments, typeFilters]
  )
  const visibleItems = useMemo(
    () =>
      sortItems(
        library.items.filter((item) => item.id !== excludedItemId && matchesCurrentRetrieval(item)),
        sort
      ),
    [excludedItemId, library.items, matchesCurrentRetrieval, sort]
  )
  const destinationItems = useMemo(
    () =>
      library.items.filter((item) =>
        itemMatchesDestination(item, destination, collectionSubtreeIds, pinnedItemIds)
      ),
    [collectionSubtreeIds, destination, library.items, pinnedItemIds]
  )

  return {
    visibleItems,
    destinationItems,
    matchesCurrentRetrieval
  }
}
