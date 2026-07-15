import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

import type {
  ImageImportInput,
  ImageItemDto,
  ImagePreviewDto,
  LibraryState,
  NoteItemDto
} from '../../shared/library-contract'
import { NOTE_FILENAME, RESERVED_WINDOWS_NAMES } from './constants'
import {
  createImageMetadata,
  detectImage,
  toImageDto,
  validateImageInput
} from './items/image-item'
import { createNoteMetadata, toNoteDto } from './items/note-item'
import type { PersistedLibrary, PersistedSettings } from './schemas'
import { readJson, writeJsonAtomic } from './storage/json-file'
import { LibraryStore } from './storage/library-store'

export class LibraryService {
  private currentLibraryPath: string | null = null
  private unavailableLibrary: { path: string; message: string } | null = null
  private readonly store = new LibraryStore()

  constructor(private readonly settingsPath: string) {}

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

  async createNote(markdown: string): Promise<NoteItemDto> {
    const libraryPath = this.requireCurrentLibrary()
    if (!markdown.trim()) throw new Error('Write something before saving the note.')
    await this.store.readPersistedLibrary(libraryPath)

    const id = randomUUID()
    const timestamp = new Date().toISOString()
    const metadata = createNoteMetadata(id, markdown, timestamp)
    await this.store.finalizeInboxItem(libraryPath, metadata, [
      { filename: NOTE_FILENAME, data: markdown }
    ])
    return toNoteDto(metadata, markdown)
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

  async getItemContentPath(itemId: string): Promise<string> {
    return this.store.getItemContentPath(this.requireCurrentLibrary(), itemId)
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
