export const KUSKUS_CHANNELS = {
  getLibraryState: 'library:get-state',
  createLibrary: 'library:create',
  openLibrary: 'library:open',
  createNote: 'library:create-note',
  updateNote: 'library:update-note',
  listCaptureDraftImages: 'library:list-capture-draft-images',
  stageCaptureDraftImage: 'library:stage-capture-draft-image',
  removeCaptureDraftImage: 'library:remove-capture-draft-image',
  discardCaptureDraft: 'library:discard-capture-draft',
  getCaptureDraftImagePreview: 'library:get-capture-draft-image-preview',
  commitCaptureDraftImage: 'library:commit-capture-draft-image',
  getNoteAttachmentPreview: 'library:get-note-attachment-preview',
  createUrl: 'library:create-url',
  enrichUrl: 'library:enrich-url',
  getUrlPreview: 'library:get-url-preview',
  createCollection: 'library:create-collection',
  renameCollection: 'library:rename-collection',
  moveCollection: 'library:move-collection',
  setCollectionIcon: 'library:set-collection-icon',
  deleteCollection: 'library:delete-collection',
  renameItem: 'library:rename-item',
  moveItems: 'library:move-items',
  archiveItems: 'library:archive-items',
  unarchiveItems: 'library:unarchive-items',
  trashItems: 'library:trash-items',
  restoreItems: 'library:restore-items',
  permanentlyDeleteItems: 'library:permanently-delete-items',
  getImagePreview: 'library:get-image-preview',
  importFile: 'library:import-file',
  copyLibraryPath: 'library:copy-library-path',
  showItemInExplorer: 'library:show-item-in-explorer',
  openExternalUrl: 'library:open-external-url',
  initializeVault: 'library:initialize-vault',
  migrateLibrary: 'library:migrate',
  vaultChanged: 'library:vault-changed'
} as const

export type ApiErrorCode = 'cancelled' | 'invalid-input' | 'not-found' | 'conflict' | 'io-error'

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; code: ApiErrorCode }

export type ActiveItemLocation = { type: 'inbox' } | { type: 'collection'; collectionId: string }

export type ItemLocation =
  | ActiveItemLocation
  | { type: 'archive'; originalCollectionId: string | null }
  | {
      type: 'trash'
      trashedFrom: 'inbox' | 'collection' | 'archive'
      originalCollectionId: string | null
    }

export interface ItemMutationInput {
  itemIds: string[]
}

export interface MoveItemsInput extends ItemMutationInput {
  destination: ActiveItemLocation
}

export interface RenameItemInput {
  itemId: string
  title: string
}

