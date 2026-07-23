import { access, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'

import type {
  CollectionDto,
  ItemLocation,
  LibraryDto,
  LibraryItemDto
} from '../../../shared/library-contract'
import type { UrlPreviewKind, UrlPreviewMediaType } from '../../../shared/library-contract'
import {
  COLLECTION_FILENAME,
  ITEM_FILENAME,
  ITEM_ID_PATTERN,
  LIBRARY_FILENAME,
  NOTE_DRAFT_DIRECTORY,
  NOTE_DRAFT_MANIFEST,
  NOTE_FILENAME,
  URL_PREVIEW_DIRECTORY
} from '../constants'
import { toUrlDto } from '../items/url-item'
import {
  isPersistedItem,
  isPersistedNoteAttachment,
  isPersistedLibrary,
  parsePersistedCollection,
  toCollectionDto,
  type PersistedCollection,
  type PersistedItem,
  type PersistedLibrary,
  type PersistedNoteItem,
  type PersistedNoteAttachment
} from '../schemas'
import { readJson, writeJsonAtomic } from './json-file'
import { URL_PREVIEW_EXTENSIONS } from '../url-preview'

export interface ResolvedLibraryItem {
  directory: string
  location: ItemLocation
  metadata: PersistedItem
}

export interface ItemMoveRequest {
  item: ResolvedLibraryItem
  destination: ItemLocation
  metadata: PersistedItem
}

interface PersistedItemMoveTransaction {
  schemaVersion: 1
  phase: 'staging' | 'committing'
  entries: Array<{
    itemId: string
    source: ItemLocation
    destination: ItemLocation
    originalMetadata: PersistedItem
    nextMetadata: PersistedItem
  }>
}

function isItemLocation(value: unknown): value is ItemLocation {
  if (!value || typeof value !== 'object') return false
  const location = value as Record<string, unknown>
  if (location.type === 'inbox') return true
  if (location.type === 'collection') {
    return typeof location.collectionId === 'string' && ITEM_ID_PATTERN.test(location.collectionId)
  }
  if (location.type === 'archive') {
    return (
      location.originalCollectionId === null ||
      (typeof location.originalCollectionId === 'string' &&
        ITEM_ID_PATTERN.test(location.originalCollectionId))
    )
  }
  return (
    location.type === 'trash' &&
    ['inbox', 'collection', 'archive'].includes(String(location.trashedFrom)) &&
    (location.originalCollectionId === null ||
      (typeof location.originalCollectionId === 'string' &&
        ITEM_ID_PATTERN.test(location.originalCollectionId)))
  )
}

function isPersistedItemMoveTransaction(value: unknown): value is PersistedItemMoveTransaction {
  if (!value || typeof value !== 'object') return false
  const transaction = value as Record<string, unknown>
  if (
    transaction.schemaVersion !== 1 ||
    !['staging', 'committing'].includes(String(transaction.phase)) ||
    !Array.isArray(transaction.entries)
  ) {
    return false
  }
  return transaction.entries.every((entry) => {
    if (!entry || typeof entry !== 'object') return false
    const candidate = entry as Record<string, unknown>
    return (
      typeof candidate.itemId === 'string' &&
      ITEM_ID_PATTERN.test(candidate.itemId) &&
      isItemLocation(candidate.source) &&
      isItemLocation(candidate.destination) &&
      isPersistedItem(candidate.originalMetadata, candidate.itemId) &&
      isPersistedItem(candidate.nextMetadata, candidate.itemId)
    )
  })
}

export class LibraryStore {
  protected moveDirectory(source: string, destination: string): Promise<void> {
    return rename(source, destination)
  }

  async pathExists(path: string): Promise<boolean> {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }

  async prepareNewLibrary(libraryPath: string, library: PersistedLibrary): Promise<void> {
    if (await this.pathExists(libraryPath)) {
      const targetStat = await stat(libraryPath)
      if (!targetStat.isDirectory()) {
        throw new Error(`A file named "${library.name}" already exists in the selected location.`)
      }
      const entries = await readdir(libraryPath)
      if (entries.length > 0) {
        throw new Error(
          `The folder "${library.name}" already exists and is not empty. Choose another name or open it as an existing library.`
        )
      }
    } else {
      await mkdir(libraryPath, { recursive: false })
    }

    await this.ensureLibraryDirectories(libraryPath)
    await writeJsonAtomic(join(libraryPath, LIBRARY_FILENAME), library)
  }

  async readPersistedLibrary(libraryPath: string): Promise<PersistedLibrary> {
    const targetStat = await stat(libraryPath)
    if (!targetStat.isDirectory()) throw new Error('The library path is not a folder.')

    const library = await readJson<unknown>(join(libraryPath, LIBRARY_FILENAME))
    if (!isPersistedLibrary(library)) {
      throw new Error('This folder does not contain a supported Kuskus library.')
    }
    return library
  }

  async ensureLibraryDirectories(libraryPath: string): Promise<void> {
    await Promise.all([
      mkdir(join(libraryPath, 'inbox'), { recursive: true }),
      mkdir(join(libraryPath, 'collections'), { recursive: true }),
      mkdir(join(libraryPath, 'archive'), { recursive: true }),
      mkdir(join(libraryPath, 'trash'), { recursive: true }),
      mkdir(join(libraryPath, '.kuskus', 'temp'), { recursive: true }),
      mkdir(join(libraryPath, '.kuskus', URL_PREVIEW_DIRECTORY), { recursive: true })
    ])
    await this.recoverPendingItemOperations(libraryPath)
    await this.recoverPendingNoteUpdates(libraryPath)
  }

  private itemDirectory(libraryPath: string, location: ItemLocation, itemId: string): string {
    if (location.type === 'inbox') return join(libraryPath, 'inbox', itemId)
    if (location.type === 'collection') {
      return join(libraryPath, 'collections', location.collectionId, 'items', itemId)
    }
    return join(libraryPath, location.type, itemId)
  }

  private async recoverPendingItemOperations(libraryPath: string): Promise<void> {
    const temporaryRoot = join(libraryPath, '.kuskus', 'temp')
    const entries = await readdir(temporaryRoot, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.endsWith('.item-move')) continue
      const transactionDirectory = join(temporaryRoot, entry.name)
      try {
        const value = await readJson<unknown>(join(transactionDirectory, 'manifest.json'))
        if (!isPersistedItemMoveTransaction(value)) throw new Error('Invalid item transaction.')
        if (value.phase === 'committing') {
          for (const item of value.entries) {
            const staged = join(transactionDirectory, 'items', item.itemId)
            const destination = this.itemDirectory(libraryPath, item.destination, item.itemId)
            if (!(await this.pathExists(destination)) && (await this.pathExists(staged))) {
              await rename(staged, destination)
            }
          }
        } else {
          for (const item of [...value.entries].reverse()) {
            const staged = join(transactionDirectory, 'items', item.itemId)
            const destination = this.itemDirectory(libraryPath, item.destination, item.itemId)
            const source = this.itemDirectory(libraryPath, item.source, item.itemId)
            const current = (await this.pathExists(staged))
              ? staged
              : (await this.pathExists(destination))
                ? destination
                : null
            if (current && !(await this.pathExists(source))) {
              await writeJsonAtomic(join(current, ITEM_FILENAME), item.originalMetadata)
              await rename(current, source)
            }
          }
        }
        await rm(transactionDirectory, { recursive: true, force: true })
      } catch {
        // Leave an unreadable transaction in place for explicit recovery instead of guessing paths.
      }
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.endsWith('.item-delete')) continue
      const transactionDirectory = join(temporaryRoot, entry.name)
      const manifestPath = join(transactionDirectory, 'manifest.json')
      try {
        const manifest = await readJson<unknown>(manifestPath)
        if (!manifest || typeof manifest !== 'object') continue
        const record = manifest as Record<string, unknown>
        if (
          !Array.isArray(record.itemIds) ||
          !record.itemIds.every((id) => typeof id === 'string' && ITEM_ID_PATTERN.test(id))
        )
          continue
        if (record.phase === 'deleting') {
          await rm(transactionDirectory, { recursive: true, force: true })
          continue
        }
        for (const itemId of record.itemIds as string[]) {
          const staged = join(transactionDirectory, 'items', itemId)
          const destination = join(libraryPath, 'trash', itemId)
          if ((await this.pathExists(staged)) && !(await this.pathExists(destination))) {
            await rename(staged, destination)
          }
        }
        await rm(transactionDirectory, { recursive: true, force: true })
      } catch {
        // Preserve unreadable deletion transactions for manual recovery.
      }
    }
  }

  private async recoverPendingNoteUpdates(libraryPath: string): Promise<void> {
    const temporaryRoot = join(libraryPath, '.kuskus', 'temp')
    const entries = await readdir(temporaryRoot, { withFileTypes: true })
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && entry.name.endsWith('.note-update'))
        .map(async (entry) => {
          const itemId = entry.name.slice(0, -'.note-update'.length)
          if (!ITEM_ID_PATTERN.test(itemId)) return
          const transactionDirectory = join(temporaryRoot, entry.name)
          const nextDirectory = join(transactionDirectory, 'next')
          const previousDirectory = join(transactionDirectory, 'previous')
          let finalDirectory = join(libraryPath, 'inbox', itemId)
          try {
            const location = await readJson<unknown>(join(transactionDirectory, 'location.json'))
            if (isItemLocation(location))
              finalDirectory = this.itemDirectory(libraryPath, location, itemId)
          } catch {
            // Legacy note transactions were Inbox-only.
          }

          if (!(await this.pathExists(finalDirectory))) {
            if (await this.pathExists(nextDirectory)) {
              await rename(nextDirectory, finalDirectory)
            } else if (await this.pathExists(previousDirectory)) {
              await rename(previousDirectory, finalDirectory)
            }
          }
          await rm(transactionDirectory, { recursive: true, force: true })
        })
    )
  }

  async finalizeInboxItem(
    libraryPath: string,
    metadata: PersistedItem,
    files: ReadonlyArray<{ filename: string; data: string | Uint8Array }>
  ): Promise<void> {
    const temporaryDirectory = join(libraryPath, '.kuskus', 'temp', `${metadata.id}.pending`)
    const finalDirectory = join(libraryPath, 'inbox', metadata.id)

    await mkdir(temporaryDirectory, { recursive: false })
    try {
      await Promise.all(
        files.map(async ({ filename, data }) => {
          if (!/^[^\\/:*?"<>|]+$/.test(filename) && !/^assets[\\/][^\\/]+$/.test(filename)) {
            throw new Error('The item content filename is invalid.')
          }
          const target = join(temporaryDirectory, filename)
          await mkdir(dirname(target), { recursive: true })
          await (typeof data === 'string'
            ? writeFile(target, data, 'utf8')
            : writeFile(target, data))
        })
      )
      await writeJsonAtomic(join(temporaryDirectory, ITEM_FILENAME), metadata)
      await rename(temporaryDirectory, finalDirectory)
    } catch (error) {
      await rm(temporaryDirectory, { recursive: true, force: true })
      throw error
    }
  }

  private captureDraftDirectory(libraryPath: string): string {
    return join(libraryPath, '.kuskus', 'temp', NOTE_DRAFT_DIRECTORY)
  }

  async readCaptureDraftAttachments(libraryPath: string): Promise<PersistedNoteAttachment[]> {
    const manifestPath = join(this.captureDraftDirectory(libraryPath), NOTE_DRAFT_MANIFEST)
    if (!(await this.pathExists(manifestPath))) return []
    try {
      const value = await readJson<unknown>(manifestPath)
      if (!Array.isArray(value) || !value.every(isPersistedNoteAttachment)) {
        throw new Error('The saved note draft attachments are invalid.')
      }
      return value
    } catch (error) {
      throw new Error(
        error instanceof Error && error.message
          ? error.message
          : 'The saved note draft attachments could not be read.'
      )
    }
  }

  async stageCaptureDraftAttachment(
    libraryPath: string,
    attachment: PersistedNoteAttachment,
    bytes: Uint8Array
  ): Promise<void> {
    const directory = this.captureDraftDirectory(libraryPath)
    await mkdir(directory, { recursive: true })
    const attachments = await this.readCaptureDraftAttachments(libraryPath)
    const contentPath = join(directory, attachment.filename)
    await writeFile(contentPath, bytes)
    try {
      await writeJsonAtomic(join(directory, NOTE_DRAFT_MANIFEST), [...attachments, attachment])
    } catch (error) {
      await rm(contentPath, { force: true })
      throw error
    }
  }

  async removeCaptureDraftAttachment(libraryPath: string, attachmentId: string): Promise<void> {
    const attachments = await this.readCaptureDraftAttachments(libraryPath)
    const attachment = attachments.find((entry) => entry.id === attachmentId)
    if (!attachment) throw new Error('This draft image no longer exists.')
    const remaining = attachments.filter((entry) => entry.id !== attachmentId)
    const directory = this.captureDraftDirectory(libraryPath)
    await writeJsonAtomic(join(directory, NOTE_DRAFT_MANIFEST), remaining)
    await rm(join(directory, attachment.filename), { force: true })
  }

  async discardCaptureDraft(libraryPath: string): Promise<void> {
    await rm(this.captureDraftDirectory(libraryPath), { recursive: true, force: true })
  }

  async readCaptureDraftAttachment(
    libraryPath: string,
    attachmentId: string
  ): Promise<{ attachment: PersistedNoteAttachment; bytes: Buffer }> {
    const attachment = (await this.readCaptureDraftAttachments(libraryPath)).find(
      (entry) => entry.id === attachmentId
    )
    if (!attachment) throw new Error('This draft image no longer exists.')
    return {
      attachment,
      bytes: await readFile(join(this.captureDraftDirectory(libraryPath), attachment.filename))
    }
  }

  async readNoteAttachment(
    libraryPath: string,
    itemId: string,
    attachmentId: string
  ): Promise<{ attachment: PersistedNoteAttachment; bytes: Buffer }> {
    const resolved = await this.resolveItem(libraryPath, itemId)
    const metadata = resolved.metadata
    if (metadata.type !== 'note') throw new Error('The saved item is not a note.')
    const attachment = (metadata.attachments ?? []).find((entry) => entry.id === attachmentId)
    if (!attachment) throw new Error('This note image no longer exists.')
    return {
      attachment,
      bytes: await readFile(join(resolved.directory, 'assets', attachment.filename))
    }
  }

  async buildLibraryDto(libraryPath: string): Promise<LibraryDto> {
    await this.ensureLibraryDirectories(libraryPath)
    const library = await this.readPersistedLibrary(libraryPath)
    return {
      ...library,
      path: libraryPath,
      items: await this.readAllItems(libraryPath),
      collections: await this.readCollections(libraryPath)
    }
  }

  async createCollection(libraryPath: string, collection: PersistedCollection): Promise<void> {
    const directory = join(libraryPath, 'collections', collection.id)
    await mkdir(directory, { recursive: false })
    try {
      await mkdir(join(directory, 'items'), { recursive: false })
      await writeJsonAtomic(join(directory, COLLECTION_FILENAME), collection)
    } catch (error) {
      await rm(directory, { recursive: true, force: true })
      throw error
    }
  }

  async readCollections(libraryPath: string): Promise<CollectionDto[]> {
    return (await this.readPersistedCollections(libraryPath)).map(toCollectionDto)
  }

  async readPersistedCollections(libraryPath: string): Promise<PersistedCollection[]> {
    const collectionsPath = join(libraryPath, 'collections')
    await mkdir(collectionsPath, { recursive: true })
    const entries = await readdir(collectionsPath, { withFileTypes: true })
    const collections = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && ITEM_ID_PATTERN.test(entry.name))
        .map(async (entry) => {
          try {
            const collection = await readJson<unknown>(
              join(collectionsPath, entry.name, COLLECTION_FILENAME)
            )
            return parsePersistedCollection(collection, entry.name)
          } catch {
            return null
          }
        })
    )
    return collections
      .filter((collection): collection is PersistedCollection => collection !== null)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async updateCollection(libraryPath: string, collection: PersistedCollection): Promise<void> {
    await writeJsonAtomic(
      join(libraryPath, 'collections', collection.id, COLLECTION_FILENAME),
      collection
    )
  }

  async updateItem(libraryPath: string, item: PersistedItem): Promise<void> {
    const resolved = await this.resolveItem(libraryPath, item.id)
    await writeJsonAtomic(join(resolved.directory, ITEM_FILENAME), item)
  }

  async updateNote(
    libraryPath: string,
    metadata: PersistedNoteItem,
    markdown: string
  ): Promise<void> {
    await this.ensureLibraryDirectories(libraryPath)
    const resolved = await this.resolveItem(libraryPath, metadata.id)
    const transactionDirectory = join(libraryPath, '.kuskus', 'temp', `${metadata.id}.note-update`)
    const nextDirectory = join(transactionDirectory, 'next')
    const previousDirectory = join(transactionDirectory, 'previous')
    const finalDirectory = resolved.directory

    await mkdir(transactionDirectory, { recursive: false })
    try {
      await writeJsonAtomic(join(transactionDirectory, 'location.json'), resolved.location)
      await cp(finalDirectory, nextDirectory, { recursive: true, errorOnExist: true })
      await writeFile(join(nextDirectory, NOTE_FILENAME), markdown, 'utf8')
      await writeJsonAtomic(join(nextDirectory, ITEM_FILENAME), metadata)
      await rename(finalDirectory, previousDirectory)
      try {
        await rename(nextDirectory, finalDirectory)
      } catch (error) {
        await rename(previousDirectory, finalDirectory)
        throw error
      }
      await rm(transactionDirectory, { recursive: true, force: true }).catch(() => undefined)
    } catch (error) {
      if (!(await this.pathExists(finalDirectory)) && (await this.pathExists(previousDirectory))) {
        await rename(previousDirectory, finalDirectory)
      }
      await rm(transactionDirectory, { recursive: true, force: true })
      throw error
    }
  }

  async deleteCollection(libraryPath: string, collectionId: string): Promise<void> {
    const directory = join(libraryPath, 'collections', collectionId)
    const items = await readdir(join(directory, 'items'))
    if (items.length > 0) throw new Error('Move this folder’s items before removing it.')
    await rm(directory, { recursive: true, force: false })
  }

  private async readItemsAt(directory: string, location: ItemLocation): Promise<LibraryItemDto[]> {
    await mkdir(directory, { recursive: true })
    const entries = await readdir(directory, { withFileTypes: true })
    const items = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && ITEM_ID_PATTERN.test(entry.name))
        .map(async (entry): Promise<LibraryItemDto | null> => {
          const itemDirectory = join(directory, entry.name)
          try {
            const metadata = await readJson<unknown>(join(itemDirectory, ITEM_FILENAME))
            if (!isPersistedItem(metadata, entry.name)) return null
            const actualLocation: ItemLocation =
              location.type === 'archive'
                ? { type: 'archive', originalCollectionId: metadata.originalCollectionId ?? null }
                : location.type === 'trash'
                  ? {
                      type: 'trash',
                      trashedFrom: metadata.trashedFrom ?? 'inbox',
                      originalCollectionId: metadata.originalCollectionId ?? null
                    }
                  : location

            if (metadata.type === 'url') return toUrlDto(metadata, actualLocation)
            if (metadata.type === 'note') {
              const attachments = await Promise.all(
                (metadata.attachments ?? []).map(async (attachment) => ({
                  ...attachment,
                  missingContent: !(await this.pathExists(
                    join(itemDirectory, 'assets', attachment.filename)
                  ))
                }))
              )
              try {
                const body = await readFile(join(itemDirectory, NOTE_FILENAME), 'utf8')
                return {
                  ...metadata,
                  body,
                  missingContent: false,
                  attachments,
                  location: actualLocation
                }
              } catch {
                return {
                  ...metadata,
                  body: '',
                  missingContent: true,
                  attachments,
                  location: actualLocation
                }
              }
            }
            return {
              ...metadata,
              missingContent: !(await this.pathExists(
                join(itemDirectory, metadata.contentFilename)
              )),
              location: actualLocation
            }
          } catch {
            return null
          }
        })
    )
    return items.filter((item): item is LibraryItemDto => item !== null)
  }

  async readAllItems(libraryPath: string): Promise<LibraryItemDto[]> {
    const collections = await this.readPersistedCollections(libraryPath)
    const groups = await Promise.all([
      this.readItemsAt(join(libraryPath, 'inbox'), { type: 'inbox' }),
      ...collections.map((collection) =>
        this.readItemsAt(join(libraryPath, 'collections', collection.id, 'items'), {
          type: 'collection',
          collectionId: collection.id
        })
      ),
      this.readItemsAt(join(libraryPath, 'archive'), {
        type: 'archive',
        originalCollectionId: null
      }),
      this.readItemsAt(join(libraryPath, 'trash'), {
        type: 'trash',
        trashedFrom: 'inbox',
        originalCollectionId: null
      })
    ])
    const seen = new Set<string>()
    const items: LibraryItemDto[] = []
    for (const item of groups.flat()) {
      if (seen.has(item.id)) throw new Error(`Item ${item.id} exists in more than one location.`)
      seen.add(item.id)
      items.push(item)
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async resolveItem(libraryPath: string, itemId: string): Promise<ResolvedLibraryItem> {
    if (!ITEM_ID_PATTERN.test(itemId)) throw new Error('The item identifier is invalid.')
    const collections = await this.readPersistedCollections(libraryPath)
    const locations: ItemLocation[] = [
      { type: 'inbox' },
      ...collections.map((collection): ItemLocation => ({
        type: 'collection',
        collectionId: collection.id
      })),
      { type: 'archive', originalCollectionId: null },
      { type: 'trash', trashedFrom: 'inbox', originalCollectionId: null }
    ]
    const matches: ResolvedLibraryItem[] = []
    for (const location of locations) {
      const directory = this.itemDirectory(libraryPath, location, itemId)
      if (!(await this.pathExists(directory))) continue
      const value = await readJson<unknown>(join(directory, ITEM_FILENAME))
      if (!isPersistedItem(value, itemId)) throw new Error('The saved item metadata is invalid.')
      const actualLocation: ItemLocation =
        location.type === 'archive'
          ? { type: 'archive', originalCollectionId: value.originalCollectionId ?? null }
          : location.type === 'trash'
            ? {
                type: 'trash',
                trashedFrom: value.trashedFrom ?? 'inbox',
                originalCollectionId: value.originalCollectionId ?? null
              }
            : location
      matches.push({ directory, location: actualLocation, metadata: value })
    }
    if (matches.length === 0) throw new Error('This item no longer exists.')
    if (matches.length > 1) throw new Error('This item exists in more than one library location.')
    return matches[0]
  }

  async readPersistedItem(libraryPath: string, itemId: string): Promise<PersistedItem> {
    return (await this.resolveItem(libraryPath, itemId)).metadata
  }

  async getItemContentPath(libraryPath: string, itemId: string): Promise<string> {
    const resolved = await this.resolveItem(libraryPath, itemId)
    const metadata = resolved.metadata
    const filename = metadata.contentFilename
    if (!filename) throw new Error('This item has no local content file.')
    const contentPath = join(resolved.directory, filename)
    await access(contentPath)
    return contentPath
  }

  async getItemRevealPath(libraryPath: string, itemId: string): Promise<string> {
    const resolved = await this.resolveItem(libraryPath, itemId)
    const metadata = resolved.metadata
    const itemDirectory = resolved.directory
    if (metadata.contentFilename) {
      const contentPath = join(itemDirectory, metadata.contentFilename)
      if (await this.pathExists(contentPath)) return contentPath
    }

    const metadataPath = join(itemDirectory, ITEM_FILENAME)
    await access(metadataPath)
    return metadataPath
  }

  async readItemContent(libraryPath: string, metadata: PersistedItem): Promise<Buffer> {
    if (!metadata.contentFilename) throw new Error('This item has no local content file.')
    const resolved = await this.resolveItem(libraryPath, metadata.id)
    return readFile(join(resolved.directory, metadata.contentFilename))
  }

  private urlPreviewDirectory(libraryPath: string, itemId: string): string {
    if (!ITEM_ID_PATTERN.test(itemId)) throw new Error('The item identifier is invalid.')
    return join(libraryPath, '.kuskus', URL_PREVIEW_DIRECTORY, itemId)
  }

  async readUrlPreviewCache(
    libraryPath: string,
    itemId: string,
    kind: UrlPreviewKind
  ): Promise<{ bytes: Buffer; mediaType: UrlPreviewMediaType } | null> {
    const directory = this.urlPreviewDirectory(libraryPath, itemId)
    if (!(await this.pathExists(directory))) return null
    for (const [mediaType, extension] of Object.entries(URL_PREVIEW_EXTENSIONS) as Array<
      [UrlPreviewMediaType, string]
    >) {
      const path = join(directory, `${kind}.${extension}`)
      if (await this.pathExists(path)) return { bytes: await readFile(path), mediaType }
    }
    return null
  }

  async writeUrlPreviewCache(
    libraryPath: string,
    itemId: string,
    kind: UrlPreviewKind,
    extension: string,
    bytes: Uint8Array
  ): Promise<void> {
    const directory = this.urlPreviewDirectory(libraryPath, itemId)
    await mkdir(directory, { recursive: true })
    const target = join(directory, `${kind}.${extension}`)
    const temporary = join(directory, `${kind}.${randomUUID()}.pending`)
    await writeFile(temporary, bytes)
    try {
      await Promise.all(
        Object.values(URL_PREVIEW_EXTENSIONS).map((candidate) =>
          candidate === extension
            ? Promise.resolve()
            : rm(join(directory, `${kind}.${candidate}`), { force: true })
        )
      )
      await rm(target, { force: true })
      await rename(temporary, target)
    } catch (error) {
      await rm(temporary, { force: true })
      throw error
    }
  }

  async removeUrlPreviewCache(
    libraryPath: string,
    itemId: string,
    kind?: UrlPreviewKind
  ): Promise<void> {
    const directory = this.urlPreviewDirectory(libraryPath, itemId)
    if (!kind) {
      await rm(directory, { recursive: true, force: true })
      return
    }
    await Promise.all(
      Object.values(URL_PREVIEW_EXTENSIONS).map((extension) =>
        rm(join(directory, `${kind}.${extension}`), { force: true })
      )
    )
  }

  async collectionExists(libraryPath: string, collectionId: string): Promise<boolean> {
    return this.pathExists(join(libraryPath, 'collections', collectionId, COLLECTION_FILENAME))
  }

  async moveItems(libraryPath: string, requests: ItemMoveRequest[]): Promise<void> {
    if (requests.length === 0) return
    const itemIds = requests.map((request) => request.item.metadata.id)
    if (new Set(itemIds).size !== itemIds.length)
      throw new Error('The item list contains duplicates.')
    for (const request of requests) {
      const destination = this.itemDirectory(
        libraryPath,
        request.destination,
        request.item.metadata.id
      )
      if (await this.pathExists(destination))
        throw new Error('An item already exists at the destination.')
      if (
        request.destination.type === 'collection' &&
        !(await this.collectionExists(libraryPath, request.destination.collectionId))
      ) {
        throw new Error('The destination folder no longer exists.')
      }
    }

    const transactionDirectory = join(libraryPath, '.kuskus', 'temp', `${randomUUID()}.item-move`)
    const stagedRoot = join(transactionDirectory, 'items')
    const manifest: PersistedItemMoveTransaction = {
      schemaVersion: 1,
      phase: 'staging',
      entries: requests.map((request) => ({
        itemId: request.item.metadata.id,
        source: request.item.location,
        destination: request.destination,
        originalMetadata: request.item.metadata,
        nextMetadata: request.metadata
      }))
    }
    await mkdir(stagedRoot, { recursive: true })
    await writeJsonAtomic(join(transactionDirectory, 'manifest.json'), manifest)
    try {
      for (const request of requests) {
        const staged = join(stagedRoot, request.item.metadata.id)
        await this.moveDirectory(request.item.directory, staged)
        await writeJsonAtomic(join(staged, ITEM_FILENAME), request.metadata)
      }
    } catch (error) {
      for (const request of [...requests].reverse()) {
        const staged = join(stagedRoot, request.item.metadata.id)
        if (!(await this.pathExists(staged))) continue
        await writeJsonAtomic(join(staged, ITEM_FILENAME), request.item.metadata)
        await this.moveDirectory(staged, request.item.directory)
      }
      await rm(transactionDirectory, { recursive: true, force: true })
      throw error
    }

    manifest.phase = 'committing'
    await writeJsonAtomic(join(transactionDirectory, 'manifest.json'), manifest)
    try {
      for (const request of requests) {
        const staged = join(stagedRoot, request.item.metadata.id)
        const destination = this.itemDirectory(
          libraryPath,
          request.destination,
          request.item.metadata.id
        )
        if (await this.pathExists(staged)) await this.moveDirectory(staged, destination)
      }
    } catch (error) {
      manifest.phase = 'staging'
      await writeJsonAtomic(join(transactionDirectory, 'manifest.json'), manifest)
      try {
        for (const request of [...requests].reverse()) {
          const staged = join(stagedRoot, request.item.metadata.id)
          const destination = this.itemDirectory(
            libraryPath,
            request.destination,
            request.item.metadata.id
          )
          const current = (await this.pathExists(staged))
            ? staged
            : (await this.pathExists(destination))
              ? destination
              : null
          if (!current) continue
          await writeJsonAtomic(join(current, ITEM_FILENAME), request.item.metadata)
          await this.moveDirectory(current, request.item.directory)
        }
        await rm(transactionDirectory, { recursive: true, force: true })
      } catch {
        // Keep the staging manifest so startup recovery can finish reversing the batch.
      }
      throw error
    }
    await rm(transactionDirectory, { recursive: true, force: true })
  }

  async permanentlyDeleteItems(libraryPath: string, itemIds: string[]): Promise<void> {
    if (itemIds.length === 0) return
    if (new Set(itemIds).size !== itemIds.length)
      throw new Error('The item list contains duplicates.')
    const resolved = await Promise.all(
      itemIds.map((itemId) => this.resolveItem(libraryPath, itemId))
    )
    if (resolved.some((item) => item.location.type !== 'trash')) {
      throw new Error('Only items in Trash can be permanently deleted.')
    }
    const transactionDirectory = join(libraryPath, '.kuskus', 'temp', `${randomUUID()}.item-delete`)
    const stagedRoot = join(transactionDirectory, 'items')
    const manifestPath = join(transactionDirectory, 'manifest.json')
    await mkdir(stagedRoot, { recursive: true })
    await writeJsonAtomic(manifestPath, { schemaVersion: 1, phase: 'staging', itemIds })
    try {
      for (const item of resolved) {
        await rename(item.directory, join(stagedRoot, item.metadata.id))
      }
    } catch (error) {
      for (const item of [...resolved].reverse()) {
        const staged = join(stagedRoot, item.metadata.id)
        if (await this.pathExists(staged)) await rename(staged, item.directory)
      }
      await rm(transactionDirectory, { recursive: true, force: true })
      throw error
    }
    await writeJsonAtomic(manifestPath, { schemaVersion: 1, phase: 'deleting', itemIds })
    await rm(transactionDirectory, { recursive: true, force: true })
  }
}
