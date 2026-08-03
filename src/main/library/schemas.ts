import {
  COLLECTION_ICON_KEYS,
  type CollectionDto,
  type CollectionIconKey,
  type NoteAttachmentDto,
  type SupportedImageMediaType
} from '../../shared/library-contract'
import { IMAGE_EXTENSIONS, ITEM_ID_PATTERN, RESERVED_WINDOWS_NAMES } from './constants'

export interface PersistedLibrary {
  schemaVersion: 1 | 2
  id: string
  name: string
  createdAt: string
}

export interface PersistedCollection {
  schemaVersion: 1 | 2
  id: string
  name: string
  icon?: CollectionIconKey
  createdAt: string
  relativePath?: string
  parentId?: string | null
}

const COLLECTION_ICON_KEY_SET = new Set<string>(COLLECTION_ICON_KEYS)

export function isCollectionIconKey(value: unknown): value is CollectionIconKey {
  return typeof value === 'string' && COLLECTION_ICON_KEY_SET.has(value)
}

export function toCollectionDto(collection: PersistedCollection): CollectionDto {
  return {
    ...collection,
    icon: collection.icon ?? 'folder',
    relativePath: collection.relativePath ?? collection.name,
    parentId: collection.parentId ?? null
  }
}

export interface PersistedNoteItem {
  schemaVersion: 1 | 2
  id: string
  type: 'note'
  title: string
  createdAt: string
  updatedAt: string
  sourceUrl: null
  sourceFilename: null
  contentFilename: 'note.md'
  note: ''
  originalCollectionId: string | null
  titleSource?: 'derived' | 'custom'
  trashedFrom?: 'inbox' | 'collection' | 'archive'
  trashedFromRelativePath?: string
  attachments?: PersistedNoteAttachment[]
  relativePath?: string
  referencedAttachment?: false
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
    typeof attachment.relativePath === 'string' &&
    attachment.relativePath.length > 2 &&
    attachment.relativePath.length <= 1024 &&
    /^(?:\.\/|(?:\.\.\/)+)[^\\\0]+$/.test(attachment.relativePath) &&
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
  schemaVersion: 1 | 2
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
  originalCollectionId: string | null
  titleSource?: 'derived' | 'custom'
  trashedFrom?: 'inbox' | 'collection' | 'archive'
  trashedFromRelativePath?: string
  relativePath?: string
  referencedAttachment?: boolean
  attachmentOrigin?: 'note-capture'
}

export interface PersistedUrlItem {
  schemaVersion: 1 | 2
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
  siteName?: string | null
  contentKind?: 'webpage' | 'video'
  metadataVersion?: number
  metadataStatus: 'pending' | 'ready' | 'unavailable'
  metadataError: string | null
  note: ''
  originalCollectionId: string | null
  titleSource?: 'derived' | 'custom'
  trashedFrom?: 'inbox' | 'collection' | 'archive'
  trashedFromRelativePath?: string
  relativePath?: string
  referencedAttachment?: false
}

export interface PersistedFileItem {
  schemaVersion: 2
  id: string
  type: 'file'
  title: string
  createdAt: string
  updatedAt: string
  sourceUrl: null
  sourceFilename: string
  contentFilename: string
  mediaType: string
  size: number
  note: ''
  originalCollectionId: string | null
  titleSource?: 'derived' | 'custom'
  trashedFrom?: 'inbox' | 'collection' | 'archive'
  trashedFromRelativePath?: string
  relativePath?: string
  referencedAttachment?: boolean
}

export type PersistedItem =
  PersistedNoteItem | PersistedImageItem | PersistedUrlItem | PersistedFileItem

export interface PersistedSettings {
  schemaVersion: 1
  lastLibraryPath: string | null
}

export function isPersistedLibrary(value: unknown): value is PersistedLibrary {
  if (!value || typeof value !== 'object') return false
  const library = value as Record<string, unknown>
  return (
    (library.schemaVersion === 1 || library.schemaVersion === 2) &&
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
    ![1, 2].includes(Number(collection.schemaVersion)) ||
    collection.id !== collectionId ||
    typeof collection.name !== 'string' ||
    typeof collection.createdAt !== 'string'
  ) {
    return null
  }
  return {
    schemaVersion: collection.schemaVersion as 1 | 2,
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
    ![1, 2].includes(Number(item.schemaVersion)) ||
    item.id !== itemId ||
    typeof item.title !== 'string' ||
    typeof item.createdAt !== 'string' ||
    typeof item.updatedAt !== 'string' ||
    (item.originalCollectionId !== null &&
      item.originalCollectionId !== undefined &&
      (typeof item.originalCollectionId !== 'string' ||
        !ITEM_ID_PATTERN.test(item.originalCollectionId))) ||
    (item.titleSource !== undefined && !['derived', 'custom'].includes(String(item.titleSource))) ||
    (item.trashedFrom !== undefined &&
      !['inbox', 'collection', 'archive'].includes(String(item.trashedFrom)))
  ) {
    return false
  }

  if (item.type === 'note') {
    return (
      typeof item.contentFilename === 'string' &&
      item.contentFilename.toLowerCase().endsWith('.md') &&
      !/[\\/:*?"<>|]/.test(item.contentFilename) &&
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
      (item.siteName === undefined ||
        item.siteName === null ||
        typeof item.siteName === 'string') &&
      (item.contentKind === undefined || ['webpage', 'video'].includes(String(item.contentKind))) &&
      (item.metadataVersion === undefined ||
        (Number.isSafeInteger(item.metadataVersion) && Number(item.metadataVersion) > 0)) &&
      ['pending', 'ready', 'unavailable'].includes(String(item.metadataStatus)) &&
      (item.metadataError === null || typeof item.metadataError === 'string')
    )
  }
  if (item.type === 'file') {
    return (
      item.schemaVersion === 2 &&
      typeof item.contentFilename === 'string' &&
      item.contentFilename.length > 0 &&
      !/[\\/:*?"<>|]/.test(item.contentFilename) &&
      typeof item.sourceFilename === 'string' &&
      typeof item.mediaType === 'string' &&
      Number.isSafeInteger(item.size) &&
      Number(item.size) >= 0
    )
  }
  if (item.type !== 'image' || typeof item.mediaType !== 'string') return false
  if (!(item.mediaType in IMAGE_EXTENSIONS)) return false

  const mediaType = item.mediaType as SupportedImageMediaType
  return (
    typeof item.contentFilename === 'string' &&
    item.contentFilename.toLowerCase().endsWith(`.${IMAGE_EXTENSIONS[mediaType]}`) &&
    !/[\\/:*?"<>|]/.test(item.contentFilename) &&
    (typeof item.sourceFilename === 'string' || item.sourceFilename === null) &&
    typeof item.width === 'number' &&
    Number.isSafeInteger(item.width) &&
    item.width > 0 &&
    typeof item.height === 'number' &&
    Number.isSafeInteger(item.height) &&
    item.height > 0 &&
    (item.attachmentOrigin === undefined || item.attachmentOrigin === 'note-capture')
  )
}
