import { randomUUID } from 'node:crypto'
import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { LibraryDto, LibraryState, NoteItemDto } from '../shared/kuskus'

interface PersistedLibrary {
  schemaVersion: 1
  id: string
  name: string
  createdAt: string
}

interface PersistedNoteItem {
  schemaVersion: 1
  id: string
  type: 'note'
  title: string
  createdAt: string
  updatedAt: string
  sourceUrl: null
  sourceFilename: null
  contentFilename: 'note.md'
  note: ''
  originalCollectionId: null
}

interface PersistedSettings {
  schemaVersion: 1
  lastLibraryPath: string | null
}

const libraryFilename = 'library.json'
const itemFilename = 'item.json'
const noteFilename = 'note.md'
const itemIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const reservedWindowsNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

export class LibraryService {
  private currentLibraryPath: string | null = null
  private unavailableLibrary: { path: string; message: string } | null = null

  constructor(private readonly settingsPath: string) {}

  async initialize(): Promise<void> {
    try {
      const settings = await this.readJson<PersistedSettings>(this.settingsPath)
      if (settings.schemaVersion !== 1 || !settings.lastLibraryPath) return

      await this.readPersistedLibrary(settings.lastLibraryPath)
      this.currentLibraryPath = settings.lastLibraryPath
    } catch (error) {
      if (await this.pathExists(this.settingsPath)) {
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
        return { status: 'ready', library: await this.buildLibraryDto(this.currentLibraryPath) }
      } catch (error) {
        const path = this.currentLibraryPath
        this.currentLibraryPath = null
        this.unavailableLibrary = {
          path,
          message: this.toMessage(error, 'The current library is unavailable.')
        }
      }
    }

    if (this.unavailableLibrary) {
      return { status: 'unavailable', ...this.unavailableLibrary }
    }

    return { status: 'none' }
  }

  async createIn(parentPath: string, requestedName: string): Promise<LibraryState> {
    const name = this.validateLibraryName(requestedName)
    const libraryPath = join(parentPath, name)

    if (await this.pathExists(libraryPath)) {
      const targetStat = await stat(libraryPath)
      if (!targetStat.isDirectory()) {
        throw new Error(`A file named "${name}" already exists in the selected location.`)
      }

      const entries = await readdir(libraryPath)
      if (entries.length > 0) {
        throw new Error(
          `The folder "${name}" already exists and is not empty. Choose another name or open it as an existing library.`
        )
      }
    } else {
      await mkdir(libraryPath, { recursive: false })
    }

    const createdAt = new Date().toISOString()
    const library: PersistedLibrary = {
      schemaVersion: 1,
      id: randomUUID(),
      name,
      createdAt
    }

    await mkdir(join(libraryPath, 'inbox'), { recursive: true })
    await mkdir(join(libraryPath, 'collections'), { recursive: true })
    await mkdir(join(libraryPath, 'trash'), { recursive: true })
    await mkdir(join(libraryPath, '.kuskus', 'temp'), { recursive: true })
    await this.writeJsonAtomic(join(libraryPath, libraryFilename), library)

    await this.setCurrentLibrary(libraryPath)
    return this.getState()
  }

  async openAt(libraryPath: string): Promise<LibraryState> {
    await this.readPersistedLibrary(libraryPath)
    await this.ensureLibraryDirectories(libraryPath)
    await this.setCurrentLibrary(libraryPath)
    return this.getState()
  }

  async createNote(markdown: string): Promise<NoteItemDto> {
    const libraryPath = this.requireCurrentLibrary()
    if (!markdown.trim()) throw new Error('Write something before saving the note.')

    await this.readPersistedLibrary(libraryPath)

    const id = randomUUID()
    const timestamp = new Date().toISOString()
    const title = this.deriveNoteTitle(markdown)
    const metadata: PersistedNoteItem = {
      schemaVersion: 1,
      id,
      type: 'note',
      title,
      createdAt: timestamp,
      updatedAt: timestamp,
      sourceUrl: null,
      sourceFilename: null,
      contentFilename: noteFilename,
      note: '',
      originalCollectionId: null
    }

    const temporaryDirectory = join(libraryPath, '.kuskus', 'temp', `${id}.pending`)
    const finalDirectory = join(libraryPath, 'inbox', id)

    await mkdir(temporaryDirectory, { recursive: false })
    try {
      await writeFile(join(temporaryDirectory, noteFilename), markdown, 'utf8')
      await this.writeJsonAtomic(join(temporaryDirectory, itemFilename), metadata)
      await rename(temporaryDirectory, finalDirectory)
    } catch (error) {
      await rm(temporaryDirectory, { recursive: true, force: true })
      throw error
    }

    return {
      schemaVersion: 1,
      id,
      type: 'note',
      title,
      body: markdown,
      createdAt: timestamp,
      updatedAt: timestamp,
      missingContent: false
    }
  }

