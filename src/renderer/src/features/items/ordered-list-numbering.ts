const ORDERED_ITEM = /^(\s*)(\d+)([.)])(\s+)/
const UNORDERED_ITEM = /^(\s*)[-*+](\s+)/
const FENCE = /^\s{0,3}(`{3,}|~{3,})/

type Counter = { next: number }

export type TextChange = { from: number; to: number; insert: string }

export function minimalTextChange(before: string, after: string): TextChange | null {
  if (before === after) return null

  let from = 0
  const sharedLength = Math.min(before.length, after.length)
  while (from < sharedLength && before[from] === after[from]) from++

  let beforeEnd = before.length
  let afterEnd = after.length
  while (beforeEnd > from && afterEnd > from && before[beforeEnd - 1] === after[afterEnd - 1]) {
    beforeEnd--
    afterEnd--
  }

  return { from, to: beforeEnd, insert: after.slice(from, afterEnd) }
}

/** Keep ordered-list source markers sequential without touching fenced code. */
export function normalizeOrderedListNumbers(markdown: string): string {
  const counters = new Map<number, Counter>()
  let fenceMarker: string | null = null

  return markdown
    .split('\n')
    .map((line) => {
      const fence = line.match(FENCE)?.[1]
      if (fence) {
        if (fenceMarker === null) fenceMarker = fence[0]
        else if (fence[0] === fenceMarker) fenceMarker = null
        return line
      }
      if (fenceMarker !== null) return line

      const ordered = line.match(ORDERED_ITEM)
      if (ordered) {
        const indent = ordered[1].length
        for (const depth of counters.keys()) {
          if (depth > indent) counters.delete(depth)
        }

        const current = counters.get(indent)?.next ?? Number(ordered[2])
        counters.set(indent, { next: current + 1 })
        return `${ordered[1]}${current}${ordered[3]}${ordered[4]}${line.slice(ordered[0].length)}`
      }

      const unordered = line.match(UNORDERED_ITEM)
      if (unordered) {
        const indent = unordered[1].length
        for (const depth of counters.keys()) {
          if (depth >= indent) counters.delete(depth)
        }
        return line
      }

      if (line.trim()) {
        const indent = line.length - line.trimStart().length
        for (const depth of counters.keys()) {
          if (depth >= indent) counters.delete(depth)
        }
      }
      return line
    })
    .join('\n')
}
