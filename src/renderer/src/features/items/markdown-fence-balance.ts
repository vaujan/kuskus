const FENCE_PATTERN = /^(```+|~~~+)(.*)$/

export function closeUnbalancedCodeFences(markdown: string): string {
  let fenceMarker = ''
  let inFence = false
  for (const line of markdown.split('\n')) {
    const match = FENCE_PATTERN.exec(line.trim())
    if (!inFence) {
      if (match) {
        fenceMarker = match[1]
        inFence = true
      }
    } else if (match && match[1][0] === fenceMarker[0] && match[1].length >= fenceMarker.length) {
      inFence = false
    }
  }
  return inFence ? `${markdown}\n${fenceMarker}` : markdown
}
