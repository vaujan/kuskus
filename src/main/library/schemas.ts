import {
  COLLECTION_ICON_KEYS,
  type CollectionDto,
  type CollectionIconKey,
  type NoteAttachmentDto,
  type SupportedImageMediaType
} from '../../shared/library-contract'
import {
  IMAGE_EXTENSIONS,
  ITEM_ID_PATTERN,
  NOTE_FILENAME,
  RESERVED_WINDOWS_NAMES
} from './constants'

export interface PersistedLibrary {
  schemaVersion: 1
  id: string
  name: string
  createdAt: string
}

export interface PersistedCollection {
  schemaVersion: 1
  id: string
  name: string
  icon?: CollectionIconKey
  createdAt: string
}

const COLLECTION_ICON_KEY_SET = new Set<string>(COLLECTION_ICON_KEYS)

export function isCollectionIconKey(value: unknown): value is CollectionIconKey {
  return typeof value === 'string' && COLLECTION_ICON_KEY_SET.has(value)
}

export function toCollectionDto(collection: PersistedCollection): CollectionDto {
  return { ...collection, icon: collection.icon ?? 'folder' }
}

export interface PersistedNoteItem {
  schemaVersion: 1
  id: string
  type: 'note'
  title: string
  createdAt: string
  updatedAt: string
  sourceUrl: null
  sourceFilename: null
  contentFilename: 'note.md'
  note: ''
  originalCollectionId: null
  attachments?: PersistedNoteAttachment[]
}

export type PersistedNoteAttachment = Omit<NoteAttachmentDto, 'missingContent'>

export function isPersistedNoteAttachment(value: unknown): value is PersistedNoteAttachment {
  if (!value || typeof value !== 'object') return false
  const attachment = value as Record<string, unknown>
  const filename = attachment.filename
  return (
    typeof attachment.id === 'string' &&
    ITEM_ID_PATTERN.test(attachment.id) &&
    typeof filename === 'string' &&
    filename.length > 0 &&
    filename.length <= 255 &&
    /^[^\\/:*?"<>|]+$/.test(filename) &&
    filename !== '.' &&
    filename !== '..' &&
    !/[. ]$/.test(filename) &&
    !RESERVED_WINDOWS_NAMES.test(filename) &&
    attachment.relativePath === `./assets/${filename}` &&
    (attachment.sourceFilename === null || typeof attachment.sourceFilename === 'string') &&
    typeof attachment.mediaType === 'string' &&
    attachment.mediaType in IMAGE_EXTENSIONS &&
    Number.isSafeInteger(attachment.width) &&
    Number(attachment.width) > 0 &&
    Number.isSafeInteger(attachment.height) &&
    Number(attachment.height) > 0
  )
}

export interface PersistedImageItem {
  schemaVersion: 1
  id: string
  type: 'image'
  title: string
  createdAt: string
  updatedAt: string
  sourceUrl: null
  sourceFilename: string | null
  contentFilename: string
  mediaType: SupportedImageMediaType
  width: number
  height: number
  note: ''
  originalCollectionId: null
}

export interface PersistedUrlItem {
  schemaVersion: 1
  id: string
  type: 'url'
  title: string
  createdAt: string
  updatedAt: string
  sourceUrl: string
  sourceFilename: null
  contentFilename: null
  domain: string
  description: string | null
  faviconUrl: string | null
  previewImageUrl: string | null
  metadataStatus: 'pending' | 'ready' | 'unavailable'
  metadataError: string | null
  note: ''
  originalCollectionId: null
}

export type PersistedItem = PersistedNoteItem | PersistedImageItem | PersistedUrlItem

export interface PersistedSettings {
  schemaVersion: 1
  lastLibraryPath: string | null
}

export function isPersistedLibrary(value: unknown): value is PersistedLibrary {
  if (!value || typeof value !== 'object') return false
  const library = value as Record<string, unknown>
  return (
    library.schemaVersion === 1 &&
    typeof library.id === 'string' &&
    typeof library.name === 'string' &&
    typeof library.createdAt === 'string'
  )
}

export function parsePersistedCollection(
  value: unknown,
  collectionId: string
): PersistedCollection | null {
  if (!value || typeof value !== 'object') return null
  const collection = value as Record<string, unknown>
  if (
    collection.schemaVersion !== 1 ||
    collection.id !== collectionId ||
    typeof collection.name !== 'string' ||
    typeof collection.createdAt !== 'string'
  ) {
    return null
  }
  return {
    schemaVersion: 1,
    id: collection.id,
    name: collection.name,
    createdAt: collection.createdAt,
    ...(isCollectionIconKey(collection.icon) ? { icon: collection.icon } : {})
  }
}

export function isPersistedItem(value: unknown, itemId: string): value is PersistedItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  if (
    item.schemaVersion !== 1 ||
    item.id !== itemId ||
    typeof item.title !== 'string' ||
    typeof item.createdAt !== 'string' ||
    typeof item.updatedAt !== 'string'
  ) {
    return false
  }

  if (item.type === 'note') {
    return (
      item.contentFilename === NOTE_FILENAME &&
      (item.attachments === undefined ||
        (Array.isArray(item.attachments) && item.attachments.every(isPersistedNoteAttachment)))
    )
  }
  if (item.type === 'url') {
    return (
      item.contentFilename === null &&
      typeof item.sourceUrl === 'string' &&
      typeof item.domain === 'string' &&
      (item.description === null || typeof item.description === 'string') &&
      (item.faviconUrl === null || typeof item.faviconUrl === 'string') &&
      (item.previewImageUrl === null || typeof item.previewImageUrl === 'string') &&
      ['pending', 'ready', 'unavailable'].includes(String(item.metadataStatus)) &&
      (item.metadataError === null || typeof item.metadataError === 'string')
    )
  }
  if (item.type !== 'image' || typeof item.mediaType !== 'string') return false
  if (!(item.mediaType in IMAGE_EXTENSIONS)) return false

  const mediaType = item.mediaType as SupportedImageMediaType
  return (
    item.contentFilename === `image.${IMAGE_EXTENSIONS[mediaType]}` &&
    (typeof item.sourceFilename === 'string' || item.sourceFilename === null) &&
    typeof item.width === 'number' &&
    Number.isSafeInteger(item.width) &&
    item.width > 0 &&
    typeof item.height === 'number' &&
    Number.isSafeInteger(item.height) &&
    item.height > 0
  )
}
