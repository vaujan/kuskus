import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

import type {
  ActiveItemLocation,
  CollectionIconKey,
  CreateNoteInput,
  CreateCollectionInput,
  ImageImportInput,
  ImageItemDto,
  ImagePreviewDto,
  CollectionDto,
  ItemMutationInput,
  LibraryDto,
  LibraryState,
  MoveItemsInput,
  NoteItemDto,
  CaptureDraftImageDto,
  UpdateNoteInput,
  RenameItemInput,
  UrlItemDto,
  UrlPreviewDto,
  UrlPreviewKind
} from '../../shared/library-contract'
import {
  ITEM_ID_PATTERN,
  NOTE_ASSETS_DIRECTORY,
  NOTE_FILENAME,
  RESERVED_WINDOWS_NAMES
} from './constants'
import {
  createImageMetadata,
  detectImage,
  safeSourceFilename,
  toImageDto,
  validateImageInput
} from './items/image-item'
import {
  createNoteMetadata,
  noteAttachmentFilename,
  toNoteDto,
  updateNoteMetadata
} from './items/note-item'
import { createUrlMetadata, extractUrlMetadata, toUrlDto, validateWebUrl } from './items/url-item'
import {
  isCollectionIconKey,
  toCollectionDto,
  type PersistedCollection,
  type PersistedItem,
  type PersistedLibrary,
  type PersistedSettings,
  type PersistedUrlItem
} from './schemas'
import { readJson, writeJsonAtomic } from './storage/json-file'
import { LibraryStore } from './storage/library-store'
import {
  defaultUrlNetworkDependencies,
  fetchPublicResource,
  readBoundedBytes,
  readHtmlHead,
  type UrlNetworkDependencies
} from './url-network'
import { toUrlPreviewDto, URL_PREVIEW_LIMITS, validateUrlPreview } from './url-preview'

export class NoteUpdateConflictError extends Error {
  constructor(readonly current: NoteItemDto) {
    super(
      'This note changed on disk after you opened it. Review both versions before choosing what to keep.'
    )
    this.name = 'NoteUpdateConflictError'
  }
}

export class LibraryService {
  private currentLibraryPath: string | null = null
  private unavailableLibrary: { path: string; message: string } | null = null
  private readonly store = new LibraryStore()
  private readonly urlNetwork: UrlNetworkDependencies
  private readonly enrichmentRequests = new Map<string, Promise<UrlItemDto>>()
  private readonly previewRequests = new Map<string, Promise<UrlPreviewDto>>()

  constructor(
    private readonly settingsPath: string,
    dependencies: Partial<UrlNetworkDependencies> = {}
  ) {
    this.urlNetwork = { ...defaultUrlNetworkDependencies, ...dependencies }
  }

  async initialize(): Promise<void> {
    try {
      const settings = await readJson<PersistedSettings>(this.settingsPath)
      if (settings.schemaVersion !== 1 || !settings.lastLibraryPath) return

      await this.store.readPersistedLibrary(settings.lastLibraryPath)
      this.currentLibraryPath = settings.lastLibraryPath
    } catch (error) {
      if (await this.store.pathExists(this.settingsPath)) {
        const lastPath = await this.readLastLibraryPathSafely()
        if (lastPath) {
          this.unavailableLibrary = {
            path: lastPath,
            message: this.toMessage(error, 'The previous library could not be opened.')
          }
        }
      }
    }
  }

  async getState(): Promise<LibraryState> {
    if (this.currentLibraryPath) {
      try {
        return {
          status: 'ready',
          library: await this.store.buildLibraryDto(this.currentLibraryPath)
        }
      } catch (error) {
        const path = this.currentLibraryPath
        this.currentLibraryPath = null
        this.unavailableLibrary = {
          path,
          message: this.toMessage(error, 'The current library is unavailable.')
        }
      }
    }

    if (this.unavailableLibrary) return { status: 'unavailable', ...this.unavailableLibrary }
    return { status: 'none' }
  }

