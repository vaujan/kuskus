import { startTransition, useEffect, useMemo, useRef, useState } from 'react'

import type { LibraryItemDto } from '../../../../shared/library-contract'

const SEARCH_DEBOUNCE_MS = 150
const MAX_SEARCH_RESULTS = 50

export function useLibrarySearch(
  items: readonly LibraryItemDto[],
  query: string
): { items: LibraryItemDto[]; pending: boolean; error: boolean } {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const [resolvedQuery, setResolvedQuery] = useState('')
  const [resultIds, setResultIds] = useState<readonly string[]>([])
  const [error, setError] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    if (!normalizedQuery) {
      requestId.current += 1
      return
    }
    const currentRequest = requestId.current + 1
    requestId.current = currentRequest
    const timer = window.setTimeout(() => {
      void window.kuskus.queryItems({ query: normalizedQuery }).then((result) => {
        if (currentRequest !== requestId.current) return
        startTransition(() => {
          setResolvedQuery(normalizedQuery)
          setResultIds(result.ok ? result.data.itemIds : [])
          setError(!result.ok)
        })
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [normalizedQuery])

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const results = useMemo(() => {
    if (!normalizedQuery || resolvedQuery !== normalizedQuery) return []
    const matches: LibraryItemDto[] = []
    for (const itemId of resultIds) {
      const item = itemsById.get(itemId)
      if (!item || item.referencedAttachment) continue
      matches.push(item)
      if (matches.length === MAX_SEARCH_RESULTS) break
    }
    return matches
  }, [itemsById, normalizedQuery, resolvedQuery, resultIds])

  return {
    items: results,
    pending: Boolean(normalizedQuery && resolvedQuery !== normalizedQuery),
    error: Boolean(normalizedQuery && resolvedQuery === normalizedQuery && error)
  }
}
