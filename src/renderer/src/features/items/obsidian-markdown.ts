import type { NoteAttachmentDto } from '../../../../shared/library-contract'
import {
  encodeMarkdownImageTarget,
  markdownImageTargetKey,
  rewriteMarkdownImageDestinations
} from '../../../../shared/markdown-image-references'

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
  const source = stripFrontmatter(value)
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
