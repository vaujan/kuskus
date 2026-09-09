import { parseNoteFrontmatter } from '../../../../shared/note-frontmatter'

const CARD_SNIPPET_MAX_CHARS = 800

function removeDuplicateLeadingTitle(markdown: string, title: string): string {
  const heading = markdown.match(/^#{1,6}[\t ]+(.+?)[\t ]*#*[\t ]*(?:\r?\n|$)/)
  if (!heading || heading[1].trim().toLocaleLowerCase() !== title.trim().toLocaleLowerCase()) {
    return markdown
  }
  return markdown.slice(heading[0].length).trimStart()
}

export function noteCardSnippet(
  body: string,
  title: string,
  maxLength = CARD_SNIPPET_MAX_CHARS
): string {
  const frontmatter = parseNoteFrontmatter(body)
  const content = frontmatter.status === 'valid' ? body.slice(frontmatter.endOffset) : body
  const trimmed = removeDuplicateLeadingTitle(content.trim(), title)
  if (trimmed.length <= maxLength) return trimmed
  const head = trimmed.slice(0, maxLength)
  const boundary = head.lastIndexOf('\n')
  return boundary >= maxLength / 2 ? head.slice(0, boundary) : head
}
