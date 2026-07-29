import { isMap, parseDocument } from 'yaml'

export interface VaultFrontmatter {
  aliases: string[]
  body: string
  endOffset: number
  hasFrontmatter: boolean
  kuskusId: string | null
  kuskusType: string | null
  kuskusUrl: string | null
  userPropertyCount: number
}

const OPENING = /^---[\t ]*\r?\n/
const CLOSING = /^---[\t ]*$/m

function scalarString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function readVaultFrontmatter(source: string): VaultFrontmatter {
  const opening = source.match(OPENING)
  if (!opening) {
    return {
      aliases: [],
      body: source,
      endOffset: 0,
      hasFrontmatter: false,
      kuskusId: null,
      kuskusType: null,
      kuskusUrl: null,
      userPropertyCount: 0
    }
  }

  const remainder = source.slice(opening[0].length)
  const closing = remainder.match(CLOSING)
  if (!closing || closing.index === undefined) {
    throw new Error('The Markdown frontmatter is missing its closing delimiter.')
  }

  const yamlSource = remainder.slice(0, closing.index)
  const document = parseDocument(yamlSource, { prettyErrors: true, uniqueKeys: true })
  if (document.errors.length > 0) {
    throw new Error(`The Markdown frontmatter is invalid: ${document.errors[0].message}`)
  }
  const value = document.toJS() as Record<string, unknown> | null
  const kuskusId = scalarString(value?.['kuskus-id'])
  const kuskusType = scalarString(value?.['kuskus-type'])
  const kuskusUrl = scalarString(value?.url)
  const rawAliases = value?.aliases
  const aliases = Array.isArray(rawAliases)
    ? rawAliases.filter((entry): entry is string => typeof entry === 'string')
    : typeof rawAliases === 'string'
      ? [rawAliases]
      : []
  const closingLength = closing[0].length
  const afterClosing = opening[0].length + closing.index + closingLength
  const newline = source.slice(afterClosing).match(/^\r?\n/)?.[0] ?? ''
  const endOffset = afterClosing + newline.length

  return {
    aliases,
    body: source.slice(endOffset),
    endOffset,
    hasFrontmatter: true,
    kuskusId,
    kuskusType,
    kuskusUrl,
    userPropertyCount: Object.keys(value ?? {}).filter(
      (key) => !['kuskus-id', 'kuskus-type', 'url'].includes(key)
    ).length
  }
}

export function stripVaultFrontmatter(source: string): string {
  try {
    return readVaultFrontmatter(source).body
  } catch {
    return source
  }
}

export function removeKuskusFrontmatter(source: string, removeLinkFields = false): string {
  const opening = source.match(OPENING)
  if (!opening) return source
  const remainder = source.slice(opening[0].length)
  const closing = remainder.match(CLOSING)
  if (!closing || closing.index === undefined) return source
  const yamlSource = remainder.slice(0, closing.index)
  const document = parseDocument(yamlSource, { prettyErrors: true, uniqueKeys: true })
  if (document.errors.length > 0) {
    throw new Error(`The Markdown frontmatter is invalid: ${document.errors[0].message}`)
  }
  const ranges = (isMap(document.contents) ? document.contents.items : [])
    .filter((pair) => {
      const key = String(pair.key?.toJSON() ?? '')
      return key === 'kuskus-id' || (removeLinkFields && ['kuskus-type', 'url'].includes(key))
    })
    .map((pair): [number, number, number] | null => {
      const start = pair.key?.range?.[0]
      const end = pair.value?.range?.[2] ?? pair.key?.range?.[2]
      return typeof start === 'number' && typeof end === 'number' ? [start, end, end] : null
    })
    .filter((range): range is [number, number, number] => range !== null)
    .sort((a, b) => b[0] - a[0])
  if (!ranges?.length) return source
  let cleanedYaml = yamlSource
  for (const range of ranges) {
    let start = range[0]
    let end = range[2]
    while (end < cleanedYaml.length && (cleanedYaml[end] === '\r' || cleanedYaml[end] === '\n'))
      end += 1
    if (start > 0 && cleanedYaml[start - 1] === '\n' && end === cleanedYaml.length) start -= 1
    cleanedYaml = `${cleanedYaml.slice(0, start)}${cleanedYaml.slice(end)}`
  }
  const afterClosing = opening[0].length + closing.index + closing[0].length
  const trailingNewline = source.slice(afterClosing).match(/^\r?\n/)?.[0] ?? ''
  const body = source.slice(afterClosing + trailingNewline.length)
  if (!cleanedYaml.trim()) return body
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const yamlWithClosingBreak = cleanedYaml.endsWith('\n')
    ? cleanedYaml
    : cleanedYaml.endsWith('\r')
      ? `${cleanedYaml}\n`
      : `${cleanedYaml}${newline}`
  return `${opening[0]}${yamlWithClosingBreak}${closing[0]}${trailingNewline}${body}`
}

export function extractVaultReferences(source: string): string[] {
  const body = stripVaultFrontmatter(source)
  const references = new Set<string>()
  for (const match of body.matchAll(
    /!\[\[[^\]]*?([^\]|#]+\.[A-Za-z0-9]{1,12})(?:[|#][^\]]*)?\]\]/g
  )) {
    references.add(match[1].trim().replace(/\\/g, '/'))
  }
  for (const match of body.matchAll(/!\[[^\]]*\]\((?!https?:|data:)([^)]+)\)/gi)) {
    const target = match[1].trim().replace(/^<|>$/g, '').split(/[?#]/, 1)[0].replace(/\\/g, '/')
    if (target) references.add(decodeURIComponent(target))
  }
  return [...references]
}
