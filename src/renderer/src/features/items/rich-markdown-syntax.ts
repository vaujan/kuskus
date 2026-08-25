const WIKILINK = /(!?)\[\[([^\]|\n]+?)(?:\|([^\]\n]+))?\]\]/g
const RICH_LINK = /(!?)\[([^\]\n]*)\]\(kuskus-(wiki|embed):([^\s)]+)\)/g
const RAW_HTML = /<\/?[A-Za-z][^>]*>/
const HTML_BREAK = /<br\s*\/?>/gi
// CommonMark autolinks: <scheme:...> and <email@domain>. Milkdown round-trips
// these byte-identically, so they must not be mistaken for raw HTML.
const AUTOLINK =
  /<(?:[a-z][a-z0-9+.-]*:[^>\s<>]+|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*)>/gi

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

export function supportsRichMarkdown(value: string): boolean {
  let supported = true
  transformProse(value, (prose) => {
    if (RAW_HTML.test(prose.replace(AUTOLINK, ''))) supported = false
    return prose
  })
  return supported
}

export function prepareRichMarkdown(value: string): string {
  return transformProse(value, (prose) =>
    prose.replace(WIKILINK, (_match, bang: string, rawTarget: string, rawAlias?: string) => {
      const target = rawTarget.trim()
      const alias = rawAlias?.trim() || target
      const kind = bang ? 'embed' : 'wiki'
      const encodedTarget = encodeURIComponent(target).replace(
        /[()]/g,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
      )
      return `${bang}[${alias}](kuskus-${kind}:${encodedTarget})`
    })
  )
}

export function restoreRichMarkdown(value: string): string {
  const restored = transformProse(value, (prose) =>
    prose.replace(
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
  )
  const trimmed = restored.trim()
  if (/^<https?:\/\/[^\s<>]+>$/.test(trimmed)) {
    return restored.replace(trimmed, trimmed.slice(1, -1))
  }
  return restored
}
