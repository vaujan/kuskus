import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'

import type { LibraryItemDto } from '../../../../shared/library-contract'

const MAX_SEARCH_RESULTS = 50

export function useLibrarySearch(
  items: readonly LibraryItemDto[],
  query: string
): { items: LibraryItemDto[]; pending: boolean; error: boolean; hasResolvedQuery: boolean } {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const searchActive = Boolean(normalizedQuery)
  const deferredQuery = useDeferredValue(normalizedQuery)
  const [result, setResult] = useState({ query: '', ids: [] as readonly string[], error: false })

  useEffect(() => {
    if (!deferredQuery) return
    let cancelled = false
    void window.kusu.queryItems({ query: deferredQuery }).then(
      (response) => {
        if (cancelled) return
        startTransition(() =>
          setResult((current) => {
            const ids = response.ok ? response.data.itemIds : []
            return {
              query: deferredQuery,
              ids:
                current.ids.length === ids.length &&
                current.ids.every((id, index) => id === ids[index])
                  ? current.ids
                  : ids,
              error: !response.ok
            }
          })
        )
      },
      () => {
        if (!cancelled)
          startTransition(() => setResult({ query: deferredQuery, ids: [], error: true }))
      }
    )
    return () => {
      cancelled = true
    }
  }, [deferredQuery, items])

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const results = useMemo(() => {
    if (!searchActive) return []
    const matches: LibraryItemDto[] = []
    for (const itemId of result.ids) {
      const item = itemsById.get(itemId)
      if (!item || item.referencedAttachment) continue
      matches.push(item)
      if (matches.length === MAX_SEARCH_RESULTS) break
    }
    return matches
  }, [itemsById, searchActive, result.ids])

  return {
    items: results,
    hasResolvedQuery: Boolean(result.query),
    pending: Boolean(normalizedQuery && result.query !== normalizedQuery),
    error: Boolean(normalizedQuery && result.query === normalizedQuery && result.error)
  }
}
