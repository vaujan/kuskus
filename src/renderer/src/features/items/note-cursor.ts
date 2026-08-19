export function createCursorMarker(): string {
  return `KUSKUSCURSOR${Math.random().toString(36).slice(2)}`
}

export function findCursorMarkerOffset(value: string, marker: string): number | null {
  const index = value.indexOf(marker)
  return index < 0 ? null : index
}

export function clampCursorOffset(value: string, offset: number): number {
  return Math.max(0, Math.min(offset, value.length))
}
