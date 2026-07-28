export function getScrollRatio(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number
): number {
  const available = scrollHeight - clientHeight
  if (available <= 0) return 0
  return Math.min(1, Math.max(0, scrollTop / available))
}

export function getScrollTopForRatio(
  ratio: number,
  scrollHeight: number,
  clientHeight: number
): number {
  const available = scrollHeight - clientHeight
  if (available <= 0) return 0
  return Math.min(1, Math.max(0, ratio)) * available
}

export function hasMeaningfulScrollDelta(current: number, next: number): boolean {
  return Math.abs(current - next) >= 1
}
