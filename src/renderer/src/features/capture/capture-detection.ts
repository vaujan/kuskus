export type CaptureKind = 'empty' | 'image' | 'link' | 'note'

function unescapeMarkdownUrl(value: string): string {
  // milkdown/remark escapes link destinations and URL characters when serializing
  // a link mark: `https\://...` and `...\&hl=id`. Undo those escapes before matching.
  return value.replace(/\\([\\!"#$%&'()*+,./:;<=>?@[\]^_`{|}~-])/g, '$1')
}

export function extractWebUrl(value: string): string | null {
  const trimmed = value.trim()
  // Unwrap the serialized forms a pasted bare URL can take in Markdown:
  // a markdown autolink <https://...>, a self-referential link [https://...](https://...),
  // or an escaped link-mark destination like https\://host/path\?a\=b.
  const unescaped = unescapeMarkdownUrl(trimmed)
  const autolink = /^<https?:\/\/[^<>]+>$/.test(unescaped) ? unescaped.slice(1, -1) : null
  const selfLink = /^\[(https?:\/\/[^\]]+)\]\(\1\)$/.exec(unescaped)
  const candidate = autolink ?? selfLink?.[1] ?? unescaped
  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    // The URL parser adds a trailing slash for a bare origin (https://www.google.com/),
    // so compare both sides with a single trailing slash ignored.
    const stripTrailingSlash = (text: string): string =>
      text.length > 1 && text.endsWith('/') ? text.slice(0, -1) : text
    return stripTrailingSlash(url.href) === stripTrailingSlash(candidate) ? candidate : null
  } catch {
    return null
  }
}

export function isSingleWebUrl(value: string): boolean {
  return extractWebUrl(value) !== null
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
