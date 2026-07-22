import { access, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { CollectionDto, LibraryDto, LibraryItemDto } from '../../../shared/library-contract'
import {
  COLLECTION_FILENAME,
  ITEM_FILENAME,
  ITEM_ID_PATTERN,
  LIBRARY_FILENAME,
  NOTE_DRAFT_DIRECTORY,
  NOTE_DRAFT_MANIFEST,
  NOTE_FILENAME
} from '../constants'
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

export class LibraryStore {
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
      mkdir(join(libraryPath, 'trash'), { recursive: true }),
      mkdir(join(libraryPath, '.kuskus', 'temp'), { recursive: true })
    ])
    await this.recoverPendingNoteUpdates(libraryPath)
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
          const finalDirectory = join(libraryPath, 'inbox', itemId)

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

  private noteDraftDirectory(libraryPath: string): string {
    return join(libraryPath, '.kuskus', 'temp', NOTE_DRAFT_DIRECTORY)
  }

  async readNoteDraftAttachments(libraryPath: string): Promise<PersistedNoteAttachment[]> {
    const manifestPath = join(this.noteDraftDirectory(libraryPath), NOTE_DRAFT_MANIFEST)
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

  async stageNoteDraftAttachment(
    libraryPath: string,
    attachment: PersistedNoteAttachment,
    bytes: Uint8Array
  ): Promise<void> {
    const directory = this.noteDraftDirectory(libraryPath)
    await mkdir(directory, { recursive: true })
    const attachments = await this.readNoteDraftAttachments(libraryPath)
    const contentPath = join(directory, attachment.filename)
    await writeFile(contentPath, bytes)
    try {
      await writeJsonAtomic(join(directory, NOTE_DRAFT_MANIFEST), [...attachments, attachment])
    } catch (error) {
      await rm(contentPath, { force: true })
      throw error
    }
  }

  async removeNoteDraftAttachment(libraryPath: string, attachmentId: string): Promise<void> {
    const attachments = await this.readNoteDraftAttachments(libraryPath)
    const attachment = attachments.find((entry) => entry.id === attachmentId)
    if (!attachment) throw new Error('This draft image no longer exists.')
    const remaining = attachments.filter((entry) => entry.id !== attachmentId)
    const directory = this.noteDraftDirectory(libraryPath)
    await writeJsonAtomic(join(directory, NOTE_DRAFT_MANIFEST), remaining)
    await rm(join(directory, attachment.filename), { force: true })
  }

  async discardNoteDraft(libraryPath: string): Promise<void> {
    await rm(this.noteDraftDirectory(libraryPath), { recursive: true, force: true })
  }

  async readNoteDraftAttachment(
    libraryPath: string,
    attachmentId: string
  ): Promise<{ attachment: PersistedNoteAttachment; bytes: Buffer }> {
    const attachment = (await this.readNoteDraftAttachments(libraryPath)).find(
      (entry) => entry.id === attachmentId
    )
    if (!attachment) throw new Error('This draft image no longer exists.')
    return {
      attachment,
      bytes: await readFile(join(this.noteDraftDirectory(libraryPath), attachment.filename))
    }
  }

  async readNoteAttachment(
    libraryPath: string,
    itemId: string,
    attachmentId: string
  ): Promise<{ attachment: PersistedNoteAttachment; bytes: Buffer }> {
    const metadata = await this.readPersistedItem(libraryPath, itemId)
    if (metadata.type !== 'note') throw new Error('The saved item is not a note.')
    const attachment = (metadata.attachments ?? []).find((entry) => entry.id === attachmentId)
    if (!attachment) throw new Error('This note image no longer exists.')
    return {
      attachment,
      bytes: await readFile(join(libraryPath, 'inbox', itemId, 'assets', attachment.filename))
    }
  }

  async buildLibraryDto(libraryPath: string): Promise<LibraryDto> {
    await this.ensureLibraryDirectories(libraryPath)
    const library = await this.readPersistedLibrary(libraryPath)
    return {
      ...library,
      path: libraryPath,
      items: await this.readInboxItems(libraryPath),
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

  async updateInboxItem(libraryPath: string, item: PersistedItem): Promise<void> {
    await writeJsonAtomic(join(libraryPath, 'inbox', item.id, ITEM_FILENAME), item)
  }

  async updateNote(
    libraryPath: string,
    metadata: PersistedNoteItem,
    markdown: string
  ): Promise<void> {
    await this.ensureLibraryDirectories(libraryPath)
    const transactionDirectory = join(libraryPath, '.kuskus', 'temp', `${metadata.id}.note-update`)
    const nextDirectory = join(transactionDirectory, 'next')
    const previousDirectory = join(transactionDirectory, 'previous')
    const finalDirectory = join(libraryPath, 'inbox', metadata.id)

    await mkdir(transactionDirectory, { recursive: false })
    try {
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

  async readInboxItems(libraryPath: string): Promise<LibraryItemDto[]> {
    const inboxPath = join(libraryPath, 'inbox')
    await mkdir(inboxPath, { recursive: true })
    const entries = await readdir(inboxPath, { withFileTypes: true })

    const items = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && ITEM_ID_PATTERN.test(entry.name))
        .map(async (entry): Promise<LibraryItemDto | null> => {
          const itemDirectory = join(inboxPath, entry.name)
          try {
            const metadata = await readJson<unknown>(join(itemDirectory, ITEM_FILENAME))
            if (!isPersistedItem(metadata, entry.name)) return null

            if (metadata.type === 'url') return metadata

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
                return { ...metadata, body, missingContent: false, attachments }
              } catch {
                return { ...metadata, body: '', missingContent: true, attachments }
              }
            }

            try {
              await access(join(itemDirectory, metadata.contentFilename))
              return { ...metadata, missingContent: false }
            } catch {
              return { ...metadata, missingContent: true }
            }
          } catch {
            return null
          }
        })
    )

    return items
      .filter((item): item is LibraryItemDto => item !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async readPersistedItem(libraryPath: string, itemId: string): Promise<PersistedItem> {
    if (!ITEM_ID_PATTERN.test(itemId)) throw new Error('The item identifier is invalid.')
    const metadata = await readJson<unknown>(join(libraryPath, 'inbox', itemId, ITEM_FILENAME))
    if (!isPersistedItem(metadata, itemId)) throw new Error('The saved item metadata is invalid.')
    return metadata
  }

  async getItemContentPath(libraryPath: string, itemId: string): Promise<string> {
    const metadata = await this.readPersistedItem(libraryPath, itemId)
    const filename = metadata.contentFilename
    if (!filename) throw new Error('This item has no local content file.')
    const contentPath = join(libraryPath, 'inbox', itemId, filename)
    await access(contentPath)
    return contentPath
  }

  async getItemRevealPath(libraryPath: string, itemId: string): Promise<string> {
    const metadata = await this.readPersistedItem(libraryPath, itemId)
    const itemDirectory = join(libraryPath, 'inbox', itemId)
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
    return readFile(join(libraryPath, 'inbox', metadata.id, metadata.contentFilename))
  }
}
