import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { CollectionDto, LibraryDto, LibraryItemDto } from '../../../shared/library-contract'
import {
  COLLECTION_FILENAME,
  ITEM_FILENAME,
  ITEM_ID_PATTERN,
  LIBRARY_FILENAME,
  NOTE_FILENAME
} from '../constants'
import {
  isPersistedItem,
  isPersistedLibrary,
  parsePersistedCollection,
  toCollectionDto,
  type PersistedCollection,
  type PersistedItem,
  type PersistedLibrary
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
        files.map(({ filename, data }) =>
          typeof data === 'string'
            ? writeFile(join(temporaryDirectory, filename), data, 'utf8')
            : writeFile(join(temporaryDirectory, filename), data)
        )
      )
      await writeJsonAtomic(join(temporaryDirectory, ITEM_FILENAME), metadata)
      await rename(temporaryDirectory, finalDirectory)
    } catch (error) {
      await rm(temporaryDirectory, { recursive: true, force: true })
      throw error
    }
  }

  async buildLibraryDto(libraryPath: string): Promise<LibraryDto> {
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

            try {
              if (metadata.type === 'note') {
                const body = await readFile(join(itemDirectory, NOTE_FILENAME), 'utf8')
                return { ...metadata, body, missingContent: false }
              }
              await access(join(itemDirectory, metadata.contentFilename))
              return { ...metadata, missingContent: false }
            } catch {
              return metadata.type === 'note'
                ? { ...metadata, body: '', missingContent: true }
                : { ...metadata, missingContent: true }
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
