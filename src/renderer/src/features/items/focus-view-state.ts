export const DEFAULT_FOCUS_LIST_WIDTH = 420
export const MIN_FOCUS_LIST_WIDTH = 320
export const MAX_FOCUS_LIST_WIDTH = 720
export const FOCUS_SPLIT_BREAKPOINT = 760
export const FOCUS_RAIL_DENSITY_STORAGE_KEY = 'kuskus-focus-rail-density:v1'

export type FocusRailDensity = 'index' | 'visual'

export function parseFocusRailDensity(value: string | null): FocusRailDensity {
  return value === 'visual' ? 'visual' : 'index'
}

export function clampFocusListWidth(
  width: number,
  availableWidth = Number.POSITIVE_INFINITY
): number {
  const availableMaximum = Number.isFinite(availableWidth)
    ? Math.max(MIN_FOCUS_LIST_WIDTH, Math.floor(availableWidth * 0.45))
    : MAX_FOCUS_LIST_WIDTH
  return Math.min(MAX_FOCUS_LIST_WIDTH, availableMaximum, Math.max(MIN_FOCUS_LIST_WIDTH, width))
}

export function parseFocusListWidth(value: string | null): number {
  const parsed = value === null ? Number.NaN : Number(value)
  return Number.isFinite(parsed) ? clampFocusListWidth(parsed) : DEFAULT_FOCUS_LIST_WIDTH
}

export function resolveInitialFocusItemId(
  visibleItemIds: readonly string[],
  currentItemId: string | null
): string | null {
  if (currentItemId) return currentItemId
  return visibleItemIds[0] ?? null
}

export function resolveFocusAfterRemoval(
  previousVisibleItemIds: readonly string[],
  nextVisibleItemIds: readonly string[],
  currentItemId: string | null
): string | null {
  if (currentItemId && nextVisibleItemIds.includes(currentItemId)) return currentItemId
  if (!currentItemId) return nextVisibleItemIds[0] ?? null
  const previousIndex = previousVisibleItemIds.indexOf(currentItemId)
  if (previousIndex < 0) return nextVisibleItemIds[0] ?? null
  return nextVisibleItemIds[Math.min(previousIndex, nextVisibleItemIds.length - 1)] ?? null
}

export function resolveFocusNavigationItemId(
  visibleItemIds: readonly string[],
  currentItemId: string,
  key: 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'
): string {
  const index = visibleItemIds.indexOf(currentItemId)
  if (index < 0) return visibleItemIds[0] ?? currentItemId
  if (key === 'Home') return visibleItemIds[0] ?? currentItemId
  if (key === 'End') return visibleItemIds.at(-1) ?? currentItemId
  const delta = key === 'ArrowUp' ? -1 : 1
  return (
    visibleItemIds[Math.min(visibleItemIds.length - 1, Math.max(0, index + delta))] ?? currentItemId
  )
}