  async createIn(parentPath: string, requestedName: string): Promise<LibraryState> {
    const name = this.validateLibraryName(requestedName)
    const libraryPath = join(parentPath, name)
    const library: PersistedLibrary = {
      schemaVersion: 1,
      id: randomUUID(),
      name,
      createdAt: new Date().toISOString()
    }

    await this.store.prepareNewLibrary(libraryPath, library)
    await this.setCurrentLibrary(libraryPath)
    return this.getState()
  }

  async openAt(libraryPath: string): Promise<LibraryState> {
    await this.store.readPersistedLibrary(libraryPath)
    await this.store.ensureLibraryDirectories(libraryPath)
    await this.setCurrentLibrary(libraryPath)
    return this.getState()
  }

  async createNote(input: CreateNoteInput): Promise<NoteItemDto> {
    const libraryPath = this.requireCurrentLibrary()
    const { markdown, attachmentIds } = input
    if (!markdown.trim()) throw new Error('Write something before saving the note.')
    if (!Array.isArray(attachmentIds) || attachmentIds.some((id) => !ITEM_ID_PATTERN.test(id))) {
      throw new Error('The note attachment list is invalid.')
    }
    if (new Set(attachmentIds).size !== attachmentIds.length) {
      throw new Error('The note attachment list contains duplicates.')
    }
    await this.store.readPersistedLibrary(libraryPath)

    const id = randomUUID()
    const timestamp = new Date().toISOString()
    const staged = await Promise.all(
      attachmentIds.map((attachmentId) =>
        this.store.readCaptureDraftAttachment(libraryPath, attachmentId)
      )
    )
    const attachments = staged.map(({ attachment }) => attachment)
    const metadata = createNoteMetadata(id, markdown, timestamp, attachments)
    await this.store.finalizeInboxItem(libraryPath, metadata, [
      { filename: NOTE_FILENAME, data: markdown },
      ...staged.map(({ attachment, bytes }) => ({
        filename: `${NOTE_ASSETS_DIRECTORY}/${attachment.filename}`,
        data: bytes
      }))
    ])
    await this.store.discardCaptureDraft(libraryPath)
    return toNoteDto(
      metadata,
      markdown,
      attachments.map((attachment) => ({ ...attachment, missingContent: false }))
    )
  }

  async updateNote(input: UpdateNoteInput): Promise<NoteItemDto> {
    const libraryPath = this.requireCurrentLibrary()
    const { itemId, markdown, expectedMarkdown } = input
    this.validateItemId(itemId, 'item')
    if (typeof markdown !== 'string' || !markdown.trim()) {
      throw new Error('Write something before saving the note.')
    }
    if (typeof expectedMarkdown !== 'string')
      throw new Error('The expected note content is invalid.')

    const metadata = await this.store.readPersistedItem(libraryPath, itemId)
    if (metadata.type !== 'note') throw new Error('The saved item is not a note.')
    let currentMarkdown: string
    try {
      currentMarkdown = (await this.store.readItemContent(libraryPath, metadata)).toString('utf8')
    } catch {
      throw new Error('The note file is missing from the library.')
    }
    if (currentMarkdown !== expectedMarkdown) {
      throw new NoteUpdateConflictError(
        await this.toCurrentNoteDto(libraryPath, metadata, currentMarkdown)
      )
    }

    const updated = updateNoteMetadata(metadata, markdown, new Date().toISOString())
    await this.store.updateNote(libraryPath, updated, markdown)
    return this.toCurrentNoteDto(libraryPath, updated, markdown)
  }

  private async toCurrentNoteDto(
    libraryPath: string,
    metadata: Parameters<typeof toNoteDto>[0],
    markdown: string
  ): Promise<NoteItemDto> {
    const resolved = await this.store.resolveItem(libraryPath, metadata.id)
    const attachments = await Promise.all(
      (metadata.attachments ?? []).map(async (attachment) => ({
        ...attachment,
        missingContent: !(await this.store.pathExists(
          join(resolved.directory, NOTE_ASSETS_DIRECTORY, attachment.filename)
        ))
      }))
    )
    return toNoteDto(metadata, markdown, attachments, resolved.location)
  }

