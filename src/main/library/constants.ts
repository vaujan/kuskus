import type { SupportedImageMediaType } from '../../shared/library-contract'

export const LIBRARY_FILENAME = 'library.json'
export const COLLECTION_FILENAME = 'collection.json'
export const ITEM_FILENAME = 'item.json'
export const NOTE_FILENAME = 'note.md'
export const NOTE_ASSETS_DIRECTORY = 'assets'
export const NOTE_DRAFT_DIRECTORY = 'note-draft'
export const NOTE_DRAFT_MANIFEST = 'draft.json'
export const FILE_DRAFT_DIRECTORY = 'file-draft'
export const FILE_DRAFT_MANIFEST = 'draft.json'
export const URL_PREVIEW_DIRECTORY = 'thumbnails'
export const ITEM_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i
export const MAXIMUM_IMAGE_BYTES = 25 * 1024 * 1024

export const IMAGE_EXTENSIONS: Record<SupportedImageMediaType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp'
}
