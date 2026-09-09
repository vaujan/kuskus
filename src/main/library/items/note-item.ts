import { basename, extname } from 'node:path'

import type { ItemLocation, NoteItemDto } from '../../../shared/library-contract'
import {
  normalizeMarkdownImageTarget,
  parseMarkdownImageReferences
} from '../../../shared/markdown-image-references'
import { IMAGE_EXTENSIONS, NOTE_FILENAME, RESERVED_WINDOWS_NAMES } from '../constants'
import type { PersistedNoteItem } from '../schemas'
import { stripVaultFrontmatter } from '../vault-frontmatter'
import type { DetectedImage } from './image-item'

interface EmbeddedImage {
  start: number
  end: number
  target: string | null
}

const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g
const OBSIDIAN_EMBED_PATTERN = /!\[\[([^\]]+?)\]\]/g
const REFERENCE_IMAGE_PATTERN = /!\[[^\]]*\]\[[^\]]*\]/g
const INCOMPLETE_IMAGE_PATTERN = /!\[[^\]]*\](?:\([^)]*)?/g
const FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})(?:\s*.*)?$/
const TABLE_SEPARATOR_PATTERN = /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/
const THEMATIC_BREAK_PATTERN = /^(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/
const REFERENCE_DEFINITION_PATTERN = /^\[[^\]]+\]:\s*\S+/
const READABLE_CHARACTER_PATTERN = /[\p{L}\p{N}\p{Extended_Pictographic}]/u

function embeddedImages(markdown: string): EmbeddedImage[] {
  const images: EmbeddedImage[] = parseMarkdownImageReferences(markdown).map((reference) => ({
    start: reference.start,
    end: reference.end,
    target: reference.destination
  }))
  for (const match of markdown.matchAll(OBSIDIAN_EMBED_PATTERN)) {
    if (match.index === undefined) continue
    const separator = match[1].search(/[|#]/)
    images.push({
      start: match.index,
      end: match.index + match[0].length,
      target: (separator < 0 ? match[1] : match[1].slice(0, separator)).trim() || null
    })
  }
  return images.sort((left, right) => left.start - right.start)
}

function withoutEmbeddedImages(markdown: string, images: readonly EmbeddedImage[]): string {
  let result = markdown
  for (const image of [...images].sort((left, right) => right.start - left.start)) {
    result = `${result.slice(0, image.start)}${result.slice(image.end)}`
  }
  return result.replace(REFERENCE_IMAGE_PATTERN, '').replace(INCOMPLETE_IMAGE_PATTERN, '')
}

function readableMarkdownLine(line: string): string {
  const trimmed = line.trim()
  if (
    !trimmed ||
    TABLE_SEPARATOR_PATTERN.test(trimmed) ||
    THEMATIC_BREAK_PATTERN.test(trimmed) ||
    REFERENCE_DEFINITION_PATTERN.test(trimmed)
  ) {
    return ''
  }

  const cleaned = trimmed
    .replace(/^(?:>\s*)+/, '')
    .replace(/^#{1,6}(?:\s+|$)/, '')
    .replace(/^(?:[-+*]|\d+[.)])\s+/, '')
    .replace(/^\[[ xX]\]\s+/, '')
    .replace(/!\[\[[^\]]*\]\]/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\((?:[^()]|\([^()]*\))*\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    .replace(/<((?:https?:\/\/|mailto:)[^>]+)>/gi, '$1')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/`+/g, '')
    .replace(/[*_~]+/g, '')
    .replace(/\\([\\`*{}[\]()#+\-.!_>~])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return READABLE_CHARACTER_PATTERN.test(cleaned) ? cleaned : ''
}

function firstReadableLine(markdown: string): string | null {
  let fence: { marker: string; length: number } | null = null
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim()
    const fenceMatch = trimmed.match(FENCE_PATTERN)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (!fence) fence = { marker, length: fenceMatch[1].length }
      else if (marker === fence.marker && fenceMatch[1].length >= fence.length) fence = null
      continue
    }
    if (fence) {
      if (READABLE_CHARACTER_PATTERN.test(trimmed)) return trimmed
      continue
    }
    const readable = readableMarkdownLine(line)
    if (readable) return readable
  }
  return null
}

function imageTitleFallback(images: readonly EmbeddedImage[]): string | null {
  for (const image of images) {
    if (!image.target || /^(?:data:|https?:)/i.test(image.target)) continue
    const target = normalizeMarkdownImageTarget(image.target)
    const filename = basename(target)
    const stem = filename.slice(0, filename.length - extname(filename).length).trim()
    if (stem && stem !== '.' && stem !== '..' && READABLE_CHARACTER_PATTERN.test(stem)) return stem
  }
  return null
}

export function deriveNoteTitle(markdown: string): string {
  const body = stripVaultFrontmatter(markdown).replace(HTML_COMMENT_PATTERN, '')
  const images = embeddedImages(body)
  const title = firstReadableLine(withoutEmbeddedImages(body, images)) ?? imageTitleFallback(images)
  return (title || 'Untitled note').slice(0, 120)
}

export function noteAttachmentFilename(
  sourceFilename: string | null,
  detected: DetectedImage,
  existingFilenames: ReadonlySet<string>,
  fallbackBase = 'pasted-image'
): string {
  const extension = IMAGE_EXTENSIONS[detected.mediaType]
  const requestedBase = (sourceFilename ?? fallbackBase)
    .replace(/\.[^.]+$/, '')
    .replace(/[\\/:*?"<>|()[\]#%]/g, '_')
    .replace(/\.+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
  const base =
    !requestedBase || RESERVED_WINDOWS_NAMES.test(requestedBase) ? 'image' : requestedBase
  let filename = `${base}.${extension}`
  let suffix = 2
  while (existingFilenames.has(filename.toLocaleLowerCase())) {
    filename = `${base}-${suffix}.${extension}`
    suffix += 1
  }
  return filename
}

export function createNoteMetadata(
  id: string,
  markdown: string,
  timestamp: string,
  attachments: PersistedNoteItem['attachments'] = []
): PersistedNoteItem {
  return {
    schemaVersion: 2,
    id,
    type: 'note',
    title: deriveNoteTitle(markdown),
    titleSource: 'derived',
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceUrl: null,
    sourceFilename: null,
    contentFilename: NOTE_FILENAME,
    note: '',
    originalCollectionId: null,
    ...(attachments.length > 0 ? { attachments } : {})
  }
}

export function updateNoteMetadata(
  metadata: PersistedNoteItem,
  markdown: string,
  timestamp: string
): PersistedNoteItem {
  return {
    ...metadata,
    title: metadata.titleSource === 'custom' ? metadata.title : deriveNoteTitle(markdown),
    titleSource: metadata.titleSource === 'custom' ? 'custom' : 'derived',
    updatedAt: timestamp
  }
}

export function toNoteDto(
  metadata: PersistedNoteItem,
  body: string,
  attachments: NoteItemDto['attachments'] = [],
  location: ItemLocation = { type: 'inbox' }
): NoteItemDto {
  return {
    schemaVersion: metadata.schemaVersion,
    id: metadata.id,
    type: metadata.type,
    title: metadata.title,
    titleSource: metadata.titleSource === 'custom' ? 'custom' : 'derived',
    body,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    missingContent: false,
    attachments,
    location,
    relativePath: metadata.relativePath ?? metadata.contentFilename,
    referencedAttachment: false
  }
}
