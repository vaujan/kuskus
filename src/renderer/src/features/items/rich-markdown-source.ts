import { parseNoteFrontmatter } from '../../../../shared/note-frontmatter'

export interface RichMarkdownSource {
  prefix: string
  body: string
}

export function partitionRichMarkdownSource(value: string): RichMarkdownSource | null {
  const frontmatter = parseNoteFrontmatter(value)
  if (frontmatter.status === 'invalid') return null
  const bodyOffset = frontmatter.status === 'valid' ? frontmatter.endOffset : 0
  return { prefix: value.slice(0, bodyOffset), body: value.slice(bodyOffset) }
}
