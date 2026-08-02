import { dirname, relative, resolve } from 'node:path'

import { isMap, parseDocument } from 'yaml'

import {
  normalizeMarkdownImageTarget,
  parseMarkdownImageReferences,
  rewriteMarkdownImageDestinations
} from '../../shared/markdown-image-references'

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

export interface VaultReferenceTarget {
  kind: 'markdown' | 'wikilink'
  target: string
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

export function extractVaultReferenceTargets(source: string): VaultReferenceTarget[] {
  const body = stripVaultFrontmatter(source)
  const references = new Map<string, VaultReferenceTarget>()
  for (const match of body.matchAll(
    /!\[\[[^\]]*?([^\]|#]+\.[A-Za-z0-9]{1,12})(?:[|#][^\]]*)?\]\]/g
  )) {
    const target = match[1].trim().replace(/\\/g, '/')
    references.set(`wikilink:${target}`, { kind: 'wikilink', target })
  }
  for (const reference of parseMarkdownImageReferences(body)) {
    if (/^(?:https?:|data:)/i.test(reference.destination)) continue
    const target = normalizeMarkdownImageTarget(reference.destination)
    if (target) references.set(`markdown:${target}`, { kind: 'markdown', target })
  }
  return [...references.values()]
}

export function extractVaultReferences(source: string): string[] {
  return extractVaultReferenceTargets(source).map((reference) => reference.target)
}

export function resolveVaultReferencePath(
  reference: VaultReferenceTarget,
  sourceNotePath: string,
  libraryPath: string,
  availablePaths: Iterable<string> = []
): string {
  const target = reference.target.replace(/\\/g, '/')
  if (reference.kind === 'markdown') {
    return target.startsWith('/')
      ? resolve(libraryPath, target.replace(/^\/+/, ''))
      : resolve(dirname(sourceNotePath), target)
  }
  if (target.startsWith('./') || target.startsWith('../')) {
    return resolve(dirname(sourceNotePath), target)
  }

  const normalizedAvailable = [...availablePaths].map((path) => resolve(path))
  const vaultCandidate = resolve(libraryPath, target.replace(/^\/+/, ''))
  if (
    normalizedAvailable.some(
      (path) => path.toLocaleLowerCase() === vaultCandidate.toLocaleLowerCase()
    )
  ) {
    return vaultCandidate
  }
  const siblingCandidate = resolve(dirname(sourceNotePath), target)
  if (
    normalizedAvailable.some(
      (path) => path.toLocaleLowerCase() === siblingCandidate.toLocaleLowerCase()
    )
  ) {
    return siblingCandidate
  }
  const suffix = `/${target.toLocaleLowerCase()}`
  const matches = normalizedAvailable.filter((path) =>
    path.replace(/\\/g, '/').toLocaleLowerCase().endsWith(suffix)
  )
  return matches.length === 1 ? matches[0] : vaultCandidate
}

function encodedRelativePath(fromFile: string, toFile: string): string {
  const value = relative(dirname(fromFile), toFile).replace(/\\/g, '/')
  const portable = value.startsWith('.') ? value : `./${value}`
  return portable
    .split('/')
    .map((segment) =>
      segment === '.' || segment === '..'
        ? segment
        : encodeURIComponent(segment).replace(
            /[!'()*]/g,
            (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
          )
    )
    .join('/')
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function rewriteVaultReferences(
  source: string,
  sourceNotePath: string,
  destinationNotePath: string,
  libraryPath: string,
  replacements: ReadonlyMap<string, string>
): string {
  const normalized = new Map(
    [...replacements].map(([from, to]) => [resolve(from).toLocaleLowerCase(), resolve(to)])
  )
  const replaceTarget = (target: string, wikilink: boolean): string | null => {
    const decoded = safeDecodeURIComponent(target.replace(/^<|>$/g, '').split(/[?#]/, 1)[0])
    const absolute = resolveVaultReferencePath(
      { kind: wikilink ? 'wikilink' : 'markdown', target: decoded },
      sourceNotePath,
      libraryPath,
      normalized.keys()
    )
    const replacement = normalized.get(absolute.toLocaleLowerCase())
    if (!replacement) return null
    return wikilink
      ? relative(resolve(libraryPath), replacement).replace(/\\/g, '/')
      : encodedRelativePath(destinationNotePath, replacement)
  }
  let next = source.replace(/!\[\[([^\]]+?)\]\]/g, (match, body: string) => {
    const separator = body.search(/[|#]/)
    const target = separator < 0 ? body : body.slice(0, separator)
    const suffix = separator < 0 ? '' : body.slice(separator)
    const replacement = replaceTarget(target.trim(), true)
    return replacement ? `![[${replacement}${suffix}]]` : match
  })
  next = rewriteMarkdownImageDestinations(next, (reference) => {
    if (/^(?:https?:|data:)/i.test(reference.destination)) return null
    return replaceTarget(reference.destination, false)
  })
  return next
}
