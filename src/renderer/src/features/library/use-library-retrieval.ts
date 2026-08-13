import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { getFolderSubtreeIds } from '@/features/collections/folder-tree'
import { sortItems, type ItemSort } from '@/features/items/item-sort'
import type { ItemTypeFilter } from '@/features/items/item-view'
import type { LibraryDestination } from '@/features/shell/library-sidebar'
import type { LibraryDto, LibraryItemDto } from '../../../../shared/library-contract'

function itemMatchesDestination(
  item: LibraryItemDto,
  destination: LibraryDestination,
  collectionSubtreeIds: ReadonlySet<string> | null
): boolean {
  if (destination.type === 'all') {
    return item.location.type === 'inbox' || item.location.type === 'collection'
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
  search,
  typeFilters,
  sort,
  showReferencedAttachments,
  excludedItemId,
  onSearchResolved
}: {
  library: LibraryDto
  destination: LibraryDestination
  search: string
  typeFilters: ItemTypeFilter[]
  sort: ItemSort
  showReferencedAttachments: boolean
  excludedItemId: string | null
  onSearchResolved: (itemIds: ReadonlySet<string>) => void
}): {
  deferredSearch: string
  searchPending: boolean
  visibleItems: LibraryItemDto[]
  destinationItems: LibraryItemDto[]
  matchesCurrentRetrieval: (item: LibraryItemDto) => boolean
} {
  const deferredSearch = useDeferredValue(search)
  const query = deferredSearch.trim().toLocaleLowerCase()
  const requestId = useRef(0)
  const [searchMatches, setSearchMatches] = useState<{
    library: LibraryDto
    query: string
    itemIds: ReadonlySet<string>
  } | null>(null)

  useEffect(() => {
    if (!query) return
    const currentRequest = requestId.current + 1
    requestId.current = currentRequest
    let active = true
    void window.kuskus.queryItems({ query }).then((result) => {
      if (!active || currentRequest !== requestId.current || !result.ok) return
      const itemIds = new Set(result.data.itemIds)
      onSearchResolved(itemIds)
      startTransition(() => setSearchMatches({ library, query, itemIds }))
    })
    return () => {
      active = false
    }
  }, [library, onSearchResolved, query])

  const collectionSubtreeIds = useMemo(
    () =>
      destination.type === 'collection'
        ? getFolderSubtreeIds(library.collections, destination.collectionId)
        : null,
    [destination, library.collections]
  )
  const acceptedSearchIds =
    searchMatches?.library === library && searchMatches.query === query
      ? searchMatches.itemIds
      : null
  const matchesCurrentRetrieval = useCallback(
    (item: LibraryItemDto): boolean =>
      (showReferencedAttachments || !item.referencedAttachment) &&
      itemMatchesDestination(item, destination, collectionSubtreeIds) &&
      (typeFilters.length === 0 || typeFilters.includes(item.type)) &&
      (!query || acceptedSearchIds?.has(item.id) === true),
    [
      acceptedSearchIds,
      collectionSubtreeIds,
      destination,
      query,
      showReferencedAttachments,
      typeFilters
    ]
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
        itemMatchesDestination(item, destination, collectionSubtreeIds)
      ),
    [collectionSubtreeIds, destination, library.items]
  )

  return {
    deferredSearch,
    searchPending: search !== deferredSearch || Boolean(query && !acceptedSearchIds),
    visibleItems,
    destinationItems,
    matchesCurrentRetrieval
  }
}
