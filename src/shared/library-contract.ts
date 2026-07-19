export const KUSKUS_CHANNELS = {
  getLibraryState: 'library:get-state',
  createLibrary: 'library:create',
  openLibrary: 'library:open',
  createNote: 'library:create-note',
  listNoteDraftImages: 'library:list-note-draft-images',
  stageNoteDraftImage: 'library:stage-note-draft-image',
  removeNoteDraftImage: 'library:remove-note-draft-image',
  discardNoteDraft: 'library:discard-note-draft',
  getNoteDraftImagePreview: 'library:get-note-draft-image-preview',
  getNoteAttachmentPreview: 'library:get-note-attachment-preview',
  createUrl: 'library:create-url',
  enrichUrl: 'library:enrich-url',
  importImage: 'library:import-image',
  createCollection: 'library:create-collection',
  renameCollection: 'library:rename-collection',
  setCollectionIcon: 'library:set-collection-icon',
  deleteCollection: 'library:delete-collection',
  getImagePreview: 'library:get-image-preview',
  copyLibraryPath: 'library:copy-library-path',
  showItemInExplorer: 'library:show-item-in-explorer',
  openExternalUrl: 'library:open-external-url'
} as const

export type ApiErrorCode = 'cancelled' | 'invalid-input' | 'not-found' | 'io-error'

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; code: ApiErrorCode }

export interface NoteItemDto {
  schemaVersion: 1
  id: string
  type: 'note'
  title: string
  body: string
  createdAt: string
  updatedAt: string
  missingContent: boolean
  attachments: NoteAttachmentDto[]
}

export interface NoteAttachmentDto {
  id: string
  filename: string
  relativePath: string
  sourceFilename: string | null
  mediaType: SupportedImageMediaType
  width: number
  height: number
  missingContent: boolean
}

export type NoteDraftImageDto = NoteAttachmentDto

export interface CreateNoteInput {
  markdown: string
  attachmentIds: string[]
}

export interface ImageItemDto {
  schemaVersion: 1
  id: string
  type: 'image'
  title: string
  createdAt: string
  updatedAt: string
  sourceFilename: string | null
  contentFilename: string
  mediaType: SupportedImageMediaType
  width: number
  height: number
  missingContent: boolean
}

export interface UrlItemDto {
  schemaVersion: 1
  id: string
  type: 'url'
  title: string
  createdAt: string
  updatedAt: string
  sourceUrl: string
  domain: string
  description: string | null
  faviconUrl: string | null
  previewImageUrl: string | null
  metadataStatus: 'pending' | 'ready' | 'unavailable'
  metadataError: string | null
}

export type LibraryItemDto = NoteItemDto | ImageItemDto | UrlItemDto

export type SupportedImageMediaType =
  'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | 'image/bmp'

export interface ImageImportInput {
  bytes: ArrayBuffer
  mediaType: string
  sourceFilename: string | null
}

export interface ImagePreviewDto {
  bytes: ArrayBuffer
  mediaType: SupportedImageMediaType
}

export interface LibraryDto {
  schemaVersion: 1
  id: string
  name: string
  path: string
  createdAt: string
  items: LibraryItemDto[]
  collections: CollectionDto[]
}

export const COLLECTION_ICON_KEYS = [
  'folder',
  'briefcase',
  'palette',
  'code',
  'rocket',
  'bulb',
  'bookmark',
  'book',
  'school',
  'flask',
  'chart',
  'finance',
  'shopping',
  'home',
  'heart',
  'star',
  'music',
  'photo',
  'video',
  'camera',
  'gaming',
  'travel',
  'map',
  'calendar',
  'team',
  'person',
  'building',
  'tools',
  'archive',
  'nature',
  'fitness',
  'notes'
] as const

export type CollectionIconKey = (typeof COLLECTION_ICON_KEYS)[number]

export interface CreateCollectionInput {
  name: string
  icon?: CollectionIconKey
}

export interface CollectionDto {
  schemaVersion: 1
  id: string
  name: string
  icon: CollectionIconKey
  createdAt: string
}

export type LibraryState =
  | { status: 'none' }
  | { status: 'ready'; library: LibraryDto }
  | { status: 'unavailable'; path: string; message: string }

export interface KuskusLibraryApi {
  getState: () => Promise<ApiResult<LibraryState>>
  create: (name: string) => Promise<ApiResult<LibraryState>>
  open: () => Promise<ApiResult<LibraryState>>
  createNote: (input: CreateNoteInput) => Promise<ApiResult<NoteItemDto>>
  listNoteDraftImages: () => Promise<ApiResult<NoteDraftImageDto[]>>
  stageNoteDraftImage: (input: ImageImportInput) => Promise<ApiResult<NoteDraftImageDto>>
  removeNoteDraftImage: (attachmentId: string) => Promise<ApiResult<null>>
  discardNoteDraft: () => Promise<ApiResult<null>>
  getNoteDraftImagePreview: (attachmentId: string) => Promise<ApiResult<ImagePreviewDto>>
  getNoteAttachmentPreview: (
    itemId: string,
    attachmentId: string
  ) => Promise<ApiResult<ImagePreviewDto>>
  createUrl: (url: string) => Promise<ApiResult<UrlItemDto>>
  enrichUrl: (itemId: string) => Promise<ApiResult<UrlItemDto>>
  importImage: (input: ImageImportInput) => Promise<ApiResult<ImageItemDto>>
  createCollection: (input: CreateCollectionInput) => Promise<ApiResult<CollectionDto>>
  renameCollection: (id: string, name: string) => Promise<ApiResult<CollectionDto>>
  setCollectionIcon: (id: string, icon: CollectionIconKey) => Promise<ApiResult<CollectionDto>>
  deleteCollection: (id: string) => Promise<ApiResult<null>>
  getImagePreview: (itemId: string) => Promise<ApiResult<ImagePreviewDto>>
  copyLibraryPath: () => Promise<ApiResult<null>>
  showItemInExplorer: (itemId: string) => Promise<ApiResult<null>>
  openExternalUrl: (url: string) => Promise<ApiResult<null>>
}
