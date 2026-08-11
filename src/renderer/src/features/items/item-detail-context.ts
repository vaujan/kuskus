import type { CollectionDto, ItemLocation } from '../../../../shared/library-contract'

export interface ItemDetailContext {
  locationPath: string[]
  updatedLabel: string
}

function resolveCollectionPath(
  collectionId: string,
  collections: readonly CollectionDto[]
): string[] {
  const collectionsById = new Map(collections.map((collection) => [collection.id, collection]))
  const path: string[] = []
  const visited = new Set<string>()
  let currentId: string | null = collectionId

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const collection = collectionsById.get(currentId)
    if (!collection) return ['Folder unavailable']
    path.unshift(collection.name)
    currentId = collection.parentId
  }

  return path.length > 0 ? path : ['Folder unavailable']
}

export function resolveItemLocationPath(
  location: ItemLocation,
  collections: readonly CollectionDto[]
): string[] {
  if (location.type === 'inbox') return ['Inbox']
  if (location.type === 'archive') return ['Archive']
  if (location.type === 'trash') return ['Trash']
  return resolveCollectionPath(location.collectionId, collections)
}

export function formatItemUpdatedAt(value: string, locales?: Intl.LocalesArgument): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locales, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

export function resolveItemDetailContext(
  location: ItemLocation,
  updatedAt: string,
  collections: readonly CollectionDto[],
  locales?: Intl.LocalesArgument
): ItemDetailContext {
  return {
    locationPath: resolveItemLocationPath(location, collections),
    updatedLabel: formatItemUpdatedAt(updatedAt, locales)
  }
}
