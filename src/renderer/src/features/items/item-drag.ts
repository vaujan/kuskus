export const KUSKUS_ITEM_DRAG_TYPE = 'application/x-kuskus-item-ids'

export function hasKuskusItemDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(KUSKUS_ITEM_DRAG_TYPE)
}

export function readKuskusItemDrag(dataTransfer: DataTransfer): string[] {
  if (!hasKuskusItemDrag(dataTransfer)) return []
  try {
    const value: unknown = JSON.parse(dataTransfer.getData(KUSKUS_ITEM_DRAG_TYPE))
    return Array.isArray(value) && value.every((itemId) => typeof itemId === 'string')
      ? [...new Set(value)]
      : []
  } catch {
    return []
  }
}
