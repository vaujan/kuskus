import type { NoteItemDto } from '../../../shared/library-contract'
import { IMAGE_EXTENSIONS, NOTE_FILENAME, RESERVED_WINDOWS_NAMES } from '../constants'
import type { PersistedNoteItem } from '../schemas'
import type { DetectedImage } from './image-item'

export function deriveNoteTitle(markdown: string): string {
  const firstLine = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
  if (!firstLine) return 'Untitled note'

  const cleaned = firstLine
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[>*_`~-]+\s*/, '')
    .replace(/[*_`~]/g, '')
    .trim()
  return (cleaned || 'Untitled note').slice(0, 120)
}

export function noteAttachmentFilename(
  sourceFilename: string | null,
  detected: DetectedImage,
  existingFilenames: ReadonlySet<string>
): string {
  const extension = IMAGE_EXTENSIONS[detected.mediaType]
  const requestedBase = (sourceFilename ?? 'pasted-image')
    .replace(/\.[^.]+$/, '')
    .replace(/[\\/:*?"<>|]/g, '_')
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
    schemaVersion: 1,
    id,
    type: 'note',
    title: deriveNoteTitle(markdown),
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
    title: deriveNoteTitle(markdown),
    updatedAt: timestamp
  }
}

export function toNoteDto(
  metadata: PersistedNoteItem,
  body: string,
  attachments: NoteItemDto['attachments'] = []
): NoteItemDto {
  return {
    schemaVersion: metadata.schemaVersion,
    id: metadata.id,
    type: metadata.type,
    title: metadata.title,
    body,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    missingContent: false,
    attachments
  }
}
