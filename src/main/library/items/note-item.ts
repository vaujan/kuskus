import type { NoteItemDto } from '../../../shared/library-contract'
import { NOTE_FILENAME } from '../constants'
import type { PersistedNoteItem } from '../schemas'

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

export function createNoteMetadata(
  id: string,
  markdown: string,
  timestamp: string
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
    originalCollectionId: null
  }
}

export function toNoteDto(metadata: PersistedNoteItem, body: string): NoteItemDto {
  return {
    schemaVersion: metadata.schemaVersion,
    id: metadata.id,
    type: metadata.type,
    title: metadata.title,
    body,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    missingContent: false
  }
}