  async listCaptureDraftImages(): Promise<CaptureDraftImageDto[]> {
    const libraryPath = this.requireCurrentLibrary()
    const attachments = await this.store.readCaptureDraftAttachments(libraryPath)
    return Promise.all(
      attachments.map(async (attachment) => ({
        ...attachment,
        missingContent: !(await this.store.pathExists(
          join(libraryPath, '.kuskus', 'temp', 'note-draft', attachment.filename)
        ))
      }))
    )
  }

  async stageCaptureDraftImage(input: ImageImportInput): Promise<CaptureDraftImageDto> {
    const libraryPath = this.requireCurrentLibrary()
    const bytes = validateImageInput(input)
    const detected = detectImage(bytes)
    if (!detected) throw new Error('Kuskus supports PNG, JPEG, GIF, WebP, and BMP images.')
    const existing = await this.store.readCaptureDraftAttachments(libraryPath)
    const filename = noteAttachmentFilename(
      input.sourceFilename,
      detected,
      new Set(existing.map((attachment) => attachment.filename.toLocaleLowerCase()))
    )
    const attachment = {
      id: randomUUID(),
      filename,
      relativePath: `./${NOTE_ASSETS_DIRECTORY}/${filename}`,
      sourceFilename: safeSourceFilename(input.sourceFilename),
      mediaType: detected.mediaType,
      width: detected.width,
      height: detected.height
    }
    await this.store.stageCaptureDraftAttachment(libraryPath, attachment, bytes)
    return { ...attachment, missingContent: false }
  }

  async removeCaptureDraftImage(attachmentId: string): Promise<void> {
    this.validateItemId(attachmentId, 'attachment')
    await this.store.removeCaptureDraftAttachment(this.requireCurrentLibrary(), attachmentId)
  }

  async discardCaptureDraft(): Promise<void> {
    await this.store.discardCaptureDraft(this.requireCurrentLibrary())
  }

  async getCaptureDraftImagePreview(attachmentId: string): Promise<ImagePreviewDto> {
    this.validateItemId(attachmentId, 'attachment')
    const { attachment, bytes } = await this.store.readCaptureDraftAttachment(
      this.requireCurrentLibrary(),
      attachmentId
    )
    return this.toValidatedImagePreview(attachment.mediaType, bytes)
  }

  async commitCaptureDraftImage(attachmentId: string): Promise<ImageItemDto> {
    this.validateItemId(attachmentId, 'attachment')
    const libraryPath = this.requireCurrentLibrary()
    await this.store.readPersistedLibrary(libraryPath)
    const attachments = await this.store.readCaptureDraftAttachments(libraryPath)
    if (attachments.length !== 1 || attachments[0].id !== attachmentId) {
      throw new Error('The standalone image draft is no longer valid.')
    }
    const { attachment, bytes } = await this.store.readCaptureDraftAttachment(
      libraryPath,
      attachmentId
    )
    const detected = detectImage(bytes)
    if (!detected) throw new Error('The staged image content is invalid.')

    const timestamp = new Date().toISOString()
    const metadata = createImageMetadata(
      randomUUID(),
      attachment.sourceFilename,
      detected,
      timestamp
    )
    await this.store.finalizeInboxItem(libraryPath, metadata, [
      { filename: metadata.contentFilename, data: bytes }
    ])
    await this.store.discardCaptureDraft(libraryPath)
    return toImageDto(metadata)
  }

  async getNoteAttachmentPreview(itemId: string, attachmentId: string): Promise<ImagePreviewDto> {
    this.validateItemId(itemId, 'item')
    this.validateItemId(attachmentId, 'attachment')
    const { attachment, bytes } = await this.store.readNoteAttachment(
      this.requireCurrentLibrary(),
      itemId,
      attachmentId
    )
    return this.toValidatedImagePreview(attachment.mediaType, bytes)
  }

