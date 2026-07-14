export const KUSKUS_CHANNELS = {
  getLibraryState: 'library:get-state',
  createLibrary: 'library:create',
  openLibrary: 'library:open',
  createNote: 'library:create-note',
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

export interface LibraryDto {
  schemaVersion: 1
  id: string
  name: string
  path: string
  createdAt: string
  items: NoteItemDto[]
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
  showItemInExplorer: (itemId: string) => Promise<ApiResult<null>>
}