export interface NoteItemDto {
  schemaVersion: 1 | 2
  id: string
  type: 'note'
  title: string
  body: string
  createdAt: string
  updatedAt: string
  missingContent: boolean
  attachments: NoteAttachmentDto[]
  location: ItemLocation
  relativePath: string
  referencedAttachment: false
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

export type CaptureDraftImageDto = NoteAttachmentDto

export interface CreateNoteInput {
  markdown: string
  attachmentIds: string[]
}

export interface UpdateNoteInput {
  itemId: string
  markdown: string
  expectedMarkdown: string
}

export type UpdateNoteResult =
  | { ok: true; data: NoteItemDto }
  | {
      ok: false
      error: string
      code: Exclude<ApiErrorCode, 'conflict'>
    }
  | {
      ok: false
      error: string
      code: 'conflict'
      conflict: { current: NoteItemDto }
    }

export interface ImageItemDto {
  schemaVersion: 1 | 2
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
  location: ItemLocation
  relativePath: string
  referencedAttachment: boolean
}

export interface UrlItemDto {
  schemaVersion: 1 | 2
  id: string
  type: 'url'
  title: string
  createdAt: string
  updatedAt: string
  sourceUrl: string
  domain: string
  description: string | null
  siteName: string
  contentKind: 'webpage' | 'video'
  metadataVersion: number
  hasFavicon: boolean
  hasPreviewImage: boolean
  metadataStatus: 'pending' | 'ready' | 'unavailable'
  metadataError: string | null
  location: ItemLocation
  relativePath: string
  referencedAttachment: false
}

export interface FileItemDto {
  schemaVersion: 2
  id: string
  type: 'file'
  title: string
  createdAt: string
  updatedAt: string
  sourceFilename: string
  contentFilename: string
  mediaType: string
  size: number
  missingContent: boolean
  location: ItemLocation
  relativePath: string
  referencedAttachment: boolean
}

export type LibraryItemDto = NoteItemDto | ImageItemDto | UrlItemDto | FileItemDto

export type SupportedImageMediaType =
  'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | 'image/bmp'

export interface ImageImportInput {
  bytes: ArrayBuffer
  mediaType: string
  sourceFilename: string | null
}

export interface FileImportInput {
  bytes: ArrayBuffer
  sourceFilename: string
  mediaType: string
}

export interface ImagePreviewDto {
  bytes: ArrayBuffer
  mediaType: SupportedImageMediaType
}

export type UrlPreviewKind = 'preview' | 'favicon'
export type UrlPreviewMediaType = SupportedImageMediaType | 'image/x-icon'

export interface UrlPreviewDto {
  bytes: ArrayBuffer
  mediaType: UrlPreviewMediaType
}

export interface LibraryDto {
  schemaVersion: 1 | 2
  id: string
  name: string
  path: string
  createdAt: string
  items: LibraryItemDto[]
  collections: CollectionDto[]
  cleanup: VaultCleanupDto
  repairConflicts: VaultRepairConflictDto[]
}

export interface VaultCleanupDto {
  status: 'not-needed' | 'completed' | 'conflicts'
  affectedFiles: number
  recoveryRelativePath: string | null
}

export interface VaultRepairConflictDto {
  kind: 'legacy-bookmark' | 'legacy-metadata'
  relativePath: string
  message: string
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
  parentId?: string | null
}

export interface MoveCollectionInput {
  collectionId: string
  parentId: string | null
}

export interface CollectionDto {
  schemaVersion: 1 | 2
  id: string
  name: string
  icon: CollectionIconKey
  createdAt: string
  relativePath: string
  parentId: string | null
}

export type LibraryState =
  | { status: 'none' }
  | { status: 'ready'; library: LibraryDto }
  | {
      status: 'needs-initialization'
      path: string
      name: string
      markdownFiles: number
      imageFiles: number
      otherFiles: number
      folders: number
      archiveFolderExists: boolean
    }
  | { status: 'needs-migration'; path: string; name: string }
  | { status: 'unavailable'; path: string; message: string }

export interface KuskusLibraryApi {
  getState: () => Promise<ApiResult<LibraryState>>
  create: (name: string) => Promise<ApiResult<LibraryState>>
  open: () => Promise<ApiResult<LibraryState>>
  initializeVault: () => Promise<ApiResult<LibraryState>>
  migrateLibrary: () => Promise<ApiResult<{ state: LibraryState; backupPath: string }>>
  createNote: (input: CreateNoteInput) => Promise<ApiResult<NoteItemDto>>
  updateNote: (input: UpdateNoteInput) => Promise<UpdateNoteResult>
  listCaptureDraftImages: () => Promise<ApiResult<CaptureDraftImageDto[]>>
  stageCaptureDraftImage: (input: ImageImportInput) => Promise<ApiResult<CaptureDraftImageDto>>
  removeCaptureDraftImage: (attachmentId: string) => Promise<ApiResult<null>>
  discardCaptureDraft: () => Promise<ApiResult<null>>
  getCaptureDraftImagePreview: (attachmentId: string) => Promise<ApiResult<ImagePreviewDto>>
  commitCaptureDraftImage: (attachmentId: string) => Promise<ApiResult<ImageItemDto>>
  getNoteAttachmentPreview: (
    itemId: string,
    attachmentId: string
  ) => Promise<ApiResult<ImagePreviewDto>>
  createUrl: (url: string) => Promise<ApiResult<UrlItemDto>>
  enrichUrl: (itemId: string) => Promise<ApiResult<UrlItemDto>>
  getUrlPreview: (itemId: string, kind: UrlPreviewKind) => Promise<ApiResult<UrlPreviewDto>>
  createCollection: (input: CreateCollectionInput) => Promise<ApiResult<CollectionDto>>
  renameCollection: (id: string, name: string) => Promise<ApiResult<CollectionDto>>
  moveCollection: (input: MoveCollectionInput) => Promise<ApiResult<LibraryDto>>
  setCollectionIcon: (id: string, icon: CollectionIconKey) => Promise<ApiResult<CollectionDto>>
  deleteCollection: (id: string) => Promise<ApiResult<LibraryDto>>
  renameItem: (input: RenameItemInput) => Promise<ApiResult<LibraryDto>>
  moveItems: (input: MoveItemsInput) => Promise<ApiResult<LibraryDto>>
  archiveItems: (input: ItemMutationInput) => Promise<ApiResult<LibraryDto>>
  unarchiveItems: (input: ItemMutationInput) => Promise<ApiResult<LibraryDto>>
  trashItems: (input: ItemMutationInput) => Promise<ApiResult<LibraryDto>>
  restoreItems: (input: ItemMutationInput) => Promise<ApiResult<LibraryDto>>
  permanentlyDeleteItems: (input: ItemMutationInput) => Promise<ApiResult<LibraryDto>>
  getImagePreview: (itemId: string) => Promise<ApiResult<ImagePreviewDto>>
  importFile: (input: FileImportInput) => Promise<ApiResult<FileItemDto>>
  copyLibraryPath: () => Promise<ApiResult<null>>
  showItemInExplorer: (itemId: string) => Promise<ApiResult<null>>
  openExternalUrl: (url: string) => Promise<ApiResult<null>>
  onVaultChanged: (callback: () => void) => () => void
}
