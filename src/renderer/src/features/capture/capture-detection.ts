export type CaptureKind = 'empty' | 'image' | 'link' | 'note'

export function isSingleWebUrl(value: string): boolean {
  try {
    const trimmed = value.trim()
    const url = new URL(trimmed)
    return ['http:', 'https:'].includes(url.protocol) && url.toString() === trimmed
  } catch {
    return false
  }
}

export function detectCaptureKind(value: string, imageCount: number): CaptureKind {
  if (!value.trim()) {
    if (imageCount === 0) return 'empty'
    if (imageCount === 1) return 'image'
  }
  if (imageCount === 0 && isSingleWebUrl(value)) return 'link'
  return 'note'
}

export function composeMarkdownCapture(images: string[], text = ''): string {
  return [...images, text].filter((part) => part.length > 0).join('\n\n')
}
