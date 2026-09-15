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

function quickOpenFilenames(item: LibraryItemDto): string[] {
  const pathFilename = item.relativePath.split(/[\\/]/).at(-1) ?? item.relativePath
  if (item.type === 'image' || item.type === 'file') {
    return [pathFilename, item.sourceFilename ?? '', item.contentFilename]
  }
  return [pathFilename]
}

export function resolveQuickOpenItems(
  items: readonly LibraryItemDto[],
  query: string,
  limit = 50
): LibraryItemDto[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const terms = normalizedQuery.split(/\s+/)
  if (!normalizedQuery) return []

  return items
    .map((item, index) => {
      const title = item.title.toLocaleLowerCase()
      const filenames = quickOpenFilenames(item).map((filename) => filename.toLocaleLowerCase())
      const fields = [title, ...filenames]
      const score =
        title === normalizedQuery
          ? 0
          : filenames.includes(normalizedQuery)
            ? 1
            : title.startsWith(normalizedQuery)
              ? 2
              : filenames.some((filename) => filename.startsWith(normalizedQuery))
                ? 3
                : title.includes(normalizedQuery)
                  ? 4
                  : filenames.some((filename) => filename.includes(normalizedQuery))
                    ? 5
                    : 6
      return { item, index, fields, score }
    })
    .filter(
      ({ item, fields }) =>
        !item.referencedAttachment &&
        terms.every((term) => fields.some((field) => field.includes(term)))
    )
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, limit)
    .map(({ item }) => item)
}
