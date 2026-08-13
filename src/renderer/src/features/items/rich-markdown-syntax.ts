const WIKILINK = /(!?)\[\[([^\]|\n]+?)(?:\|([^\]\n]+))?\]\]/g
const RICH_LINK = /(!?)\[([^\]\n]*)\]\(kuskus-(wiki|embed):([^\s)]+)\)/g
const RAW_HTML = /<\/?[A-Za-z][^>]*>/
const HTML_BREAK = /<br\s*\/?>/gi

export function supportsRichMarkdown(value: string): boolean {
  return !RAW_HTML.test(value.replace(HTML_BREAK, ''))
}

export function prepareRichMarkdown(value: string): string {
  return value
    .replace(HTML_BREAK, '  \n')
    .replace(WIKILINK, (_match, bang: string, rawTarget: string, rawAlias?: string) => {
      const target = rawTarget.trim()
      const alias = rawAlias?.trim() || target
      const kind = bang ? 'embed' : 'wiki'
      const encodedTarget = encodeURIComponent(target).replace(
        /[()]/g,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
      )
      return `${bang}[${alias}](kuskus-${kind}:${encodedTarget})`
    })
}

export function restoreRichMarkdown(value: string): string {
  const restored = value.replace(
    RICH_LINK,
    (_match, bang: string, rawAlias: string, kind: string, encodedTarget: string) => {
      let target: string
      try {
        target = decodeURIComponent(encodedTarget)
      } catch {
        return _match
      }
      const alias = rawAlias.replace(/\\([\\[\]])/g, '$1')
      return `${bang || kind === 'embed' ? '!' : ''}[[${target}${alias === target ? '' : `|${alias}`}]]`
    }
  )
  const trimmed = restored.trim()
  if (/^<https?:\/\/[^\s<>]+>$/.test(trimmed)) {
    return restored.replace(trimmed, trimmed.slice(1, -1))
  }
  return restored
}
