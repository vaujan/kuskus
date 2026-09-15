import { useCallback, useState } from 'react'

export interface SelectionModifiers {
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

export function resolveSelection(
  selectedIds: ReadonlySet<string>,
  anchorId: string | null,
  visibleIds: readonly string[],
  itemId: string,
  modifiers: SelectionModifiers
): { selectedIds: Set<string>; anchorId: string | null } {
  if (modifiers.shiftKey && anchorId) {
    const anchorIndex = visibleIds.indexOf(anchorId)
    const itemIndex = visibleIds.indexOf(itemId)
    if (anchorIndex >= 0 && itemIndex >= 0) {
      const start = Math.min(anchorIndex, itemIndex)
      const end = Math.max(anchorIndex, itemIndex)
      return { selectedIds: new Set(visibleIds.slice(start, end + 1)), anchorId }
    }
  }
  if (modifiers.ctrlKey || modifiers.metaKey) {
    const next = new Set(selectedIds)
    if (next.has(itemId)) next.delete(itemId)
    else next.add(itemId)
    return { selectedIds: next, anchorId: itemId }
  }
  return { selectedIds: new Set([itemId]), anchorId: itemId }
}

export function useLibrarySelection(announceStatus: (message: string) => void): {
  selectedIds: ReadonlySet<string>
  anchorId: string | null
  clearSelection: () => void
  clearSelectionSilently: () => void
  restoreSelection: (itemIds: readonly string[], anchorId: string | null) => void
  pruneSelection: (itemIds: ReadonlySet<string>) => void
  selectAll: (itemIds: readonly string[]) => void
  selectItem: (itemId: string, visibleIds: readonly string[], modifiers: SelectionModifiers) => void
  prepareItem: (itemId: string) => void
} {
  const [selection, setSelection] = useState<{
    selectedIds: Set<string>
    anchorId: string | null
  }>(() => ({ selectedIds: new Set(), anchorId: null }))

  const clearSelectionSilently = useCallback((): void => {
    setSelection({ selectedIds: new Set(), anchorId: null })
  }, [])

  const clearSelection = useCallback((): void => {
    clearSelectionSilently()
    announceStatus('Selection cleared')
  }, [announceStatus, clearSelectionSilently])

  const restoreSelection = useCallback(
    (itemIds: readonly string[], anchorId: string | null): void => {
      setSelection({ selectedIds: new Set(itemIds), anchorId })
    },
    []
  )

  const pruneSelection = useCallback((itemIds: ReadonlySet<string>): void => {
    setSelection((current) => {
      const selectedIds = new Set([...current.selectedIds].filter((itemId) => itemIds.has(itemId)))
      const anchorId = current.anchorId && itemIds.has(current.anchorId) ? current.anchorId : null
      return selectedIds.size === current.selectedIds.size && anchorId === current.anchorId
        ? current
        : { selectedIds, anchorId }
    })
  }, [])

  const selectAll = useCallback(
    (itemIds: readonly string[]): void => {
      setSelection({ selectedIds: new Set(itemIds), anchorId: null })
      announceStatus(`${itemIds.length} ${itemIds.length === 1 ? 'item' : 'items'} selected`)
    },
    [announceStatus]
  )

  const selectItem = useCallback(
    (itemId: string, visibleIds: readonly string[], modifiers: SelectionModifiers): void => {
      setSelection((current) =>
        resolveSelection(current.selectedIds, current.anchorId, visibleIds, itemId, modifiers)
      )
    },
    []
  )

  const prepareItem = useCallback((itemId: string): void => {
    setSelection((current) =>
      current.selectedIds.has(itemId)
        ? current
        : { selectedIds: new Set([itemId]), anchorId: itemId }
    )
  }, [])

  return {
    selectedIds: selection.selectedIds,
    anchorId: selection.anchorId,
    clearSelection,
    clearSelectionSilently,
    restoreSelection,
    pruneSelection,
    selectAll,
    selectItem,
    prepareItem
  }
}
