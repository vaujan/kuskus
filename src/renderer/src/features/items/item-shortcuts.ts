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

export function resolveRenameShortcutTarget(targetIds: readonly string[]): string | null {
  return targetIds.length === 1 ? targetIds[0] : null
}