  async getItemContentPath(itemId: string): Promise<string> {
    if (!itemIdPattern.test(itemId)) throw new Error('The item identifier is invalid.')

    const libraryPath = this.requireCurrentLibrary()
    const itemDirectory = join(libraryPath, 'inbox', itemId)
    const metadata = await this.readJson<PersistedNoteItem>(join(itemDirectory, itemFilename))

    if (metadata.id !== itemId || metadata.type !== 'note') {
      throw new Error('The saved item metadata is invalid.')
    }

    const contentPath = join(itemDirectory, noteFilename)
    await access(contentPath)
    return contentPath
  }

  private async buildLibraryDto(libraryPath: string): Promise<LibraryDto> {
    const library = await this.readPersistedLibrary(libraryPath)
    const items = await this.readInboxItems(libraryPath)
    return { ...library, path: libraryPath, items }
  }

  private async readInboxItems(libraryPath: string): Promise<NoteItemDto[]> {
    const inboxPath = join(libraryPath, 'inbox')
    await mkdir(inboxPath, { recursive: true })
    const entries = await readdir(inboxPath, { withFileTypes: true })

    const items = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && itemIdPattern.test(entry.name))
        .map(async (entry): Promise<NoteItemDto | null> => {
          const itemDirectory = join(inboxPath, entry.name)
          try {
            const metadata = await this.readJson<PersistedNoteItem>(
              join(itemDirectory, itemFilename)
            )
            if (
              metadata.schemaVersion !== 1 ||
              metadata.id !== entry.name ||
              metadata.type !== 'note'
            ) {
              return null
            }

            try {
              const body = await readFile(join(itemDirectory, noteFilename), 'utf8')
              return { ...metadata, body, missingContent: false }
            } catch {
              return { ...metadata, body: '', missingContent: true }
            }
          } catch {
            return null
          }
        })
    )

    return items
      .filter((item): item is NoteItemDto => item !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  private async readPersistedLibrary(libraryPath: string): Promise<PersistedLibrary> {
    const targetStat = await stat(libraryPath)
    if (!targetStat.isDirectory()) throw new Error('The library path is not a folder.')

    const library = await this.readJson<PersistedLibrary>(join(libraryPath, libraryFilename))
    if (
      library.schemaVersion !== 1 ||
      typeof library.id !== 'string' ||
      typeof library.name !== 'string' ||
      typeof library.createdAt !== 'string'
    ) {
      throw new Error('This folder does not contain a supported Kuskus library.')
    }
    return library
  }

  private async ensureLibraryDirectories(libraryPath: string): Promise<void> {
    await Promise.all([
      mkdir(join(libraryPath, 'inbox'), { recursive: true }),
      mkdir(join(libraryPath, 'collections'), { recursive: true }),
      mkdir(join(libraryPath, 'trash'), { recursive: true }),
      mkdir(join(libraryPath, '.kuskus', 'temp'), { recursive: true })
    ])
  }

  private async setCurrentLibrary(libraryPath: string): Promise<void> {
    this.currentLibraryPath = libraryPath
    this.unavailableLibrary = null
    await this.writeJsonAtomic(this.settingsPath, {
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
    if (reservedWindowsNames.test(name)) {
      throw new Error('That name is reserved by Windows. Choose a different library name.')
    }
    return name
  }

  private deriveNoteTitle(markdown: string): string {
    const firstLine = markdown
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)
    if (!firstLine) return 'Untitled note'

    const cleaned = firstLine
      .replace(/^#{1,6}\s+/, '')
      .replace(/^[>*_`~-]+\s*/, '')
      .replace(/[*_`~]/g, '')
      .trim()
    return (cleaned || 'Untitled note').slice(0, 120)
  }

  private async writeJsonAtomic(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true })
    const temporaryPath = `${path}.${randomUUID()}.tmp`
    try {
      await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
      await rename(temporaryPath, path)
    } catch (error) {
      await rm(temporaryPath, { force: true })
      throw error
    }
  }

  private async readJson<T>(path: string): Promise<T> {
    return JSON.parse(await readFile(path, 'utf8')) as T
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }

  private async readLastLibraryPathSafely(): Promise<string | null> {
    try {
      const settings = await this.readJson<PersistedSettings>(this.settingsPath)
      return typeof settings.lastLibraryPath === 'string' ? settings.lastLibraryPath : null
    } catch {
      return null
    }
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback
  }
}
