export const KUSKUS_CHANNELS = {
  getLibraryState: 'library:get-state',
  createLibrary: 'library:create',
  openLibrary: 'library:open',
  createNote: 'library:create-note',
  createUrl: 'library:create-url',
  enrichUrl: 'library:enrich-url',
  importImage: 'library:import-image',
  createCollection: 'library:create-collection',
  renameCollection: 'library:rename-collection',
  deleteCollection: 'library:delete-collection',
  getImagePreview: 'library:get-image-preview',
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

export interface CollectionDto {
  schemaVersion: 1
  id: string
  name: string
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
  createNote: (markdown: string) => Promise<ApiResult<NoteItemDto>>
  createUrl: (url: string) => Promise<ApiResult<UrlItemDto>>
  enrichUrl: (itemId: string) => Promise<ApiResult<UrlItemDto>>
  importImage: (input: ImageImportInput) => Promise<ApiResult<ImageItemDto>>
  createCollection: (name: string) => Promise<ApiResult<CollectionDto>>
  renameCollection: (id: string, name: string) => Promise<ApiResult<CollectionDto>>
  deleteCollection: (id: string) => Promise<ApiResult<null>>
  getImagePreview: (itemId: string) => Promise<ApiResult<ImagePreviewDto>>
  openExternalUrl: (url: string) => Promise<ApiResult<null>>
}
