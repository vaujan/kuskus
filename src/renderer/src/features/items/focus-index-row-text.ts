import type { LibraryItemDto } from '../../../../shared/library-contract'

function plainMarkdown(markdown: string): string {
  return markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!\[\[[^\]]+\]\]/g, ' ')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gm, '')
    .replace(/^\s*\[[ xX]\]\s+/gm, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`*_~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function focusIndexSupportingText(item: LibraryItemDto): string {
  if (item.type === 'note') {
    const text = plainMarkdown(item.body)
    const title = item.title.trim()
    const normalizedText = text.toLocaleLowerCase()
    const normalizedTitle = title.toLocaleLowerCase()
    return normalizedText === normalizedTitle || normalizedText.startsWith(`${normalizedTitle} `)
      ? text.slice(title.length).trim()
      : text
  }
  if (item.type === 'url') return item.description?.trim() || item.sourceUrl
  if (item.type === 'image') return item.sourceFilename || item.contentFilename
  return item.sourceFilename || item.contentFilename
}
