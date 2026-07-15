import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { LibraryDto, LibraryItemDto } from '../../../shared/library-contract'
import { ITEM_FILENAME, ITEM_ID_PATTERN, LIBRARY_FILENAME, NOTE_FILENAME } from '../constants'
import {
  isPersistedItem,
  isPersistedLibrary,
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
    return { ...library, path: libraryPath, items: await this.readInboxItems(libraryPath) }
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
    const contentPath = join(libraryPath, 'inbox', itemId, metadata.contentFilename)
    await access(contentPath)
    return contentPath
  }

  async readItemContent(libraryPath: string, metadata: PersistedItem): Promise<Buffer> {
    return readFile(join(libraryPath, 'inbox', metadata.id, metadata.contentFilename))
  }
}
