export function resolveItemShortcutTargets(
  selectedIds: ReadonlySet<string>,
  focusedItemId: string | null,
  visibleItemIds: ReadonlySet<string>
): string[] {
  if (selectedIds.size > 0) {
    return [...selectedIds].filter((itemId) => visibleItemIds.has(itemId))
  }

  return focusedItemId !== null && visibleItemIds.has(focusedItemId) ? [focusedItemId] : []
}

export function resolveItemMenuTargets(
  selectedIds: ReadonlySet<string>,
  clickedItemId: string,
  visibleItemIds: ReadonlySet<string>
): string[] {
  if (!visibleItemIds.has(clickedItemId)) return []
  if (!selectedIds.has(clickedItemId)) return [clickedItemId]

  return [...selectedIds].filter((itemId) => visibleItemIds.has(itemId))
}

export function resolveRenameShortcutTarget(targetIds: readonly string[]): string | null {
  return targetIds.length === 1 ? targetIds[0] : null
}

export function hasBulkItemSelection(selectedItemCount: number): boolean {
  return selectedItemCount > 1
}
