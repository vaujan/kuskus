import { dirname, relative, resolve } from 'node:path'

import { parseDocument } from 'yaml'

import {
  encodeMarkdownPath,
  normalizeMarkdownImageTarget,
  parseMarkdownImageReferences,
  rewriteMarkdownImageDestinations
} from '../../shared/markdown-image-references'

export interface VaultFrontmatter {
  aliases: string[]
  body: string
  endOffset: number
  hasFrontmatter: boolean
}

export interface VaultReferenceTarget {
  kind: 'markdown' | 'wikilink'
  target: string
}

const OPENING = /^---[\t ]*\r?\n/
const CLOSING = /^---[\t ]*$/m

export function readVaultFrontmatter(source: string): VaultFrontmatter {
  const opening = source.match(OPENING)
  if (!opening) {
    return {
      aliases: [],
      body: source,
      endOffset: 0,
      hasFrontmatter: false
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
    hasFrontmatter: true
  }
}

export function stripVaultFrontmatter(source: string): string {
  try {
    return readVaultFrontmatter(source).body
  } catch {
    return source
  }
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
  return encodeMarkdownPath(portable)
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
