import { isMap, parseDocument, YAMLMap, type Node } from 'yaml'

export type NotePropertyType =
  'text' | 'number' | 'boolean' | 'url' | 'date' | 'list' | 'empty' | 'unsupported'

export interface NoteProperty {
  key: string
  type: NotePropertyType
  value: unknown
}

export type NoteFrontmatter =
  | { status: 'none' }
  | { status: 'invalid'; error: string; endOffset: number | null }
  | { status: 'valid'; endOffset: number; properties: NoteProperty[] }

/** The raw YAML body of a valid frontmatter block (between the `---`
 *  delimiters), plus the document offset just past the closing
 *  delimiter line. Returns null when the note has no frontmatter or
 *  the block is malformed. */
export interface NoteFrontmatterSource {
  yaml: string
  endOffset: number
}

const OPENING = /^---[\t ]*\r?\n/
const CLOSING = /^---[\t ]*$/m
const DATE = /^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-]+Z?)?$/
const URL = /^https?:\/\/\S+$/i

function nodeJson(value: unknown): unknown {
  return value &&
    typeof value === 'object' &&
    'toJSON' in value &&
    typeof value.toJSON === 'function'
    ? value.toJSON()
    : value
}

interface FrontmatterParts {
  status: 'none' | 'invalid' | 'valid'
  error: string | null
  endOffset: number | null
  yaml: string
}

function frontmatterParts(source: string): FrontmatterParts {
  const opening = source.match(OPENING)
  if (!opening) return { status: 'none', error: null, endOffset: null, yaml: '' }
  const remainder = source.slice(opening[0].length)
  const closing = remainder.match(CLOSING)
  if (!closing || closing.index === undefined) {
    return {
      status: 'invalid',
      error: 'The Markdown frontmatter is missing its closing delimiter.',
      endOffset: null,
      yaml: ''
    }
  }
  const closingStart = opening[0].length + closing.index
  const afterClosing = closingStart + closing[0].length
  const trailingNewline = source.slice(afterClosing).match(/^\r?\n/)?.[0] ?? ''
  return {
    status: 'valid',
    error: null,
    endOffset: afterClosing + trailingNewline.length,
    yaml: source.slice(opening[0].length, closingStart)
  }
}

function propertyType(value: unknown): NotePropertyType {
  if (value === null || value === undefined) return 'empty'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') {
    if (URL.test(value)) return 'url'
    if (DATE.test(value) && Number.isFinite(Date.parse(value))) return 'date'
    return 'text'
  }
  if (
    Array.isArray(value) &&
    value.every((entry) => entry === null || ['string', 'number', 'boolean'].includes(typeof entry))
  ) {
    return 'list'
  }
  return 'unsupported'
}

/** Parse the parts' YAML into a top-level map, or null when the block is
 *  not a valid property map. Empty frontmatter (`---\n---`) yields an
 *  empty map. */
function parsedMap(parts: FrontmatterParts): { map: YAMLMap; endOffset: number } | null {
  if (parts.status !== 'valid' || parts.endOffset === null) return null
  const document = parseDocument<Node>(parts.yaml, { prettyErrors: true, uniqueKeys: true })
  if (document.errors.length > 0) return null
  if (document.contents !== null && !isMap(document.contents)) return null
  const map = document.contents ?? (document.createNode({}) as YAMLMap)
  if (!isMap(map)) return null
  return { map, endOffset: parts.endOffset }
}

export function parseNoteFrontmatter(source: string): NoteFrontmatter {
  const parts = frontmatterParts(source)
  if (parts.status === 'none') return { status: 'none' }
  if (parts.status === 'invalid') {
    return {
      status: 'invalid',
      error: parts.error ?? 'The frontmatter is invalid.',
      endOffset: parts.endOffset
    }
  }
  const parsed = parsedMap(parts)
  if (!parsed) {
    return {
      status: 'invalid',
      error: 'The Markdown frontmatter must be a map of property names and values.',
      endOffset: parts.endOffset
    }
  }
  const properties: NoteProperty[] = []
  const endOffset = parsed.endOffset
  for (const pair of parsed.map.items) {
    const key = nodeJson(pair.key)
    if (typeof key !== 'string' || !key.trim()) {
      return {
        status: 'invalid',
        error: 'Every frontmatter property must have a non-empty text name.',
        endOffset
      }
    }
    const value = nodeJson(pair.value) ?? null
    properties.push({ key, type: propertyType(value), value })
  }
  return { status: 'valid', endOffset, properties }
}

/** Raw YAML body of a valid frontmatter block, or null. Used by the
 *  read-mode code block and the live header (Copy button + label). */
export function noteFrontmatterSource(source: string): NoteFrontmatterSource | null {
  const parts = frontmatterParts(source)
  const parsed = parsedMap(parts)
  if (!parsed) return null
  return { yaml: parts.yaml, endOffset: parsed.endOffset }
}