  async importImage(input: ImageImportInput): Promise<ImageItemDto> {
    const libraryPath = this.requireCurrentLibrary()
    const bytes = validateImageInput(input)
    await this.store.readPersistedLibrary(libraryPath)

    const detected = detectImage(bytes)
    if (!detected) throw new Error('Kuskus supports PNG, JPEG, GIF, WebP, and BMP images.')

    const metadata = createImageMetadata(
      randomUUID(),
      input.sourceFilename,
      detected,
      new Date().toISOString()
    )
    await this.store.finalizeInboxItem(libraryPath, metadata, [
      { filename: metadata.contentFilename, data: bytes }
    ])
    return toImageDto(metadata)
  }

  async createUrl(sourceUrl: string): Promise<UrlItemDto> {
    const libraryPath = this.requireCurrentLibrary()
    validateWebUrl(sourceUrl)
    await this.store.readPersistedLibrary(libraryPath)
    const timestamp = new Date().toISOString()
    const metadata = createUrlMetadata(randomUUID(), sourceUrl, timestamp)
    await this.store.finalizeInboxItem(libraryPath, metadata, [])
    return toUrlDto(metadata)
  }

  async enrichUrl(itemId: string): Promise<UrlItemDto> {
    this.validateItemId(itemId, 'item')
    const existing = this.enrichmentRequests.get(itemId)
    if (existing) return existing
    const request = this.performUrlEnrichment(itemId).finally(() => {
      this.enrichmentRequests.delete(itemId)
    })
    this.enrichmentRequests.set(itemId, request)
    return request
  }

