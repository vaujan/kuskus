import { parseNoteFrontmatter } from '../../../../shared/note-frontmatter'

const CARD_SNIPPET_MAX_CHARS = 800

export function noteCardSnippet(body: string, maxLength = CARD_SNIPPET_MAX_CHARS): string {
  const frontmatter = parseNoteFrontmatter(body)
  const content = frontmatter.status === 'valid' ? body.slice(frontmatter.endOffset) : body
  const trimmed = content.trim()
  if (trimmed.length <= maxLength) return trimmed
  const head = trimmed.slice(0, maxLength)
  const boundary = head.lastIndexOf('\n')
  return boundary >= maxLength / 2 ? head.slice(0, boundary) : head
}
