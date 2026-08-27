import type { NoteAttachmentDto } from '../../../../shared/library-contract'
import {
  encodeMarkdownImageTarget,
  markdownImageTargetKey,
  rewriteMarkdownImageDestinations
} from '../../../../shared/markdown-image-references'

/**
 * Rewrites legacy `<br>` / `<br/>` HTML breaks into hard line breaks so
 * the Read renderer (remark-breaks) treats them as single-line wraps.
 * Inline code and fenced code are left untouched. This existed to
 * round-trip Milkdown's empty-paragraph serialization; it stays because
 * old notes may contain the literal bytes.
 */
const HTML_BREAK = /<br\s*\/?>/gi

function transformProse(value: string, transform: (prose: string) => string): string {
  const lines = value.split(/(?<=\n)/)
  let fence: string | null = null

  return lines
    .map((line) => {
      const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1] ?? null
      if (marker) {
        if (!fence) fence = marker
        else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null
        return line
      }
      if (fence) return line

      let output = ''
      let cursor = 0
      for (const match of line.matchAll(/(`+)([\s\S]*?)\1/g)) {
        const index = match.index ?? 0
        output += transform(line.slice(cursor, index)) + match[0]
        cursor = index + match[0].length
      }
      return output + transform(line.slice(cursor))
    })
    .join('')
}

export function normalizeHtmlBreaks(value: string): string {
  return transformProse(value, (prose) => prose.replace(HTML_BREAK, '  \n'))
}

function stripFrontmatter(value: string): string {
  if (!/^---[\t ]*\r?\n/.test(value)) return value
  const match = /^---[\t ]*\r?\n[\s\S]*?\r?\n---[\t ]*(?:\r?\n|$)/.exec(value)
  return match ? value.slice(match[0].length) : value
}

function attachmentFor(
  target: string,
  attachments: NoteAttachmentDto[]
): NoteAttachmentDto | undefined {
  const normalized = markdownImageTargetKey(target)
  return attachments.find((attachment) => {
    const path = markdownImageTargetKey(attachment.relativePath)
    return path === normalized || markdownImageTargetKey(attachment.filename) === normalized
  })
}

export function prepareObsidianMarkdown(value: string, attachments: NoteAttachmentDto[]): string {
  const source = normalizeHtmlBreaks(stripFrontmatter(value))
  const withEmbeds = source.replace(
    /!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
    (_match, rawTarget: string, rawLabel?: string) => {
      const target = rawTarget.trim()
      const attachment = attachmentFor(target, attachments)
      if (attachment) {
        return `![${rawLabel?.trim() || attachment.filename}](<${encodeMarkdownImageTarget(attachment.relativePath)}>)`
      }
      const label = rawLabel?.trim() || target
      return `[Embedded note: ${label}](kuskus-note:${encodeURIComponent(target)})`
    }
  )
  const withLinks = withEmbeds.replace(
    /(?<!!)\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
    (_match, rawTarget: string, rawLabel?: string) => {
      const target = rawTarget.trim()
      const label = rawLabel?.trim() || target
      return `[${label}](kuskus-note:${encodeURIComponent(target)})`
    }
  )
  return rewriteMarkdownImageDestinations(withLinks, (reference) => {
    if (/^(?:https?:|data:)/i.test(reference.destination)) return null
    const attachment = attachmentFor(reference.destination, attachments)
    return attachment ? `<${encodeMarkdownImageTarget(attachment.relativePath)}>` : null
  })
}
