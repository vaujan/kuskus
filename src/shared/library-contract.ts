export const KUSKUS_CHANNELS = {
  getLibraryState: 'library:get-state',
  createLibrary: 'library:create',
  openLibrary: 'library:open',
  createNote: 'library:create-note',
  importImage: 'library:import-image',
  getImagePreview: 'library:get-image-preview',
  openItem: 'library:open-item',
  showItemInExplorer: 'library:show-item-in-explorer'
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

export type LibraryItemDto = NoteItemDto | ImageItemDto

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
  importImage: (input: ImageImportInput) => Promise<ApiResult<ImageItemDto>>
  getImagePreview: (itemId: string) => Promise<ApiResult<ImagePreviewDto>>
  openItem: (itemId: string) => Promise<ApiResult<null>>
  showItemInExplorer: (itemId: string) => Promise<ApiResult<null>>
}