  private async performUrlEnrichment(itemId: string): Promise<UrlItemDto> {
    const libraryPath = this.requireCurrentLibrary()
    const item = await this.store.readPersistedItem(libraryPath, itemId)
    if (item.type !== 'url') throw new Error('The saved link metadata is invalid.')
    try {
      const pageUrl = validateWebUrl(item.sourceUrl)
      const response = await fetchPublicResource(
        pageUrl,
        'text/html,application/xhtml+xml',
        this.urlNetwork
      )
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        throw new Error('The link did not return a webpage.')
      }
      const html = await readHtmlHead(response)
      const finalUrl = response.url ? new URL(response.url) : pageUrl
      const extracted = extractUrlMetadata(html, finalUrl)
      const updated: PersistedUrlItem = {
        ...item,
        ...extracted,
        title: item.titleSource === 'custom' ? item.title : extracted.title,
        metadataStatus: 'ready',
        metadataError: null,
        updatedAt: new Date().toISOString()
      }
      await this.store.updateItem(libraryPath, updated)
      return toUrlDto(updated, (await this.store.resolveItem(libraryPath, itemId)).location)
    } catch (error) {
      const updated: PersistedUrlItem = {
        ...item,
        metadataVersion: 2,
        metadataStatus: 'unavailable',
        metadataError: this.toMessage(error, 'Metadata is unavailable.'),
        updatedAt: new Date().toISOString()
      }
      await this.store.updateItem(libraryPath, updated)
      return toUrlDto(updated, (await this.store.resolveItem(libraryPath, itemId)).location)
    }
  }

  async getUrlPreview(itemId: string, kind: UrlPreviewKind): Promise<UrlPreviewDto> {
    this.validateItemId(itemId, 'item')
    if (!['preview', 'favicon'].includes(kind)) throw new Error('The preview kind is invalid.')
    const requestKey = `${itemId}:${kind}`
    const existing = this.previewRequests.get(requestKey)
    if (existing) return existing
    const request = this.loadUrlPreview(itemId, kind).finally(() => {
      this.previewRequests.delete(requestKey)
    })
    this.previewRequests.set(requestKey, request)
    return request
  }

  private async loadUrlPreview(itemId: string, kind: UrlPreviewKind): Promise<UrlPreviewDto> {
    const libraryPath = this.requireCurrentLibrary()
    const item = await this.store.readPersistedItem(libraryPath, itemId)
    if (item.type !== 'url') throw new Error('The saved item is not a link.')
    const cached = await this.store.readUrlPreviewCache(libraryPath, itemId, kind)
    if (cached) {
      try {
        validateUrlPreview(cached.bytes, cached.mediaType, kind)
        return toUrlPreviewDto(cached.bytes, cached.mediaType)
      } catch {
        await this.store.removeUrlPreviewCache(libraryPath, itemId, kind)
      }
    }
    const assetUrl = kind === 'preview' ? item.previewImageUrl : item.faviconUrl
    if (!assetUrl) throw new Error('No link preview is available.')
    const response = await fetchPublicResource(
      validateWebUrl(assetUrl),
      'image/webp,image/png,image/jpeg,image/gif,image/bmp,image/x-icon,image/vnd.microsoft.icon',
      this.urlNetwork
    )
    const bytes = await readBoundedBytes(response, URL_PREVIEW_LIMITS[kind].bytes)
    const validated = validateUrlPreview(bytes, response.headers.get('content-type') ?? '', kind)
    await this.store.writeUrlPreviewCache(libraryPath, itemId, kind, validated.extension, bytes)
    return toUrlPreviewDto(bytes, validated.mediaType)
  }

  async createCollection(input: CreateCollectionInput): Promise<CollectionDto> {
    const libraryPath = this.requireCurrentLibrary()
    const name = this.validateCollectionName(input.name)
    const icon = input.icon === undefined ? undefined : this.validateCollectionIcon(input.icon)
    const collection: PersistedCollection = {
      schemaVersion: 1,
      id: randomUUID(),
      name,
      ...(icon ? { icon } : {}),
      createdAt: new Date().toISOString()
    }
    await this.store.createCollection(libraryPath, collection)
    return toCollectionDto(collection)
  }

  async renameCollection(collectionId: string, requestedName: string): Promise<CollectionDto> {
    const libraryPath = this.requireCurrentLibrary()
    const collection = (await this.store.readPersistedCollections(libraryPath)).find(
      (entry) => entry.id === collectionId
    )
    if (!collection) throw new Error('This folder no longer exists.')
    const renamed = { ...collection, name: this.validateCollectionName(requestedName) }
    await this.store.updateCollection(libraryPath, renamed)
    return toCollectionDto(renamed)
  }

  async setCollectionIcon(
    collectionId: string,
    requestedIcon: CollectionIconKey
  ): Promise<CollectionDto> {
    this.validateCollectionId(collectionId)
    const libraryPath = this.requireCurrentLibrary()
    const collection = (await this.store.readPersistedCollections(libraryPath)).find(
      (entry) => entry.id === collectionId
    )
    if (!collection) throw new Error('This folder no longer exists.')
    const updated = { ...collection, icon: this.validateCollectionIcon(requestedIcon) }
    await this.store.updateCollection(libraryPath, updated)
    return toCollectionDto(updated)
  }

  async deleteCollection(collectionId: string): Promise<LibraryDto> {
    this.validateCollectionId(collectionId)
    const libraryPath = this.requireCurrentLibrary()
    const library = await this.store.buildLibraryDto(libraryPath)
    const items = library.items.filter(
      (item) => item.location.type === 'collection' && item.location.collectionId === collectionId
    )
    if (items.length > 0) {
      const resolved = await Promise.all(
        items.map((item) => this.store.resolveItem(libraryPath, item.id))
      )
      await this.store.moveItems(
        libraryPath,
        resolved.map((item) => ({
          item,
          destination: { type: 'inbox' },
          metadata: this.clearLifecycleMetadata(item.metadata)
        }))
      )
    }
    await this.store.deleteCollection(libraryPath, collectionId)
    return this.store.buildLibraryDto(libraryPath)
  }

  async renameItem(input: RenameItemInput): Promise<LibraryDto> {
    if (!input || typeof input !== 'object') throw new Error('The item rename request is invalid.')
    this.validateItemId(input.itemId, 'item')
    const title = this.validateItemTitle(input.title)
    const libraryPath = this.requireCurrentLibrary()
    const item = await this.store.resolveItem(libraryPath, input.itemId)
    if (item.location.type === 'trash') throw new Error('Restore this item before renaming it.')
    await this.store.updateItem(libraryPath, {
      ...item.metadata,
      title,
      titleSource: 'custom',
      updatedAt: new Date().toISOString()
    })
    return this.store.buildLibraryDto(libraryPath)
  }

  async moveItems(input: MoveItemsInput): Promise<LibraryDto> {
    const itemIds = this.validateItemMutationInput(input)
    const destination = this.validateDestination(input.destination)
    const libraryPath = this.requireCurrentLibrary()
    if (
      destination.type === 'collection' &&
      !(await this.store.collectionExists(libraryPath, destination.collectionId))
    ) {
      throw new Error('The destination folder no longer exists.')
    }
    const items = await Promise.all(
      itemIds.map((itemId) => this.store.resolveItem(libraryPath, itemId))
    )
    if (items.some((item) => item.location.type === 'trash')) {
      throw new Error('Restore items from Trash before moving them.')
    }
    const requests = items
      .filter((item) => !this.sameActiveLocation(item.location, destination))
      .map((item) => ({
        item,
        destination,
        metadata: this.clearLifecycleMetadata(item.metadata)
      }))
    await this.store.moveItems(libraryPath, requests)
    return this.store.buildLibraryDto(libraryPath)
  }

  async archiveItems(input: ItemMutationInput): Promise<LibraryDto> {
    const itemIds = this.validateItemMutationInput(input)
    const libraryPath = this.requireCurrentLibrary()
    const items = await Promise.all(
      itemIds.map((itemId) => this.store.resolveItem(libraryPath, itemId))
    )
    if (items.some((item) => item.location.type === 'archive' || item.location.type === 'trash')) {
      throw new Error('Only active items can be archived.')
    }
    await this.store.moveItems(
      libraryPath,
      items.map((item) => ({
        item,
        destination: {
          type: 'archive',
          originalCollectionId:
            item.location.type === 'collection' ? item.location.collectionId : null
        },
        metadata: {
          ...this.clearLifecycleMetadata(item.metadata),
          originalCollectionId:
            item.location.type === 'collection' ? item.location.collectionId : null
        }
      }))
    )
    return this.store.buildLibraryDto(libraryPath)
  }

  async unarchiveItems(input: ItemMutationInput): Promise<LibraryDto> {
    const itemIds = this.validateItemMutationInput(input)
    const libraryPath = this.requireCurrentLibrary()
    const items = await Promise.all(
      itemIds.map((itemId) => this.store.resolveItem(libraryPath, itemId))
    )
    if (items.some((item) => item.location.type !== 'archive')) {
      throw new Error('Only archived items can be unarchived.')
    }
    const requests = await Promise.all(
      items.map(async (item) => {
        const collectionId = item.metadata.originalCollectionId
        const destination: ActiveItemLocation =
          collectionId && (await this.store.collectionExists(libraryPath, collectionId))
            ? { type: 'collection', collectionId }
            : { type: 'inbox' }
        return { item, destination, metadata: this.clearLifecycleMetadata(item.metadata) }
      })
    )
    await this.store.moveItems(libraryPath, requests)
    return this.store.buildLibraryDto(libraryPath)
  }

  async trashItems(input: ItemMutationInput): Promise<LibraryDto> {
    const itemIds = this.validateItemMutationInput(input)
    const libraryPath = this.requireCurrentLibrary()
    const items = await Promise.all(
      itemIds.map((itemId) => this.store.resolveItem(libraryPath, itemId))
    )
    if (items.some((item) => item.location.type === 'trash')) {
      throw new Error('These items are already in Trash.')
    }
    await this.store.moveItems(
      libraryPath,
      items.map((item) => {
        const from =
          item.location.type === 'archive'
            ? 'archive'
            : item.location.type === 'collection'
              ? 'collection'
              : 'inbox'
        const originalCollectionId =
          item.location.type === 'archive'
            ? item.metadata.originalCollectionId
            : item.location.type === 'collection'
              ? item.location.collectionId
              : null
        const metadata: PersistedItem = {
          ...item.metadata,
          originalCollectionId,
          trashedFrom: from
        }
        return {
          item,
          destination: { type: 'trash', trashedFrom: from, originalCollectionId },
          metadata
        }
      })
    )
    return this.store.buildLibraryDto(libraryPath)
  }

  async restoreItems(input: ItemMutationInput): Promise<LibraryDto> {
    const itemIds = this.validateItemMutationInput(input)
    const libraryPath = this.requireCurrentLibrary()
    const items = await Promise.all(
      itemIds.map((itemId) => this.store.resolveItem(libraryPath, itemId))
    )
    if (items.some((item) => item.location.type !== 'trash')) {
      throw new Error('Only trashed items can be restored.')
    }
    const requests = await Promise.all(
      items.map(async (item) => {
        const trashedFrom = item.metadata.trashedFrom ?? 'inbox'
        if (trashedFrom === 'archive') {
          return {
            item,
            destination: {
              type: 'archive' as const,
              originalCollectionId: item.metadata.originalCollectionId
            },
            metadata: this.withoutTrashedFrom(item.metadata)
          }
        }
        const collectionId = item.metadata.originalCollectionId
        const destination: ActiveItemLocation =
          trashedFrom === 'collection' &&
          collectionId &&
          (await this.store.collectionExists(libraryPath, collectionId))
            ? { type: 'collection', collectionId }
            : { type: 'inbox' }
        return { item, destination, metadata: this.clearLifecycleMetadata(item.metadata) }
      })
    )
    await this.store.moveItems(libraryPath, requests)
    return this.store.buildLibraryDto(libraryPath)
  }

  async permanentlyDeleteItems(input: ItemMutationInput): Promise<LibraryDto> {
    const itemIds = this.validateItemMutationInput(input)
    const libraryPath = this.requireCurrentLibrary()
    await this.store.permanentlyDeleteItems(libraryPath, itemIds)
    await Promise.all(
      itemIds.map((itemId) =>
        this.store.removeUrlPreviewCache(libraryPath, itemId).catch(() => undefined)
      )
    )
    return this.store.buildLibraryDto(libraryPath)
  }

  async getItemContentPath(itemId: string): Promise<string> {
    return this.store.getItemContentPath(this.requireCurrentLibrary(), itemId)
  }

  async getItemRevealPath(itemId: string): Promise<string> {
    return this.store.getItemRevealPath(this.requireCurrentLibrary(), itemId)
  }

  async getImagePreview(itemId: string): Promise<ImagePreviewDto> {
    const libraryPath = this.requireCurrentLibrary()
    const metadata = await this.store.readPersistedItem(libraryPath, itemId)
    if (metadata.type !== 'image') throw new Error('The saved image metadata is invalid.')

    const bytes = await this.store.readItemContent(libraryPath, metadata)
    const detected = detectImage(bytes)
    if (!detected || detected.mediaType !== metadata.mediaType) {
      throw new Error('The saved image content is invalid.')
    }
    return {
      bytes: bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer,
      mediaType: metadata.mediaType
    }
  }

  private toValidatedImagePreview(
    mediaType: ImagePreviewDto['mediaType'],
    bytes: Uint8Array
  ): ImagePreviewDto {
    const detected = detectImage(bytes)
    if (!detected || detected.mediaType !== mediaType) {
      throw new Error('The saved image content is invalid.')
    }
    return {
      bytes: bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer,
      mediaType
    }
  }

  private async setCurrentLibrary(libraryPath: string): Promise<void> {
    this.currentLibraryPath = libraryPath
    this.unavailableLibrary = null
    await writeJsonAtomic(this.settingsPath, {
      schemaVersion: 1,
      lastLibraryPath: libraryPath
    } satisfies PersistedSettings)
  }

  private requireCurrentLibrary(): string {
    if (!this.currentLibraryPath) throw new Error('Open or create a library first.')
    return this.currentLibraryPath
  }

  private validateLibraryName(requestedName: string): string {
    const name = requestedName.trim()
    if (!name) throw new Error('Enter a name for the library.')
    if (name === '.' || name === '..') throw new Error('Choose a different library name.')
    const containsControlCharacter = [...name].some((character) => character.charCodeAt(0) <= 31)
    if (/[<>:"/\\|?*]/.test(name) || containsControlCharacter || /[. ]$/.test(name)) {
      throw new Error('The library name contains characters Windows cannot use in a folder name.')
    }
    if (RESERVED_WINDOWS_NAMES.test(name)) {
      throw new Error('That name is reserved by Windows. Choose a different library name.')
    }
    return name
  }

  private validateCollectionName(requestedName: string): string {
    const name = requestedName.trim()
    if (!name) throw new Error('Enter a name for the folder.')
    if (name.length > 80) throw new Error('Folder names must be 80 characters or fewer.')
    if ([...name].some((character) => character.charCodeAt(0) <= 31)) {
      throw new Error('Enter a valid folder name.')
    }
    return name
  }

  private validateCollectionIcon(icon: unknown): CollectionIconKey {
    if (!isCollectionIconKey(icon)) throw new Error('Choose a supported folder icon.')
    return icon
  }

  private validateItemTitle(requestedTitle: unknown): string {
    if (typeof requestedTitle !== 'string') throw new Error('Enter a valid item title.')
    const title = requestedTitle.trim()
    if (!title) throw new Error('Enter a title for this item.')
    if (title.length > 200) throw new Error('Item titles must be 200 characters or fewer.')
    if ([...title].some((character) => character.charCodeAt(0) <= 31)) {
      throw new Error('Enter a valid item title.')
    }
    return title
  }

  private validateItemMutationInput(input: unknown): string[] {
    if (!input || typeof input !== 'object') throw new Error('The item request is invalid.')
    const itemIds = (input as Record<string, unknown>).itemIds
    if (
      !Array.isArray(itemIds) ||
      itemIds.length === 0 ||
      itemIds.length > 1000 ||
      itemIds.some((itemId) => typeof itemId !== 'string' || !ITEM_ID_PATTERN.test(itemId))
    ) {
      throw new Error('Choose one or more valid items.')
    }
    if (new Set(itemIds).size !== itemIds.length) {
      throw new Error('The item list contains duplicates.')
    }
    return itemIds as string[]
  }

  private validateDestination(value: unknown): ActiveItemLocation {
    if (!value || typeof value !== 'object') throw new Error('Choose a valid destination.')
    const destination = value as Record<string, unknown>
    if (destination.type === 'inbox') return { type: 'inbox' }
    if (
      destination.type === 'collection' &&
      typeof destination.collectionId === 'string' &&
      ITEM_ID_PATTERN.test(destination.collectionId)
    ) {
      return { type: 'collection', collectionId: destination.collectionId }
    }
    throw new Error('Choose a valid destination.')
  }

  private sameActiveLocation(
    current: Awaited<ReturnType<LibraryStore['resolveItem']>>['location'],
    destination: ActiveItemLocation
  ): boolean {
    return (
      current.type === destination.type &&
      (current.type !== 'collection' ||
        (destination.type === 'collection' && current.collectionId === destination.collectionId))
    )
  }

  private clearLifecycleMetadata(metadata: PersistedItem): PersistedItem {
    const next = { ...metadata, originalCollectionId: null }
    delete next.trashedFrom
    return next
  }

  private withoutTrashedFrom(metadata: PersistedItem): PersistedItem {
    const next = { ...metadata }
    delete next.trashedFrom
    return next
  }

  private validateCollectionId(collectionId: string): void {
    if (!/^[0-9a-f-]{36}$/i.test(collectionId)) {
      throw new Error('The folder identifier is invalid.')
    }
  }

  private validateItemId(id: string, label: 'item' | 'attachment'): void {
    if (!ITEM_ID_PATTERN.test(id)) throw new Error(`The ${label} identifier is invalid.`)
  }

  private async readLastLibraryPathSafely(): Promise<string | null> {
    try {
      const settings = await readJson<PersistedSettings>(this.settingsPath)
      return typeof settings.lastLibraryPath === 'string' ? settings.lastLibraryPath : null
    } catch {
      return null
    }
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback
  }
}
