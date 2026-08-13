import { GFM, parser as markdownParser } from '@lezer/markdown'

export interface MarkdownSelectionEdit {
  value: string
  selectionStart: number
  selectionEnd: number
}

const gfmParser = markdownParser.configure([GFM])

export function decodeMarkdownLinkTarget(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

export function markdownTaskMarkers(value: string): number[] {
  const positions: number[] = []
  const cursor = gfmParser.parse(value).cursor()
  do {
    if (cursor.name === 'TaskMarker') positions.push(cursor.from)
  } while (cursor.next())
  return positions
}

export function toggleMarkdownTask(value: string, position: number): string {
  const marker = value.slice(position, position + 3)
  if (!/^\[[ xX]\]$/.test(marker)) return value
  return value.slice(0, position + 1) + (marker[1] === ' ' ? 'x' : ' ') + value.slice(position + 2)
}

function countAdjacentMarkers(value: string, index: number, direction: -1 | 1): number {
  let count = 0
  let cursor = direction === -1 ? index - 1 : index
  while (cursor >= 0 && cursor < value.length && value[cursor] === '*') {
    count += 1
    cursor += direction
  }
  return count
}

function markerIsActive(leftCount: number, rightCount: number, marker: '*' | '**'): boolean {
  return marker === '*'
    ? leftCount % 2 === 1 && rightCount % 2 === 1
    : leftCount >= 2 && rightCount >= 2
}

export function toggleMarkdownMarker(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  marker: '*' | '**'
): MarkdownSelectionEdit {
  const selected = value.slice(selectionStart, selectionEnd)
  const markerLength = marker.length
  const hasSelection = selectionStart !== selectionEnd
  const selectedLeadingMarkers = countAdjacentMarkers(selected, 0, 1)
  const selectedTrailingMarkers = countAdjacentMarkers(selected, selected.length, -1)

  if (
    hasSelection &&
    markerIsActive(selectedLeadingMarkers, selectedTrailingMarkers, marker) &&
    selected.length >= markerLength * 2
  ) {
    return {
      value:
        value.slice(0, selectionStart) +
        selected.slice(markerLength, -markerLength) +
        value.slice(selectionEnd),
      selectionStart,
      selectionEnd: selectionEnd - markerLength * 2
    }
  }

  if (
    hasSelection &&
    markerIsActive(
      countAdjacentMarkers(value, selectionStart, -1),
      countAdjacentMarkers(value, selectionEnd, 1),
      marker
    )
  ) {
    return {
      value:
        value.slice(0, selectionStart - markerLength) +
        selected +
        value.slice(selectionEnd + markerLength),
      selectionStart: selectionStart - markerLength,
      selectionEnd: selectionEnd - markerLength
    }
  }

  return {
    value: value.slice(0, selectionStart) + marker + selected + marker + value.slice(selectionEnd),
    selectionStart: selectionStart + markerLength,
    selectionEnd: selectionEnd + markerLength
  }
}
