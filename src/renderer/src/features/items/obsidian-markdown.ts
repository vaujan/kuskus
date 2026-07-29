import type { NoteAttachmentDto } from '../../../../shared/library-contract'

function stripFrontmatter(value: string): string {
  if (!/^---[\t ]*\r?\n/.test(value)) return value
  const match = /^---[\t ]*\r?\n[\s\S]*?\r?\n---[\t ]*(?:\r?\n|$)/.exec(value)
  return match ? value.slice(match[0].length) : value
}

function attachmentFor(
  target: string,
  attachments: NoteAttachmentDto[]
): NoteAttachmentDto | undefined {
  const normalized = decodeURIComponent(target).replace(/\\/g, '/').replace(/^\.\//, '')
  return attachments.find((attachment) => {
    const path = attachment.relativePath.replace(/\\/g, '/').replace(/^\.\//, '')
    return (
      path.toLocaleLowerCase() === normalized.toLocaleLowerCase() ||
      attachment.filename.toLocaleLowerCase() === normalized.toLocaleLowerCase()
    )
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
        return `![${rawLabel?.trim() || attachment.filename}](${attachment.relativePath})`
      }
      const label = rawLabel?.trim() || target
      return `[Embedded note: ${label}](kuskus-note:${encodeURIComponent(target)})`
    }
  )
  return withEmbeds.replace(
    /(?<!!)\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
    (_match, rawTarget: string, rawLabel?: string) => {
      const target = rawTarget.trim()
      const label = rawLabel?.trim() || target
      return `[${label}](kuskus-note:${encodeURIComponent(target)})`
    }
  )
}
