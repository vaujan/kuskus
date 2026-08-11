import { isMap, parseDocument, Scalar, type Node } from 'yaml'

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

export type NotePropertyEdit =
  | { type: 'set'; key: string; value: unknown }
  | { type: 'rename'; key: string; nextKey: string }
  | { type: 'delete'; key: string }
  | { type: 'add' }

export interface NotePropertyEditResult {
  ok: boolean
  value: string
  key?: string
  error?: string
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

function frontmatterParts(source: string):
  | { status: 'none' }
  | { status: 'invalid'; error: string; endOffset: number | null }
  | {
      status: 'valid'
      opening: string
      closing: string
      yaml: string
      endOffset: number
      newline: '\n' | '\r\n'
    } {
  const opening = source.match(OPENING)
  if (!opening) return { status: 'none' }
  const remainder = source.slice(opening[0].length)
  const closing = remainder.match(CLOSING)
  if (!closing || closing.index === undefined) {
    return {
      status: 'invalid',
      error: 'The Markdown frontmatter is missing its closing delimiter.',
      endOffset: null
    }
  }
  const closingStart = opening[0].length + closing.index
  const afterClosing = closingStart + closing[0].length
  const trailingNewline = source.slice(afterClosing).match(/^\r?\n/)?.[0] ?? ''
  return {
    status: 'valid',
    opening: opening[0],
    closing: closing[0],
    yaml: source.slice(opening[0].length, closingStart),
    endOffset: afterClosing + trailingNewline.length,
    newline: source.includes('\r\n') ? '\r\n' : '\n'
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

export function parseNoteFrontmatter(source: string): NoteFrontmatter {
  const parts = frontmatterParts(source)
  if (parts.status !== 'valid') return parts
  const document = parseDocument<Node>(parts.yaml, { prettyErrors: true, uniqueKeys: true })
  if (document.errors.length > 0) {
    return {
      status: 'invalid',
      error: `The Markdown frontmatter is invalid: ${document.errors[0].message}`,
      endOffset: parts.endOffset
    }
  }
  if (document.contents !== null && !isMap(document.contents)) {
    return {
      status: 'invalid',
      error: 'The Markdown frontmatter must be a map of property names and values.',
      endOffset: parts.endOffset
    }
  }
  if (!document.contents) {
    return { status: 'valid', endOffset: parts.endOffset, properties: [] }
  }
  const properties: NoteProperty[] = []
  for (const pair of document.contents.items) {
    const key = nodeJson(pair.key)
    if (typeof key !== 'string' || !key.trim()) {
      return {
        status: 'invalid',
        error: 'Every frontmatter property must have a non-empty text name.',
        endOffset: parts.endOffset
      }
    }
    const value = nodeJson(pair.value) ?? null
    properties.push({ key, type: propertyType(value), value })
  }
  return { status: 'valid', endOffset: parts.endOffset, properties }
}

function nextPropertyKey(keys: ReadonlySet<string>): string {
  if (!keys.has('property')) return 'property'
  let suffix = 2
  while (keys.has(`property ${suffix}`)) suffix += 1
  return `property ${suffix}`
}

export function editNoteFrontmatter(
  source: string,
  edit: NotePropertyEdit
): NotePropertyEditResult {
  const parts = frontmatterParts(source)
  if (parts.status !== 'valid') {
    return {
      ok: false,
      value: source,
      error: parts.status === 'none' ? 'This note has no frontmatter.' : parts.error
    }
  }
  const document = parseDocument<Node>(parts.yaml, { prettyErrors: true, uniqueKeys: true })
  if (document.errors.length > 0 || (document.contents !== null && !isMap(document.contents))) {
    return { ok: false, value: source, error: 'The frontmatter must be valid before editing.' }
  }
  if (!document.contents) document.contents = document.createNode({})
  if (!isMap(document.contents)) {
    return { ok: false, value: source, error: 'The frontmatter must be a property map.' }
  }
  const map = document.contents
  const keys = new Set(map.items.map((pair) => String(nodeJson(pair.key) ?? '')))
  let editedKey: string | undefined

  if (edit.type === 'set') {
    map.set(edit.key, edit.value)
  } else if (edit.type === 'delete') {
    map.delete(edit.key)
  } else if (edit.type === 'rename') {
    const nextKey = edit.nextKey.trim()
    if (!nextKey) return { ok: false, value: source, error: 'Property names cannot be empty.' }
    if (nextKey !== edit.key && keys.has(nextKey)) {
      return { ok: false, value: source, error: `A property named ${nextKey} already exists.` }
    }
    const pair = map.items.find((entry) => nodeJson(entry.key) === edit.key)
    if (!pair) return { ok: false, value: source, error: 'The property no longer exists.' }
    pair.key = new Scalar(nextKey)
    editedKey = nextKey
  } else {
    editedKey = nextPropertyKey(keys)
    map.add({ key: editedKey, value: '' })
  }

  let yaml = document.toString({ lineWidth: 0 }).replace(/\n$/, '')
  if (parts.newline === '\r\n') yaml = yaml.replace(/\n/g, '\r\n')
  const body = source.slice(parts.endOffset)
  const trailing = body ? parts.newline : ''
  return {
    ok: true,
    value: `${parts.opening}${yaml}${parts.newline}${parts.closing}${trailing}${body}`,
    key: editedKey
  }
}

export function valueForNotePropertyType(type: NotePropertyType, value: unknown): unknown {
  switch (type) {
    case 'text':
    case 'url':
      return value == null ? '' : String(value)
    case 'number': {
      const number = Number(value)
      return Number.isFinite(number) ? number : 0
    }
    case 'boolean':
      return Boolean(value)
    case 'date':
      return DATE.test(String(value ?? '')) ? String(value) : new Date().toISOString()
    case 'list':
      return Array.isArray(value) ? value : value == null ? [] : [value]
    case 'empty':
      return null
    case 'unsupported':
      return value
  }
}
