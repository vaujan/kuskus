import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, type Stats } from 'node:fs'
import { access, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'

import type {
  ActiveItemLocation,
  CollectionDto,
  FileItemDto,
  ItemDeletionInspectionDto,
  ItemLocation,
  LibraryDto,
  LibraryItemDto,
  NoteAttachmentDto,
  VaultCleanupDto,
  VaultRepairConflictDto
} from '../../../shared/library-contract'
import type { UrlPreviewKind, UrlPreviewMediaType } from '../../../shared/library-contract'
import {
  encodeMarkdownImageTarget,
  markdownImageTargetKey,
  normalizeMarkdownImageTarget,
  rewriteMarkdownImageDestinations,
  stagedAttachmentAliases
} from '../../../shared/markdown-image-references'
import {
  isCaptureSubmissionRecord,
  normalizeCaptureSubmissionRecord,
  type CaptureSubmissionRecord
} from '../../capture/capture-submission-record'
import {
  FILE_DRAFT_DIRECTORY,
  FILE_DRAFT_MANIFEST,
  IMAGE_EXTENSIONS,
  ITEM_ID_PATTERN,
  NOTE_DRAFT_DIRECTORY,
  NOTE_DRAFT_MANIFEST,
  URL_PREVIEW_DIRECTORY
} from '../constants'
import { createImageMetadata, detectImage, toImageDto } from '../items/image-item'
import { createNoteMetadata, toNoteDto } from '../items/note-item'
import { createUrlMetadata, toUrlDto } from '../items/url-item'
import {
  isPersistedItem,
  isPersistedNoteAttachment,
  isPersistedLibrary,
  isCollectionIconKey,
  toCollectionDto,
  type PersistedCollection,
  type PersistedImageItem,
  type PersistedItem,
  type PersistedFileItem,
  type PersistedLibrary,
  type PersistedNoteAttachment,
  type PersistedNoteItem
} from '../schemas'
import { createInternetShortcut, parseInternetShortcut } from '../internet-shortcut'
import { markdownPathForAttachment, resolveAttachmentPlacement } from '../attachment-placement'
import {
  extractVaultReferenceTargets,
  readVaultFrontmatter,
  removeKuskusFrontmatter,
  resolveVaultReferencePath,
  rewriteVaultReferences
} from '../vault-frontmatter'
import { URL_PREVIEW_EXTENSIONS } from '../url-preview'
import { readJson, writeJsonAtomic } from './json-file'
import { kuskusPath, resolveInsideVault } from './vault-paths'

const KUSKUS_DIRECTORY = '.kuskus'
const LIBRARY_FILENAME = 'library.json'
const RECORDS_DIRECTORY = 'records'
const COLLECTION_RECORDS_DIRECTORY = 'collections'
const TRASH_DIRECTORY = 'trash'
const CAPTURE_QUEUE_DIRECTORY = 'capture-queue'
const CAPTURE_SUBMISSION_MANIFEST = 'submission.json'
const INDEX_DIRECTORY = 'index'
const LIBRARY_INDEX_FILENAME = 'library-v1.json'
const DEFAULT_ARCHIVE_DIRECTORY = 'Archive'
const MARKDOWN_EXTENSION = '.md'
const INTERNET_SHORTCUT_EXTENSION = '.url'
const CLEANUP_MARKER = 'visible-metadata-cleanup.json'
const HIDDEN_DIRECTORY = /^\./
const ASSETS_DIRECTORY = /\.assets$/i
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

interface VaultItemRecord {
  schemaVersion: 2
  id: string
  relativePath: string
  fingerprint: string | null
  fileIdentity?: string | null
  fileSize?: number
  modifiedAtMs?: number
  recovery?: { lastSeenAt: string; missingSince: string | null }
  metadata: PersistedItem
}

type AttachmentItemRecord = VaultItemRecord & {
  metadata: PersistedImageItem | PersistedFileItem
}

interface VaultCollectionRecord extends PersistedCollection {
  schemaVersion: 2
  relativePath: string
  parentId: string | null
}

interface CleanupMarker extends VaultCleanupDto {
  schemaVersion: 1
  conflicts: VaultRepairConflictDto[]
  completedAt: string
}

interface LibraryIndexCache {
  schemaVersion: 1
  libraryId: string
  writtenAt: string
  library: LibraryDto
}

function isAttachmentItemRecord(record: VaultItemRecord): record is AttachmentItemRecord {
  return record.metadata.type === 'image' || record.metadata.type === 'file'
}

function pathKey(path: string): string {
  return resolve(path).toLocaleLowerCase()
}

function attachmentMetadataFromDto(attachment: NoteAttachmentDto): PersistedNoteAttachment {
  return {
    id: attachment.id,
    filename: attachment.filename,
    relativePath: attachment.relativePath,
    sourceFilename: attachment.sourceFilename,
    mediaType: attachment.mediaType,
    width: attachment.width,
    height: attachment.height
  }
}

function attachmentsEqual(
  left: readonly PersistedNoteAttachment[],
  right: readonly PersistedNoteAttachment[]
): boolean {
  return (
    left.length === right.length &&
    left.every((attachment, index) => {
      const candidate = right[index]
      return (
        candidate !== undefined &&
        attachment.id === candidate.id &&
        attachment.filename === candidate.filename &&
        attachment.relativePath === candidate.relativePath &&
        attachment.sourceFilename === candidate.sourceFilename &&
        attachment.mediaType === candidate.mediaType &&
        attachment.width === candidate.width &&
        attachment.height === candidate.height
      )
    })
  )
}

function normalizeDraftManifestAttachments(value: unknown): PersistedNoteAttachment[] {
  if (!value || typeof value !== 'object') return []
  const manifest = value as Record<string, unknown>
  const attachments = Array.isArray(manifest.attachments)
    ? manifest.attachments.filter(isPersistedNoteAttachment)
    : []
  if (manifest.schemaVersion !== 1) return attachments
  return attachments.map((attachment) =>
    markdownImageTargetKey(attachment.relativePath) ===
    markdownImageTargetKey(`./assets/${attachment.filename}`)
      ? { ...attachment, relativePath: `./${encodeMarkdownImageTarget(attachment.filename)}` }
      : attachment
  )
}

export interface PersistedCaptureDraftFile {
  id: string
  filename: string
  mediaType: string
  size: number
}

function isPersistedCaptureDraftFile(value: unknown): value is PersistedCaptureDraftFile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    ITEM_ID_PATTERN.test(candidate.id) &&
    typeof candidate.filename === 'string' &&
    candidate.filename.length > 0 &&
    typeof candidate.mediaType === 'string' &&
    typeof candidate.size === 'number' &&
    Number.isSafeInteger(candidate.size) &&
    candidate.size > 0
  )
}

export interface ResolvedLibraryItem {
  directory: string
  path: string
  relativePath: string
  location: ItemLocation
  metadata: PersistedItem
}

export interface ItemMoveRequest {
  item: ResolvedLibraryItem
  destination: ItemLocation
  metadata: PersistedItem
}

interface ScannedFile {
  path: string
  relativePath: string
  archive: boolean
}

interface ScannedFileWithStat extends ScannedFile {
  stats: Stats
}

interface DtoBuildContext {
  itemRecords: VaultItemRecord[]
  attachmentRecords: AttachmentItemRecord[]
  attachmentRecordIds: Set<string>
  availablePaths: string[]
  imageDetection: Map<string, Promise<ReturnType<typeof detectImage>>>
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  limit: number,
  operation: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await operation(values[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

function recordsEqual(left: VaultItemRecord, right: VaultItemRecord): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function slash(path: string): string {
  return path.split(sep).join('/')
}

function titleFromPath(path: string): string {
  return basename(path, extname(path))
}

function safeStem(value: string, fallback = 'Untitled'): string {
  const stem = value
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 160)
  return !stem || WINDOWS_RESERVED.test(stem) ? fallback : stem
}

function mimeForExtension(extension: string): string {
  const normalized = extension.toLowerCase()
  if (normalized === '.png') return 'image/png'
  if (normalized === '.jpg' || normalized === '.jpeg') return 'image/jpeg'
  if (normalized === '.gif') return 'image/gif'
  if (normalized === '.webp') return 'image/webp'
  if (normalized === '.bmp') return 'image/bmp'
  return 'application/octet-stream'
}

function isImageExtension(extension: string): boolean {
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(extension.toLowerCase())
}

function metadataTimestamp(date: Date): string {
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

export class LibraryStore {
  private readonly scanPromises = new Map<
    string,
    Promise<{ records: VaultItemRecord[]; collections: VaultCollectionRecord[] }>
  >()
  private readonly scanSnapshots = new Map<
    string,
    { records: VaultItemRecord[]; collections: VaultCollectionRecord[] }
  >()
  async pathExists(path: string): Promise<boolean> {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  }

  async readCachedLibraryDto(libraryPath: string): Promise<LibraryDto | null> {
    try {
      const library = await this.readPersistedLibrary(libraryPath)
      const cached = await readJson<unknown>(
        kuskusPath(libraryPath, INDEX_DIRECTORY, LIBRARY_INDEX_FILENAME)
      )
      if (!cached || typeof cached !== 'object') return null
      const value = cached as Partial<LibraryIndexCache>
      const dto = value.library
      if (
        value.schemaVersion !== 1 ||
        value.libraryId !== library.id ||
        !dto ||
        dto.id !== library.id ||
        dto.path !== libraryPath ||
        !Array.isArray(dto.items) ||
        !Array.isArray(dto.collections)
      ) {
        return null
      }
      return dto
    } catch {
      return null
    }
  }

  private async writeCachedLibraryDto(libraryPath: string, library: LibraryDto): Promise<void> {
    await writeJsonAtomic(kuskusPath(libraryPath, INDEX_DIRECTORY, LIBRARY_INDEX_FILENAME), {
      schemaVersion: 1,
      libraryId: library.id,
      writtenAt: new Date().toISOString(),
      library
    } satisfies LibraryIndexCache)
  }

  private async uniquePath(directory: string, filename: string): Promise<string> {
    const extension = extname(filename)
    const stem = basename(filename, extension)
    let candidate = join(directory, filename)
    let suffix = 2
    while (await this.pathExists(candidate)) {
      candidate = join(directory, `${stem} (${suffix})${extension}`)
      suffix += 1
    }
    return candidate
  }

  private async rewriteInboundReferences(
    libraryPath: string,
    replacements: ReadonlyMap<string, string>
  ): Promise<void> {
    if (replacements.size === 0) return
    const records = await this.readItemRecords(libraryPath)
    const updates: Array<{ path: string; source: string; next: string }> = []
    for (const record of records) {
      if (record.metadata.type !== 'note') continue
      const path = resolveInsideVault(libraryPath, record.relativePath)
      if (!(await this.pathExists(path))) continue
      const source = await readFile(path, 'utf8')
      const next = rewriteVaultReferences(source, path, path, libraryPath, replacements)
      if (next !== source) updates.push({ path, source, next })
    }
    const committed: Array<{ path: string; previous: string }> = []
    try {
      for (const update of updates) {
        const temporary = `${update.path}.${randomUUID()}.reference-update`
        const previous = `${update.path}.${randomUUID()}.previous`
        await writeFile(temporary, update.next, 'utf8')
        await rename(update.path, previous)
        try {
          await rename(temporary, update.path)
        } catch (error) {
          await rename(previous, update.path)
          throw error
        }
        committed.push({ path: update.path, previous })
      }
      await Promise.all(committed.map((entry) => rm(entry.previous, { force: true })))
    } catch (error) {
      for (const entry of committed.reverse()) {
        await rm(entry.path, { force: true })
        await rename(entry.previous, entry.path)
      }
      throw error
    }
  }

  async prepareNewLibrary(libraryPath: string, library: PersistedLibrary): Promise<void> {
    if (await this.pathExists(libraryPath)) {
      const targetStat = await stat(libraryPath)
      if (!targetStat.isDirectory()) {
        throw new Error(`A file named "${library.name}" already exists in the selected location.`)
      }
      if ((await readdir(libraryPath)).length > 0) {
        throw new Error(
          `The folder "${library.name}" already exists and is not empty. Choose another name or open it as an existing vault.`
        )
      }
    } else {
      await mkdir(libraryPath, { recursive: false })
    }
    await this.ensureLibraryDirectories(libraryPath)
    await mkdir(join(libraryPath, DEFAULT_ARCHIVE_DIRECTORY), { recursive: true })
    await writeJsonAtomic(kuskusPath(libraryPath, LIBRARY_FILENAME), {
      ...library,
      schemaVersion: 2
    })
  }

  async initializeExistingVault(libraryPath: string): Promise<PersistedLibrary> {
    const targetStat = await stat(libraryPath)
    if (!targetStat.isDirectory()) throw new Error('The selected vault path is not a folder.')
    const entries = await readdir(libraryPath)
    const archiveName = entries.includes(DEFAULT_ARCHIVE_DIRECTORY)
      ? DEFAULT_ARCHIVE_DIRECTORY
      : DEFAULT_ARCHIVE_DIRECTORY
    await this.ensureLibraryDirectories(libraryPath)
    const createdAt = new Date().toISOString()
    const library: PersistedLibrary = {
      schemaVersion: 2,
      id: randomUUID(),
      name: basename(libraryPath),
      createdAt
    }
    await writeJsonAtomic(kuskusPath(libraryPath, LIBRARY_FILENAME), {
      ...library,
      archiveDirectory: archiveName
    })
    await this.scanVault(libraryPath)
    return library
  }

  async readPersistedLibrary(libraryPath: string): Promise<PersistedLibrary> {
    const targetStat = await stat(libraryPath)
    if (!targetStat.isDirectory()) throw new Error('The library path is not a folder.')
    const v2Path = kuskusPath(libraryPath, LIBRARY_FILENAME)
    if (await this.pathExists(v2Path)) {
      const library = await readJson<unknown>(v2Path)
      if (!isPersistedLibrary(library) || library.schemaVersion !== 2) {
        throw new Error('This vault uses an unsupported Kuskus storage version.')
      }
      return library
    }
    const legacyPath = join(libraryPath, LIBRARY_FILENAME)
    if (await this.pathExists(legacyPath)) {
      const legacy = await readJson<unknown>(legacyPath)
      if (isPersistedLibrary(legacy) && legacy.schemaVersion === 1) {
        throw new Error('This Kuskus library needs migration to the vault-native format.')
      }
    }
    throw new Error('This folder has not been initialized as a Kuskus vault.')
  }

  async isLegacyLibrary(libraryPath: string): Promise<boolean> {
    try {
      const value = await readJson<unknown>(join(libraryPath, LIBRARY_FILENAME))
      return isPersistedLibrary(value) && value.schemaVersion === 1
    } catch {
      return false
    }
  }

  async isUninitializedVault(libraryPath: string): Promise<boolean> {
    try {
      const value = await stat(libraryPath)
      return (
        value.isDirectory() && !(await this.pathExists(kuskusPath(libraryPath, LIBRARY_FILENAME)))
      )
    } catch {
      return false
    }
  }

  async inspectUninitializedVault(libraryPath: string): Promise<{
    markdownFiles: number
    imageFiles: number
    otherFiles: number
    folders: number
    archiveFolderExists: boolean
  }> {
    const files = await this.listVisibleFiles(libraryPath)
    const markdownFiles = files.filter(
      (file) => extname(file.path).toLowerCase() === MARKDOWN_EXTENSION
    ).length
    const imageFiles = files.filter((file) => isImageExtension(extname(file.path))).length
    const folders = new Set<string>()
    for (const file of files) {
      let directory = slash(dirname(file.relativePath))
      while (directory !== '.' && directory !== DEFAULT_ARCHIVE_DIRECTORY) {
        folders.add(directory)
        const parent = slash(dirname(directory))
        if (parent === directory) break
        directory = parent
      }
    }
    return {
      markdownFiles,
      imageFiles,
      otherFiles: files.length - markdownFiles - imageFiles,
      folders: folders.size,
      archiveFolderExists: await this.pathExists(join(libraryPath, DEFAULT_ARCHIVE_DIRECTORY))
    }
  }

  async migrateLegacyLibrary(libraryPath: string): Promise<{ backupPath: string }> {
    const legacy = await readJson<unknown>(join(libraryPath, LIBRARY_FILENAME))
    if (!isPersistedLibrary(legacy) || legacy.schemaVersion !== 1) {
      throw new Error('This folder is not a supported legacy Kuskus library.')
    }
    const parent = dirname(libraryPath)
    const stagingPath = join(parent, `.${basename(libraryPath)}.${randomUUID()}.vault-migration`)
    const backupPath = join(
      parent,
      `${basename(libraryPath)} pre-v2 backup ${new Date().toISOString().replace(/[:.]/g, '-')}`
    )
    if (await this.pathExists(backupPath)) throw new Error('A migration backup already exists.')
    await mkdir(stagingPath, { recursive: false })
    try {
      await this.prepareNewLibrary(stagingPath, { ...legacy, schemaVersion: 2 })
      const collectionMap = new Map<string, string>()
      const legacyCollections = join(libraryPath, 'collections')
      if (await this.pathExists(legacyCollections)) {
        for (const entry of await readdir(legacyCollections, { withFileTypes: true })) {
          if (!entry.isDirectory() || !ITEM_ID_PATTERN.test(entry.name)) continue
          try {
            const value = await readJson<Record<string, unknown>>(
              join(legacyCollections, entry.name, 'collection.json')
            )
            if (typeof value.name !== 'string') continue
            const collection: PersistedCollection = {
              schemaVersion: 2,
              id: entry.name,
              name: value.name,
              createdAt:
                typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
              ...(typeof value.icon === 'string'
                ? { icon: value.icon as PersistedCollection['icon'] }
                : {})
            }
            await this.createCollection(stagingPath, collection)
            collectionMap.set(entry.name, entry.name)
          } catch {
            // Invalid legacy collections are not guessed during migration.
          }
        }
      }

      const sources: Array<{ directory: string; location: ItemLocation }> = [
        { directory: join(libraryPath, 'inbox'), location: { type: 'inbox' } },
        {
          directory: join(libraryPath, 'archive'),
          location: { type: 'archive', originalCollectionId: null }
        },
        {
          directory: join(libraryPath, 'trash'),
          location: {
            type: 'trash',
            trashedFrom: 'inbox',
            originalCollectionId: null
          }
        }
      ]
      for (const collectionId of collectionMap.keys()) {
        sources.push({
          directory: join(libraryPath, 'collections', collectionId, 'items'),
          location: { type: 'collection', collectionId }
        })
      }
      let migratedCount = 0
      for (const source of sources) {
        if (!(await this.pathExists(source.directory))) continue
        for (const entry of await readdir(source.directory, { withFileTypes: true })) {
          if (!entry.isDirectory() || !ITEM_ID_PATTERN.test(entry.name)) continue
          const itemDirectory = join(source.directory, entry.name)
          let metadata: PersistedItem
          try {
            const value = await readJson<unknown>(join(itemDirectory, 'item.json'))
            if (!isPersistedItem(value, entry.name)) continue
            metadata = { ...value, schemaVersion: 2 }
          } catch {
            continue
          }
          const files: Array<{ filename: string; data: string | Uint8Array }> = []
          if (metadata.type === 'note') {
            files.push({
              filename: 'note.md',
              data: await readFile(join(itemDirectory, 'note.md'), 'utf8')
            })
            for (const attachment of metadata.attachments ?? []) {
              const asset = join(itemDirectory, 'assets', attachment.filename)
              if (await this.pathExists(asset)) {
                files.push({
                  filename: `assets/${attachment.filename}`,
                  data: await readFile(asset)
                })
              }
            }
          } else if (metadata.type === 'image') {
            files.push({
              filename: metadata.contentFilename,
              data: await readFile(join(itemDirectory, metadata.contentFilename))
            })
          }
          await this.finalizeInboxItem(stagingPath, metadata, files)
          if (source.location.type !== 'inbox') {
            const item = await this.resolveItem(stagingPath, metadata.id)
            const destination: ItemLocation =
              source.location.type === 'archive'
                ? {
                    type: 'archive',
                    originalCollectionId: metadata.originalCollectionId
                  }
                : source.location.type === 'trash'
                  ? {
                      type: 'trash',
                      trashedFrom: metadata.trashedFrom ?? 'inbox',
                      originalCollectionId: metadata.originalCollectionId
                    }
                  : source.location
            await this.moveItems(stagingPath, [{ item, destination, metadata }])
          }
          migratedCount += 1
        }
      }
      const verified = await this.buildLibraryDto(stagingPath)
      if (verified.items.length !== migratedCount) {
        throw new Error('The converted vault did not pass item-count verification.')
      }
      await rename(libraryPath, backupPath)
      try {
        await rename(stagingPath, libraryPath)
      } catch (error) {
        await rename(backupPath, libraryPath)
        throw error
      }
      return { backupPath }
    } catch (error) {
      await rm(stagingPath, { recursive: true, force: true })
      throw error
    }
  }

  async ensureLibraryDirectories(libraryPath: string): Promise<void> {
    await Promise.all([
      mkdir(kuskusPath(libraryPath, RECORDS_DIRECTORY), { recursive: true }),
      mkdir(kuskusPath(libraryPath, COLLECTION_RECORDS_DIRECTORY), { recursive: true }),
      mkdir(kuskusPath(libraryPath, TRASH_DIRECTORY), { recursive: true }),
      mkdir(kuskusPath(libraryPath, 'temp'), { recursive: true }),
      mkdir(kuskusPath(libraryPath, URL_PREVIEW_DIRECTORY), { recursive: true })
    ])
  }

  private itemRecordPath(libraryPath: string, id: string): string {
    return kuskusPath(libraryPath, RECORDS_DIRECTORY, `${id}.json`)
  }

  private collectionRecordPath(libraryPath: string, id: string): string {
    return kuskusPath(libraryPath, COLLECTION_RECORDS_DIRECTORY, `${id}.json`)
  }

  private async readItemRecords(libraryPath: string): Promise<VaultItemRecord[]> {
    const directory = kuskusPath(libraryPath, RECORDS_DIRECTORY)
    await mkdir(directory, { recursive: true })
    const entries = (await readdir(directory, { withFileTypes: true })).filter(
      (entry) => entry.isFile() && entry.name.endsWith('.json')
    )
    const values = await mapWithConcurrency(entries, 32, async (entry) => {
      try {
        const value = await readJson<unknown>(join(directory, entry.name))
        if (!value || typeof value !== 'object') return null
        const record = value as VaultItemRecord
        if (
          record.schemaVersion === 2 &&
          ITEM_ID_PATTERN.test(record.id) &&
          typeof record.relativePath === 'string' &&
          isPersistedItem(record.metadata, record.id)
        ) {
          return record
        }
      } catch {
        // Invalid records remain on disk for explicit repair and are excluded from ordinary reads.
      }
      return null
    })
    return values.filter((record): record is VaultItemRecord => record !== null)
  }

  private async readCollectionRecords(libraryPath: string): Promise<VaultCollectionRecord[]> {
    const directory = kuskusPath(libraryPath, COLLECTION_RECORDS_DIRECTORY)
    await mkdir(directory, { recursive: true })
    const entries = (await readdir(directory, { withFileTypes: true })).filter(
      (entry) => entry.isFile() && entry.name.endsWith('.json')
    )
    const values = await mapWithConcurrency(entries, 32, async (entry) => {
      try {
        const value = await readJson<unknown>(join(directory, entry.name))
        if (!value || typeof value !== 'object') return null
        const record = value as VaultCollectionRecord
        if (
          record.schemaVersion === 2 &&
          ITEM_ID_PATTERN.test(record.id) &&
          typeof record.name === 'string' &&
          typeof record.relativePath === 'string'
        ) {
          return {
            ...record,
            icon: isCollectionIconKey(record.icon) ? record.icon : undefined
          } as VaultCollectionRecord
        }
      } catch {
        // Invalid records remain available for manual recovery.
      }
      return null
    })
    return values.filter((record): record is VaultCollectionRecord => record !== null)
  }

  private async writeItemRecord(libraryPath: string, record: VaultItemRecord): Promise<void> {
    await writeJsonAtomic(this.itemRecordPath(libraryPath, record.id), record)
  }

  private async writeCollectionRecord(
    libraryPath: string,
    record: VaultCollectionRecord
  ): Promise<void> {
    await writeJsonAtomic(this.collectionRecordPath(libraryPath, record.id), record)
  }

  private async listVisibleFiles(libraryPath: string): Promise<ScannedFile[]> {
    const files: ScannedFile[] = []
    const walk = async (directory: string, archive: boolean): Promise<void> => {
      const entries = await readdir(directory, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue
        const path = join(directory, entry.name)
        const relativePath = slash(relative(libraryPath, path))
        if (entry.isDirectory()) {
          if (HIDDEN_DIRECTORY.test(entry.name)) continue
          await walk(path, archive || relativePath === DEFAULT_ARCHIVE_DIRECTORY)
          continue
        }
        if (!entry.isFile()) continue
        if (HIDDEN_DIRECTORY.test(entry.name) || entry.name.endsWith('.kuskus-initialize-backup'))
          continue
        files.push({ path, relativePath, archive })
      }
    }
    await walk(libraryPath, false)
    return files
  }

  private async fingerprint(path: string): Promise<string> {
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(path)) hash.update(chunk)
    return hash.digest('hex')
  }

  private fileIdentityFromStats(value: Stats): string | null {
    if (value.ino === 0) return null
    return `${value.dev.toString()}:${value.ino.toString()}`
  }

  private async fileIdentity(path: string): Promise<string | null> {
    return this.fileIdentityFromStats(await stat(path))
  }

  private async metadataForFile(
    file: ScannedFileWithStat,
    id: string,
    existing: VaultItemRecord | undefined
  ): Promise<PersistedItem> {
    const fileStat = file.stats
    const createdAt = metadataTimestamp(fileStat.birthtime)
    const updatedAt = metadataTimestamp(fileStat.mtime)
    const title = titleFromPath(file.relativePath)
    if (extname(file.path).toLowerCase() === INTERNET_SHORTCUT_EXTENSION) {
      const sourceUrl = parseInternetShortcut(await readFile(file.path, 'utf8'))
      const metadata =
        existing?.metadata.type === 'url'
          ? existing.metadata
          : createUrlMetadata(id, sourceUrl, createdAt)
      return {
        ...metadata,
        schemaVersion: 2,
        title,
        sourceUrl,
        domain: new URL(sourceUrl).hostname,
        updatedAt,
        relativePath: file.relativePath,
        referencedAttachment: false
      }
    }
    if (extname(file.path).toLowerCase() === MARKDOWN_EXTENSION) {
      const source = await readFile(file.path, 'utf8')
      const metadata =
        existing?.metadata.type === 'note'
          ? existing.metadata
          : createNoteMetadata(id, source, createdAt)
      return {
        ...metadata,
        schemaVersion: 2,
        title,
        updatedAt,
        relativePath: file.relativePath,
        referencedAttachment: false
      }
    }

    const bytes = await readFile(file.path)
    const detected = detectImage(bytes)
    if (!detected) {
      const metadata: PersistedFileItem =
        existing?.metadata.type === 'file'
          ? existing.metadata
          : {
              schemaVersion: 2,
              id,
              type: 'file',
              title,
              createdAt,
              updatedAt,
              sourceUrl: null,
              sourceFilename: basename(file.path),
              contentFilename: basename(file.path),
              mediaType: mimeForExtension(extname(file.path)),
              size: fileStat.size,
              note: '',
              originalCollectionId: null
            }
      return {
        ...metadata,
        title,
        updatedAt,
        sourceFilename: basename(file.path),
        contentFilename: basename(file.path),
        size: fileStat.size,
        relativePath: file.relativePath
      }
    }
    const metadata =
      existing?.metadata.type === 'image'
        ? existing.metadata
        : createImageMetadata(id, basename(file.path), detected, createdAt)
    return {
      ...metadata,
      schemaVersion: 2,
      title,
      updatedAt,
      sourceFilename: basename(file.path),
      contentFilename: basename(file.path),
      mediaType: detected.mediaType,
      width: detected.width,
      height: detected.height,
      relativePath: file.relativePath
    } satisfies PersistedImageItem
  }

  private async scanCollections(
    libraryPath: string,
    files: ScannedFile[]
  ): Promise<VaultCollectionRecord[]> {
    const existing = await this.readCollectionRecords(libraryPath)
    const byPath = new Map(existing.map((record) => [record.relativePath.toLowerCase(), record]))
    const folderPaths = new Set<string>()
    for (const record of existing) {
      if (
        record.relativePath !== DEFAULT_ARCHIVE_DIRECTORY &&
        !HIDDEN_DIRECTORY.test(record.relativePath) &&
        (await this.pathExists(resolveInsideVault(libraryPath, record.relativePath)))
      ) {
        folderPaths.add(record.relativePath)
      }
    }
    for (const file of files) {
      if (file.archive) continue
      let current = slash(dirname(file.relativePath))
      while (current && current !== '.' && current !== DEFAULT_ARCHIVE_DIRECTORY) {
        if (!ASSETS_DIRECTORY.test(current)) folderPaths.add(current)
        current = slash(dirname(current))
      }
    }
    const sortedPaths = [...folderPaths].sort((a, b) => a.split('/').length - b.split('/').length)
    const result: VaultCollectionRecord[] = []
    for (const relativePath of sortedPaths) {
      const current = byPath.get(relativePath.toLowerCase())
      const parentPath = slash(dirname(relativePath))
      const parent = result.find((record) => record.relativePath === parentPath)
      const record: VaultCollectionRecord = {
        schemaVersion: 2,
        id: current?.id ?? randomUUID(),
        name: basename(relativePath),
        icon: current?.icon,
        createdAt: current?.createdAt ?? new Date().toISOString(),
        relativePath,
        parentId: parent?.id ?? null
      }
      if (!current || JSON.stringify(current) !== JSON.stringify(record)) {
        await this.writeCollectionRecord(libraryPath, record)
      }
      result.push(record)
    }
    return result
  }

  private locationForPath(
    relativePath: string,
    collections: VaultCollectionRecord[],
    metadata: PersistedItem
  ): ItemLocation {
    if (relativePath.startsWith(`${KUSKUS_DIRECTORY}/${TRASH_DIRECTORY}/`)) {
      return {
        type: 'trash',
        trashedFrom: metadata.trashedFrom ?? 'inbox',
        originalCollectionId: metadata.originalCollectionId
      }
    }
    if (
      relativePath === DEFAULT_ARCHIVE_DIRECTORY ||
      relativePath.startsWith(`${DEFAULT_ARCHIVE_DIRECTORY}/`)
    ) {
      return { type: 'archive', originalCollectionId: metadata.originalCollectionId }
    }
    const parentPath = slash(dirname(relativePath))
    if (parentPath === '.') return { type: 'inbox' }
    const collection = collections.find((entry) => entry.relativePath === parentPath)
    return collection ? { type: 'collection', collectionId: collection.id } : { type: 'inbox' }
  }

  private async performScanVault(
    libraryPath: string
  ): Promise<{ records: VaultItemRecord[]; collections: VaultCollectionRecord[] }> {
    await this.ensureLibraryDirectories(libraryPath)
    const files = await this.listVisibleFiles(libraryPath)
    const collections = await this.scanCollections(libraryPath, files)
    const existing = await this.readItemRecords(libraryPath)
    const byPath = new Map(existing.map((record) => [record.relativePath.toLowerCase(), record]))
    const byFingerprint = new Map<string, VaultItemRecord[]>()
    const byFileIdentity = new Map<string, VaultItemRecord[]>()
    for (const record of existing) {
      if (record.fingerprint) {
        const entries = byFingerprint.get(record.fingerprint) ?? []
        entries.push(record)
        byFingerprint.set(record.fingerprint, entries)
      }
      if (record.fileIdentity) {
        const entries = byFileIdentity.get(record.fileIdentity) ?? []
        entries.push(record)
        byFileIdentity.set(record.fileIdentity, entries)
      }
    }

    const seenIds = new Set<string>()
    const records: VaultItemRecord[] = []
    const filesWithStats = await mapWithConcurrency(files, 32, async (file) => ({
      ...file,
      stats: await stat(file.path)
    }))
    const scanEntries = await mapWithConcurrency(filesWithStats, 8, async (file) => {
      const current = byPath.get(file.relativePath.toLowerCase())
      const fileIdentity = this.fileIdentityFromStats(file.stats)
      const unchanged =
        current !== undefined &&
        current.fileSize === file.stats.size &&
        current.modifiedAtMs === file.stats.mtimeMs &&
        current.fileIdentity === fileIdentity
      return {
        file,
        fileIdentity,
        fingerprint: unchanged ? current.fingerprint : await this.fingerprint(file.path),
        unchanged
      }
    })
    const fingerprintCounts = new Map<string, number>()
    for (const entry of scanEntries) {
      if (entry.fingerprint) {
        fingerprintCounts.set(
          entry.fingerprint,
          (fingerprintCounts.get(entry.fingerprint) ?? 0) + 1
        )
      }
    }
    const plannedRecords: Array<{
      file: ScannedFileWithStat
      fileIdentity: string | null
      fingerprint: string | null
      unchanged: boolean
      current: VaultItemRecord | undefined
      id: string
    }> = []
    for (const { file, fileIdentity, fingerprint, unchanged } of scanEntries) {
      let current = byPath.get(file.relativePath.toLowerCase())
      if (!current && fileIdentity) {
        const matches = (byFileIdentity.get(fileIdentity) ?? []).filter(
          (record) => !seenIds.has(record.id)
        )
        if (matches.length === 1) current = matches[0]
      }
      if (!current && fingerprint && fingerprintCounts.get(fingerprint) === 1) {
        const matches = (byFingerprint.get(fingerprint) ?? []).filter(
          (record) => !seenIds.has(record.id)
        )
        if (matches.length === 1) current = matches[0]
      }
      let id = current?.id ?? randomUUID()
      if (seenIds.has(id)) id = randomUUID()
      plannedRecords.push({ file, fileIdentity, fingerprint, unchanged, current, id })
      seenIds.add(id)
    }
    const builtRecords = await mapWithConcurrency(plannedRecords, 16, async (planned) => {
      const { file, fileIdentity, fingerprint, unchanged, current, id } = planned
      const metadata =
        unchanged && current ? current.metadata : await this.metadataForFile(file, id, current)
      const record: VaultItemRecord = {
        schemaVersion: 2,
        id,
        relativePath: file.relativePath,
        fingerprint,
        fileIdentity,
        fileSize: file.stats.size,
        modifiedAtMs: file.stats.mtimeMs,
        recovery:
          unchanged && current?.recovery
            ? { ...current.recovery, missingSince: null }
            : { lastSeenAt: new Date().toISOString(), missingSince: null },
        metadata
      }
      return { record, changed: !current || !recordsEqual(current, record) }
    })
    records.push(...builtRecords.map(({ record }) => record))
    await mapWithConcurrency(
      builtRecords.filter(({ changed }) => changed),
      16,
      async ({ record }) => this.writeItemRecord(libraryPath, record)
    )

    const references = new Set<string>()
    const availablePaths = records.map((record) =>
      resolveInsideVault(libraryPath, record.relativePath)
    )
    const noteRecords = records.filter((record) => record.metadata.type === 'note')
    const noteReferences = await mapWithConcurrency(noteRecords, 32, async (record) => {
      const notePath = resolveInsideVault(libraryPath, record.relativePath)
      const source = await readFile(notePath, 'utf8')
      return extractVaultReferenceTargets(source).map((reference) => {
        const target = resolveVaultReferencePath(reference, notePath, libraryPath, availablePaths)
        return slash(relative(libraryPath, target)).toLowerCase()
      })
    })
    for (const targets of noteReferences) {
      for (const target of targets) references.add(target)
    }
    const referenceUpdates: VaultItemRecord[] = []
    for (const record of records) {
      if (record.metadata.type !== 'image' && record.metadata.type !== 'file') continue
      const referencedAttachment = references.has(record.relativePath.toLowerCase())
      if (record.metadata.referencedAttachment !== referencedAttachment) {
        record.metadata = { ...record.metadata, referencedAttachment }
        referenceUpdates.push(record)
      }
    }
    await mapWithConcurrency(referenceUpdates, 16, async (record) =>
      this.writeItemRecord(libraryPath, record)
    )
    const missingRecords: VaultItemRecord[] = []
    for (const record of existing) {
      if (seenIds.has(record.id)) continue
      const missing = {
        ...record,
        recovery: {
          lastSeenAt: record.recovery?.lastSeenAt ?? record.metadata.updatedAt,
          missingSince: record.recovery?.missingSince ?? new Date().toISOString()
        }
      }
      if (!recordsEqual(record, missing)) missingRecords.push(missing)
      records.push(missing)
    }
    await mapWithConcurrency(missingRecords, 16, async (record) =>
      this.writeItemRecord(libraryPath, record)
    )
    return { records, collections }
  }

  private async scanVault(
    libraryPath: string
  ): Promise<{ records: VaultItemRecord[]; collections: VaultCollectionRecord[] }> {
    const key = resolve(libraryPath)
    const active = this.scanPromises.get(key)
    if (active) return active
    const scan = this.performScanVault(libraryPath)
      .then((snapshot) => {
        this.scanSnapshots.set(key, snapshot)
        return snapshot
      })
      .finally(() => {
        this.scanPromises.delete(key)
      })
    this.scanPromises.set(key, scan)
    return scan
  }

  private async cleanupVisibleMetadata(
    libraryPath: string
  ): Promise<{ cleanup: VaultCleanupDto; conflicts: VaultRepairConflictDto[] }> {
    const migrationDirectory = kuskusPath(libraryPath, 'migrations')
    const markerPath = join(migrationDirectory, CLEANUP_MARKER)
    await mkdir(migrationDirectory, { recursive: true })
    if (await this.pathExists(markerPath)) {
      const marker = await readJson<CleanupMarker>(markerPath)
      return {
        cleanup: {
          status: marker.status,
          affectedFiles: marker.affectedFiles,
          recoveryRelativePath: marker.recoveryRelativePath
        },
        conflicts: marker.conflicts
      }
    }

    const files = (await this.listVisibleFiles(libraryPath)).filter(
      (file) => extname(file.path).toLowerCase() === MARKDOWN_EXTENSION
    )
    const records = await this.readItemRecords(libraryPath)
    const conflicts: VaultRepairConflictDto[] = []
    const candidates: Array<{
      file: ScannedFile
      source: string
      next: string
      destination: string
      record: VaultItemRecord | undefined
      url: string | null
    }> = []

    for (const file of files) {
      const source = await readFile(file.path, 'utf8')
      if (!/\bkuskus-(?:id|type)\s*:/i.test(source)) continue
      let parsed
      try {
        parsed = readVaultFrontmatter(source)
      } catch (error) {
        conflicts.push({
          kind: 'legacy-metadata',
          relativePath: file.relativePath,
          message: error instanceof Error ? error.message : 'The frontmatter could not be parsed.'
        })
        continue
      }
      if (!parsed.kuskusId && !parsed.kuskusType) continue
      const record =
        records.find((entry) => entry.id === parsed.kuskusId) ??
        records.find(
          (entry) => entry.relativePath.toLowerCase() === file.relativePath.toLowerCase()
        )
      const isBookmark = parsed.kuskusType?.toLowerCase() === 'link' && parsed.kuskusUrl
      if (parsed.kuskusType && !isBookmark) {
        conflicts.push({
          kind: 'legacy-metadata',
          relativePath: file.relativePath,
          message: 'The legacy Kuskus bookmark properties are incomplete and were left unchanged.'
        })
        continue
      }
      if (isBookmark && (parsed.body.trim() || parsed.userPropertyCount > 0)) {
        conflicts.push({
          kind: 'legacy-bookmark',
          relativePath: file.relativePath,
          message:
            'This legacy bookmark also contains user-authored Markdown or properties and was left unchanged.'
        })
        continue
      }
      const destination = isBookmark
        ? join(
            dirname(file.path),
            `${basename(file.path, MARKDOWN_EXTENSION)}${INTERNET_SHORTCUT_EXTENSION}`
          )
        : file.path
      if (destination !== file.path && (await this.pathExists(destination))) {
        conflicts.push({
          kind: 'legacy-bookmark',
          relativePath: file.relativePath,
          message: 'A matching Internet Shortcut filename already exists.'
        })
        continue
      }
      candidates.push({
        file,
        source,
        next: isBookmark
          ? createInternetShortcut(parsed.kuskusUrl as string)
          : removeKuskusFrontmatter(source, false),
        destination,
        record,
        url: isBookmark ? parsed.kuskusUrl : null
      })
    }

    if (candidates.length === 0) {
      const marker: CleanupMarker = {
        schemaVersion: 1,
        status: conflicts.length ? 'conflicts' : 'not-needed',
        affectedFiles: 0,
        recoveryRelativePath: null,
        conflicts,
        completedAt: new Date().toISOString()
      }
      await writeJsonAtomic(markerPath, marker)
      return { cleanup: marker, conflicts }
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const recoveryDirectory = join(migrationDirectory, `visible-metadata-${stamp}`)
    const originalsDirectory = join(recoveryDirectory, 'originals')
    const transactionDirectory = kuskusPath(
      libraryPath,
      'temp',
      `${randomUUID()}.visible-metadata-cleanup`
    )
    await mkdir(originalsDirectory, { recursive: true })
    await mkdir(transactionDirectory, { recursive: true })
    const manifest: Array<{
      relativePath: string
      destinationRelativePath: string
      sha256: string
    }> = []
    try {
      for (const candidate of candidates) {
        const backup = join(originalsDirectory, candidate.file.relativePath)
        const staged = join(transactionDirectory, candidate.file.relativePath)
        await mkdir(dirname(backup), { recursive: true })
        await mkdir(dirname(staged), { recursive: true })
        await writeFile(backup, candidate.source, 'utf8')
        await writeFile(staged, candidate.next, 'utf8')
        const sha256 = createHash('sha256').update(candidate.source).digest('hex')
        const backupSha256 = createHash('sha256')
          .update(await readFile(backup))
          .digest('hex')
        if (backupSha256 !== sha256) {
          throw new Error(
            `The recovery copy for ${candidate.file.relativePath} failed verification.`
          )
        }
        manifest.push({
          relativePath: candidate.file.relativePath,
          destinationRelativePath: slash(relative(libraryPath, candidate.destination)),
          sha256
        })
      }
      await writeJsonAtomic(join(recoveryDirectory, 'manifest.json'), {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        files: manifest
      })
      for (const candidate of candidates) {
        const staged = join(transactionDirectory, candidate.file.relativePath)
        await rm(candidate.file.path, { force: true })
        await rename(staged, candidate.destination)
        if (candidate.url) parseInternetShortcut(await readFile(candidate.destination, 'utf8'))
        else {
          const verified = readVaultFrontmatter(await readFile(candidate.destination, 'utf8'))
          if (verified.kuskusId || verified.kuskusType) {
            throw new Error(`Kuskus metadata remained in ${candidate.file.relativePath}.`)
          }
        }
        if (candidate.record) {
          const relativePath = slash(relative(libraryPath, candidate.destination))
          const metadata = candidate.url
            ? {
                ...(candidate.record.metadata.type === 'url'
                  ? candidate.record.metadata
                  : createUrlMetadata(
                      candidate.record.id,
                      candidate.url,
                      new Date().toISOString()
                    )),
                schemaVersion: 2 as const,
                type: 'url' as const,
                title: titleFromPath(relativePath),
                sourceUrl: candidate.url,
                domain: new URL(candidate.url).hostname,
                relativePath
              }
            : { ...candidate.record.metadata, relativePath }
          await this.writeItemRecord(libraryPath, {
            ...candidate.record,
            relativePath,
            fingerprint: await this.fingerprint(candidate.destination),
            fileIdentity: await this.fileIdentity(candidate.destination),
            recovery: { lastSeenAt: new Date().toISOString(), missingSince: null },
            metadata: metadata as PersistedItem
          })
        }
      }
    } catch (error) {
      for (const candidate of candidates) {
        if (candidate.destination !== candidate.file.path)
          await rm(candidate.destination, { force: true })
        const backup = join(originalsDirectory, candidate.file.relativePath)
        if (await this.pathExists(backup)) {
          await mkdir(dirname(candidate.file.path), { recursive: true })
          await writeFile(candidate.file.path, await readFile(backup))
        }
        if (candidate.record) await this.writeItemRecord(libraryPath, candidate.record)
      }
      await rm(transactionDirectory, { recursive: true, force: true })
      throw error
    }
    await rm(transactionDirectory, { recursive: true, force: true })
    const marker: CleanupMarker = {
      schemaVersion: 1,
      status: conflicts.length ? 'conflicts' : 'completed',
      affectedFiles: candidates.length,
      recoveryRelativePath: slash(relative(libraryPath, recoveryDirectory)),
      conflicts,
      completedAt: new Date().toISOString()
    }
    await writeJsonAtomic(markerPath, marker)
    return { cleanup: marker, conflicts }
  }

  async buildLibraryDto(libraryPath: string): Promise<LibraryDto> {
    const library = await this.readPersistedLibrary(libraryPath)
    const cleanupResult = await this.cleanupVisibleMetadata(libraryPath)
    const { records, collections } = await this.scanVault(libraryPath)
    const context = await this.createDtoBuildContext(libraryPath)
    const allRecords = context.itemRecords
    const items = await mapWithConcurrency(records, 32, (record) =>
      this.recordToDto(libraryPath, record, collections, context)
    )
    const trashRecords = allRecords.filter((record) =>
      record.relativePath.startsWith(`${KUSKUS_DIRECTORY}/${TRASH_DIRECTORY}/`)
    )
    for (const record of trashRecords) {
      if (!items.some((item) => item.id === record.id)) {
        items.push(await this.recordToDto(libraryPath, record, collections, context))
      }
    }
    const dto: LibraryDto = {
      ...library,
      schemaVersion: 2,
      path: libraryPath,
      items: items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      collections: collections.map(toCollectionDto),
      cleanup: cleanupResult.cleanup,
      repairConflicts: cleanupResult.conflicts
    }
    await this.writeCachedLibraryDto(libraryPath, dto)
    return dto
  }

  async reconcileKnownFiles(
    libraryPath: string,
    library: LibraryDto,
    relativePaths: readonly string[]
  ): Promise<LibraryDto | null> {
    const key = resolve(libraryPath)
    const snapshot = this.scanSnapshots.get(key)
    if (!snapshot || relativePaths.length === 0) return null
    const records = [...snapshot.records]
    const recordByPath = new Map(
      records.map((record) => [record.relativePath.toLocaleLowerCase(), record])
    )
    const itemById = new Map(library.items.map((item) => [item.id, item]))
    const changedRecords: VaultItemRecord[] = []

    for (const relativePath of new Set(relativePaths)) {
      const normalizedPath = slash(relativePath)
      const current = recordByPath.get(normalizedPath.toLocaleLowerCase())
      const item = current ? itemById.get(current.id) : null
      if (!current || !item || current.recovery?.missingSince) return null
      const path = resolveInsideVault(libraryPath, normalizedPath)
      let fileStats: Stats
      try {
        fileStats = await stat(path)
      } catch {
        return null
      }
      if (!fileStats.isFile()) return null
      if (
        current.fileSize === fileStats.size &&
        current.modifiedAtMs === fileStats.mtimeMs &&
        current.fileIdentity === this.fileIdentityFromStats(fileStats)
      ) {
        continue
      }
      if (item.type === 'note') {
        const nextBody = await readFile(path, 'utf8')
        const previousReferences = extractVaultReferenceTargets(item.body).sort()
        const nextReferences = extractVaultReferenceTargets(nextBody).sort()
        if (JSON.stringify(previousReferences) !== JSON.stringify(nextReferences)) return null
      }
      const file: ScannedFileWithStat = {
        path,
        relativePath: normalizedPath,
        archive:
          normalizedPath === DEFAULT_ARCHIVE_DIRECTORY ||
          normalizedPath.startsWith(`${DEFAULT_ARCHIVE_DIRECTORY}/`),
        stats: fileStats
      }
      const nextRecord: VaultItemRecord = {
        schemaVersion: 2,
        id: current.id,
        relativePath: normalizedPath,
        fingerprint: await this.fingerprint(path),
        fileIdentity: this.fileIdentityFromStats(fileStats),
        fileSize: fileStats.size,
        modifiedAtMs: fileStats.mtimeMs,
        recovery: { lastSeenAt: new Date().toISOString(), missingSince: null },
        metadata: await this.metadataForFile(file, current.id, current)
      }
      await this.writeItemRecord(libraryPath, nextRecord)
      const index = records.findIndex((record) => record.id === current.id)
      records[index] = nextRecord
      recordByPath.set(normalizedPath.toLocaleLowerCase(), nextRecord)
      changedRecords.push(nextRecord)
    }

    if (changedRecords.length === 0) return library
    const context = this.dtoBuildContextFromRecords(libraryPath, records)
    const changedItems = await Promise.all(
      changedRecords.map((record) =>
        this.recordToDto(libraryPath, record, snapshot.collections, context)
      )
    )
    const changedById = new Map(changedItems.map((item) => [item.id, item]))
    const nextLibrary: LibraryDto = {
      ...library,
      items: library.items
        .map((item) => changedById.get(item.id) ?? item)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    }
    this.scanSnapshots.set(key, { records, collections: snapshot.collections })
    await this.writeCachedLibraryDto(libraryPath, nextLibrary)
    return nextLibrary
  }

  private async createDtoBuildContext(libraryPath: string): Promise<DtoBuildContext> {
    const itemRecords = await this.readItemRecords(libraryPath)
    return this.dtoBuildContextFromRecords(libraryPath, itemRecords)
  }

  private dtoBuildContextFromRecords(
    libraryPath: string,
    itemRecords: VaultItemRecord[]
  ): DtoBuildContext {
    const attachmentRecords = itemRecords.filter(isAttachmentItemRecord)
    return {
      itemRecords,
      attachmentRecords,
      attachmentRecordIds: new Set(attachmentRecords.map((item) => item.id)),
      availablePaths: itemRecords.flatMap((item) => [
        resolveInsideVault(libraryPath, item.relativePath),
        ...(item.metadata.trashedFromRelativePath
          ? [resolveInsideVault(libraryPath, item.metadata.trashedFromRelativePath)]
          : [])
      ]),
      imageDetection: new Map()
    }
  }

  private async recordToDto(
    libraryPath: string,
    record: VaultItemRecord,
    collections: VaultCollectionRecord[],
    context?: DtoBuildContext
  ): Promise<LibraryItemDto> {
    const metadata = { ...record.metadata, relativePath: record.relativePath }
    const location = this.locationForPath(record.relativePath, collections, metadata)
    const path = resolveInsideVault(libraryPath, record.relativePath)
    if (metadata.type === 'url') return toUrlDto(metadata, location)
    if (metadata.type === 'image') {
      return { ...toImageDto(metadata, location), missingContent: !(await this.pathExists(path)) }
    }
    if (metadata.type === 'file') {
      return {
        schemaVersion: 2,
        id: metadata.id,
        type: 'file',
        title: metadata.title,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        sourceFilename: metadata.sourceFilename,
        contentFilename: metadata.contentFilename,
        mediaType: metadata.mediaType,
        size: metadata.size,
        missingContent: !(await this.pathExists(path)),
        location,
        relativePath: record.relativePath,
        referencedAttachment: metadata.referencedAttachment ?? false
      } satisfies FileItemDto
    }
    let body = ''
    let missingContent = false
    try {
      body = await readFile(path, 'utf8')
    } catch {
      missingContent = true
    }
    const attachments = await this.noteAttachments(
      libraryPath,
      record,
      body,
      context ?? (await this.createDtoBuildContext(libraryPath))
    )
    return { ...toNoteDto(metadata, body, attachments, location), missingContent }
  }

  private async noteAttachments(
    libraryPath: string,
    record: VaultItemRecord,
    source: string,
    context?: DtoBuildContext
  ): Promise<NoteAttachmentDto[]> {
    if (record.metadata.type !== 'note') return []
    const buildContext = context ?? (await this.createDtoBuildContext(libraryPath))

    const notePath = resolveInsideVault(libraryPath, record.relativePath)
    const attachments: NoteAttachmentDto[] = []
    const seenTargets = new Set<string>()
    for (const reference of extractVaultReferenceTargets(source)) {
      const target = resolveVaultReferencePath(
        reference,
        notePath,
        libraryPath,
        buildContext.availablePaths
      )
      const targetKey = pathKey(target)
      if (seenTargets.has(targetKey)) continue
      seenTargets.add(targetKey)
      const relativePath = slash(relative(dirname(notePath), target))
      if (!target.startsWith(`${resolve(libraryPath)}${sep}`) || !isImageExtension(extname(target)))
        continue
      const targetExists = await this.pathExists(target)
      const binaryRecord = this.attachmentRecordForTarget(
        libraryPath,
        notePath,
        record.metadata,
        target,
        buildContext.attachmentRecords,
        targetExists
      )
      let width = binaryRecord?.metadata.type === 'image' ? binaryRecord.metadata.width : 1
      let height = binaryRecord?.metadata.type === 'image' ? binaryRecord.metadata.height : 1
      let mediaType =
        binaryRecord?.metadata.type === 'image'
          ? binaryRecord.metadata.mediaType
          : (mimeForExtension(extname(target)) as NoteAttachmentDto['mediaType'])
      let missingContent = !targetExists
      if (targetExists && !binaryRecord) {
        const key = pathKey(target)
        let detection = buildContext.imageDetection.get(key)
        if (!detection) {
          detection = readFile(target).then((bytes) => detectImage(bytes))
          buildContext.imageDetection.set(key, detection)
        }
        const detected = await detection
        if (detected) {
          width = detected.width
          height = detected.height
          mediaType = detected.mediaType
          missingContent = false
        }
      }
      attachments.push({
        id: binaryRecord?.id ?? randomUUID(),
        filename: basename(target),
        relativePath: relativePath.startsWith('.') ? relativePath : `./${relativePath}`,
        sourceFilename: basename(target),
        mediaType,
        width,
        height,
        missingContent
      })
    }
    await this.reconcileNoteAttachmentMetadata(
      libraryPath,
      notePath,
      record,
      record.metadata,
      attachments.filter((attachment) => buildContext.attachmentRecordIds.has(attachment.id))
    )
    return attachments
  }

  private attachmentRecordForTarget(
    libraryPath: string,
    notePath: string,
    noteMetadata: PersistedNoteItem,
    target: string,
    attachmentRecords: readonly AttachmentItemRecord[],
    targetExists: boolean
  ): AttachmentItemRecord | undefined {
    const targetRelativePath = slash(relative(libraryPath, target)).toLowerCase()
    const exactActiveRecord = attachmentRecords.find(
      (entry) =>
        targetExists &&
        !entry.relativePath.startsWith(`${KUSKUS_DIRECTORY}/`) &&
        entry.relativePath.toLowerCase() === targetRelativePath
    )
    if (exactActiveRecord) return exactActiveRecord

    for (const attachment of noteMetadata.attachments ?? []) {
      const storedTarget = resolve(
        dirname(notePath),
        normalizeMarkdownImageTarget(attachment.relativePath)
      )
      if (pathKey(storedTarget) !== pathKey(target)) continue
      const persistedRecord = attachmentRecords.find(
        (entry) =>
          entry.id === attachment.id &&
          (entry.relativePath.toLowerCase() === targetRelativePath ||
            entry.metadata.trashedFromRelativePath?.toLowerCase() === targetRelativePath)
      )
      if (persistedRecord) return persistedRecord
    }

    const historicalRecords = attachmentRecords.filter(
      (entry) => entry.metadata.trashedFromRelativePath?.toLowerCase() === targetRelativePath
    )
    return historicalRecords.length === 1 ? historicalRecords[0] : undefined
  }

  private async reconcileNoteAttachmentMetadata(
    libraryPath: string,
    notePath: string,
    record: VaultItemRecord,
    noteMetadata: PersistedNoteItem,
    attachments: readonly NoteAttachmentDto[]
  ): Promise<void> {
    if (!(await this.pathExists(notePath))) return
    const persistedAttachments = attachments.map(attachmentMetadataFromDto)
    if (attachmentsEqual(noteMetadata.attachments ?? [], persistedAttachments)) return
    await this.writeItemRecord(libraryPath, {
      ...record,
      metadata: { ...noteMetadata, attachments: persistedAttachments }
    })
  }

  async createCollection(libraryPath: string, collection: PersistedCollection): Promise<void> {
    const parentId = collection.parentId ?? null
    let directory = libraryPath
    if (parentId !== null) {
      const parent = (await this.readPersistedCollections(libraryPath)).find(
        (record) => record.id === parentId
      )
      if (!parent) throw new Error('The parent folder no longer exists.')
      directory = resolveInsideVault(libraryPath, parent.relativePath ?? parent.name)
      const parentStat = await stat(directory)
      if (!parentStat.isDirectory()) throw new Error('The parent folder is unavailable.')
    }
    const path = await this.uniquePath(directory, safeStem(collection.name, 'New collection'))
    await mkdir(path, { recursive: false })
    try {
      await this.writeCollectionRecord(libraryPath, {
        ...collection,
        schemaVersion: 2,
        name: basename(path),
        relativePath: slash(relative(libraryPath, path)),
        parentId
      })
    } catch (error) {
      await rm(path, { recursive: true, force: true })
      throw error
    }
  }

  async readCollections(libraryPath: string): Promise<CollectionDto[]> {
    return (await this.scanVault(libraryPath)).collections.map(toCollectionDto)
  }

  async readPersistedCollections(libraryPath: string): Promise<PersistedCollection[]> {
    return (await this.scanVault(libraryPath)).collections
  }

  async updateCollection(libraryPath: string, collection: PersistedCollection): Promise<void> {
    const records = await this.readCollectionRecords(libraryPath)
    const current = records.find((entry) => entry.id === collection.id)
    if (!current) throw new Error('This folder no longer exists.')
    let relativePath = current.relativePath
    if (collection.name !== current.name) {
      const source = resolveInsideVault(libraryPath, current.relativePath)
      const destination = await this.uniquePath(
        dirname(source),
        safeStem(collection.name, current.name)
      )
      await rename(source, destination)
      relativePath = slash(relative(libraryPath, destination))
      for (const item of await this.readItemRecords(libraryPath)) {
        if (!item.relativePath.startsWith(`${current.relativePath}/`)) continue
        item.relativePath = `${relativePath}${item.relativePath.slice(current.relativePath.length)}`
        item.metadata = { ...item.metadata, relativePath: item.relativePath }
        await this.writeItemRecord(libraryPath, item)
      }
      for (const child of records) {
        if (!child.relativePath.startsWith(`${current.relativePath}/`)) continue
        child.relativePath = `${relativePath}${child.relativePath.slice(current.relativePath.length)}`
        child.name = basename(child.relativePath)
        await this.writeCollectionRecord(libraryPath, child)
      }
    }
    await this.writeCollectionRecord(libraryPath, {
      ...current,
      ...collection,
      schemaVersion: 2,
      name: basename(relativePath),
      relativePath
    })
  }

  async moveCollection(
    libraryPath: string,
    collectionId: string,
    parentId: string | null
  ): Promise<void> {
    const collectionRecords = await this.readCollectionRecords(libraryPath)
    const current = collectionRecords.find((entry) => entry.id === collectionId)
    if (!current) throw new Error('This folder no longer exists.')
    let destinationDirectory = libraryPath
    if (parentId !== null) {
      const parent = collectionRecords.find((entry) => entry.id === parentId)
      if (!parent) throw new Error('The destination folder no longer exists.')
      if (parent.id === current.id || parent.relativePath.startsWith(`${current.relativePath}/`)) {
        throw new Error('A folder cannot be moved inside itself or one of its subfolders.')
      }
      destinationDirectory = resolveInsideVault(libraryPath, parent.relativePath)
    }

    const source = resolveInsideVault(libraryPath, current.relativePath)
    const destination = await this.uniquePath(destinationDirectory, basename(source))
    const nextRoot = slash(relative(libraryPath, destination))
    const itemRecords = await this.readItemRecords(libraryPath)
    const affectedItems = itemRecords.filter((item) =>
      item.relativePath.startsWith(`${current.relativePath}/`)
    )
    const affectedCollections = collectionRecords.filter(
      (collection) =>
        collection.id === current.id ||
        collection.relativePath.startsWith(`${current.relativePath}/`)
    )

    await rename(source, destination)
    try {
      for (const item of affectedItems) {
        const relativePath = `${nextRoot}${item.relativePath.slice(current.relativePath.length)}`
        await this.writeItemRecord(libraryPath, {
          ...item,
          relativePath,
          metadata: { ...item.metadata, relativePath }
        })
      }
      for (const collection of affectedCollections) {
        const relativePath = `${nextRoot}${collection.relativePath.slice(current.relativePath.length)}`
        await this.writeCollectionRecord(libraryPath, {
          ...collection,
          name: basename(relativePath),
          relativePath,
          parentId: collection.id === current.id ? parentId : collection.parentId
        })
      }
    } catch (error) {
      if ((await this.pathExists(destination)) && !(await this.pathExists(source))) {
        await rename(destination, source)
      }
      await Promise.allSettled([
        ...affectedItems.map((item) => this.writeItemRecord(libraryPath, item)),
        ...affectedCollections.map((collection) =>
          this.writeCollectionRecord(libraryPath, collection)
        )
      ])
      throw error
    }
  }

  async assertCollectionRemovable(
    libraryPath: string,
    collectionId: string,
    retainedEntries: string[]
  ): Promise<void> {
    const current = (await this.readCollectionRecords(libraryPath)).find(
      (entry) => entry.id === collectionId
    )
    if (!current) throw new Error('This folder no longer exists.')
    const path = resolveInsideVault(libraryPath, current.relativePath)
    const retained = new Set(retainedEntries.map((entry) => entry.toLowerCase()))
    const remaining = (await readdir(path, { withFileTypes: true })).filter(
      (entry) => !retained.has(entry.name.toLowerCase())
    )
    if (remaining.some((entry) => entry.isDirectory())) {
      throw new Error('Move or remove its subfolders before deleting this folder.')
    }
    if (remaining.length > 0) {
      throw new Error(
        'This folder contains files Kuskus does not manage. Move them in Explorer, then try again.'
      )
    }
  }

  async deleteCollection(libraryPath: string, collectionId: string): Promise<void> {
    const current = (await this.readCollectionRecords(libraryPath)).find(
      (entry) => entry.id === collectionId
    )
    if (!current) return
    const path = resolveInsideVault(libraryPath, current.relativePath)
    if ((await readdir(path)).length > 0)
      throw new Error('Move or remove its subfolders before deleting this folder.')
    await rm(path, { recursive: true })
    await rm(this.collectionRecordPath(libraryPath, collectionId), { force: true })
  }

  private captureDraftDirectory(libraryPath: string): string {
    return kuskusPath(libraryPath, 'temp', NOTE_DRAFT_DIRECTORY)
  }

  private captureDraftFileDirectory(libraryPath: string): string {
    return kuskusPath(libraryPath, 'temp', FILE_DRAFT_DIRECTORY)
  }

  private captureQueueDirectory(libraryPath: string): string {
    return kuskusPath(libraryPath, 'temp', CAPTURE_QUEUE_DIRECTORY)
  }

  private captureSubmissionDirectory(libraryPath: string, submissionId: string): string {
    if (!ITEM_ID_PATTERN.test(submissionId)) throw new Error('The capture submission is invalid.')
    return join(this.captureQueueDirectory(libraryPath), submissionId)
  }

  async prepareCaptureSubmission(
    libraryPath: string,
    record: CaptureSubmissionRecord
  ): Promise<void> {
    const destination = this.captureSubmissionDirectory(libraryPath, record.id)
    try {
      const existing = await readJson<unknown>(join(destination, CAPTURE_SUBMISSION_MANIFEST))
      if (isCaptureSubmissionRecord(existing)) return
    } catch {
      // Continue with a clean prepared directory.
    }
    const preparing = join(this.captureQueueDirectory(libraryPath), `.${record.id}.preparing`)
    await rm(preparing, { recursive: true, force: true })
    await mkdir(preparing, { recursive: true })
    const noteDraft = this.captureDraftDirectory(libraryPath)
    const fileDraft = this.captureDraftFileDirectory(libraryPath)
    if (await this.pathExists(noteDraft)) {
      await cp(noteDraft, join(preparing, NOTE_DRAFT_DIRECTORY), { recursive: true })
    }
    if (await this.pathExists(fileDraft)) {
      await cp(fileDraft, join(preparing, FILE_DRAFT_DIRECTORY), { recursive: true })
    }
    await writeJsonAtomic(join(preparing, CAPTURE_SUBMISSION_MANIFEST), record)
    await mkdir(this.captureQueueDirectory(libraryPath), { recursive: true })
    await rename(preparing, destination)
  }

  async listCaptureSubmissions(libraryPath: string): Promise<CaptureSubmissionRecord[]> {
    let entries: string[]
    try {
      entries = await readdir(this.captureQueueDirectory(libraryPath))
    } catch {
      return []
    }
    const records: CaptureSubmissionRecord[] = []
    for (const entry of entries) {
      if (!ITEM_ID_PATTERN.test(entry)) continue
      try {
        const value = await readJson<unknown>(
          join(this.captureSubmissionDirectory(libraryPath, entry), CAPTURE_SUBMISSION_MANIFEST)
        )
        if (isCaptureSubmissionRecord(value)) records.push(normalizeCaptureSubmissionRecord(value))
      } catch {
        // Malformed recovery data stays on disk for manual inspection.
      }
    }
    return records
  }

  async readCaptureSubmission(
    libraryPath: string,
    submissionId: string
  ): Promise<CaptureSubmissionRecord> {
    const value = await readJson<unknown>(
      join(this.captureSubmissionDirectory(libraryPath, submissionId), CAPTURE_SUBMISSION_MANIFEST)
    )
    if (!isCaptureSubmissionRecord(value)) throw new Error('The capture submission is invalid.')
    return normalizeCaptureSubmissionRecord(value)
  }

  async writeCaptureSubmission(
    libraryPath: string,
    record: CaptureSubmissionRecord
  ): Promise<void> {
    await writeJsonAtomic(
      join(this.captureSubmissionDirectory(libraryPath, record.id), CAPTURE_SUBMISSION_MANIFEST),
      normalizeCaptureSubmissionRecord(record)
    )
  }

  async discardCaptureSubmission(libraryPath: string, submissionId: string): Promise<void> {
    await rm(this.captureSubmissionDirectory(libraryPath, submissionId), {
      recursive: true,
      force: true
    })
  }

  async restoreCaptureSubmissionDraft(libraryPath: string, submissionId: string): Promise<void> {
    const directory = this.captureSubmissionDirectory(libraryPath, submissionId)
    const noteDraft = join(directory, NOTE_DRAFT_DIRECTORY)
    const fileDraft = join(directory, FILE_DRAFT_DIRECTORY)
    if (
      (await this.pathExists(this.captureDraftDirectory(libraryPath))) ||
      (await this.pathExists(this.captureDraftFileDirectory(libraryPath)))
    ) {
      throw new Error('Save or discard the current staged draft first.')
    }
    if (await this.pathExists(noteDraft)) {
      await cp(noteDraft, this.captureDraftDirectory(libraryPath), { recursive: true })
    }
    if (await this.pathExists(fileDraft)) {
      await cp(fileDraft, this.captureDraftFileDirectory(libraryPath), { recursive: true })
    }
  }

  async readCaptureSubmissionAttachment(
    libraryPath: string,
    submissionId: string,
    attachmentId: string
  ): Promise<{ attachment: PersistedNoteAttachment; bytes: Buffer }> {
    const directory = join(
      this.captureSubmissionDirectory(libraryPath, submissionId),
      NOTE_DRAFT_DIRECTORY
    )
    const manifest = await readJson<unknown>(join(directory, NOTE_DRAFT_MANIFEST))
    const attachments = normalizeDraftManifestAttachments(manifest)
    const attachment = attachments.find((entry) => entry.id === attachmentId)
    if (!attachment) throw new Error('The submitted image no longer exists.')
    return { attachment, bytes: await readFile(join(directory, attachment.filename)) }
  }

  async readCaptureSubmissionFile(
    libraryPath: string,
    submissionId: string,
    fileId: string
  ): Promise<{ file: PersistedCaptureDraftFile; bytes: Buffer }> {
    const directory = join(
      this.captureSubmissionDirectory(libraryPath, submissionId),
      FILE_DRAFT_DIRECTORY
    )
    const value = await readJson<unknown>(join(directory, FILE_DRAFT_MANIFEST))
    if (!isPersistedCaptureDraftFile(value) || value.id !== fileId) {
      throw new Error('The submitted file no longer exists.')
    }
    return { file: value, bytes: await readFile(join(directory, value.filename)) }
  }

  async readCaptureDraftFile(libraryPath: string): Promise<PersistedCaptureDraftFile | null> {
    try {
      const value = await readJson<unknown>(
        join(this.captureDraftFileDirectory(libraryPath), FILE_DRAFT_MANIFEST)
      )
      return isPersistedCaptureDraftFile(value) ? value : null
    } catch {
      return null
    }
  }

  async stageCaptureDraftFile(
    libraryPath: string,
    file: PersistedCaptureDraftFile,
    bytes: Uint8Array
  ): Promise<void> {
    const directory = this.captureDraftFileDirectory(libraryPath)
    await rm(directory, { recursive: true, force: true })
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, file.filename), bytes)
    await writeJsonAtomic(join(directory, FILE_DRAFT_MANIFEST), file)
  }

  async readCaptureDraftFileBytes(
    libraryPath: string,
    fileId: string
  ): Promise<{ file: PersistedCaptureDraftFile; bytes: Buffer }> {
    const file = await this.readCaptureDraftFile(libraryPath)
    if (!file || file.id !== fileId) throw new Error('The staged file no longer exists.')
    return {
      file,
      bytes: await readFile(join(this.captureDraftFileDirectory(libraryPath), file.filename))
    }
  }

  async discardCaptureDraftFile(libraryPath: string): Promise<void> {
    await rm(this.captureDraftFileDirectory(libraryPath), { recursive: true, force: true })
  }

  async readCaptureDraftAttachments(libraryPath: string): Promise<PersistedNoteAttachment[]> {
    try {
      const value = await readJson<unknown>(
        join(this.captureDraftDirectory(libraryPath), NOTE_DRAFT_MANIFEST)
      )
      return normalizeDraftManifestAttachments(value)
    } catch {
      return []
    }
  }

  async stageCaptureDraftAttachment(
    libraryPath: string,
    attachment: PersistedNoteAttachment,
    bytes: Uint8Array
  ): Promise<void> {
    const directory = this.captureDraftDirectory(libraryPath)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, attachment.filename), bytes)
    const attachments = await this.readCaptureDraftAttachments(libraryPath)
    await writeJsonAtomic(join(directory, NOTE_DRAFT_MANIFEST), {
      schemaVersion: 2,
      attachments: [...attachments.filter((entry) => entry.id !== attachment.id), attachment]
    })
  }

  async renameCaptureDraftAttachment(
    libraryPath: string,
    attachmentId: string,
    filename: string
  ): Promise<PersistedNoteAttachment> {
    const directory = this.captureDraftDirectory(libraryPath)
    const attachments = await this.readCaptureDraftAttachments(libraryPath)
    const current = attachments.find((entry) => entry.id === attachmentId)
    if (!current) throw new Error('The staged image no longer exists.')
    if (attachments.some((entry) => entry.id !== attachmentId && entry.filename === filename)) {
      throw new Error('Another staged image already uses that name.')
    }
    if (current.filename === filename) return current
    const source = join(directory, current.filename)
    const destination = join(directory, filename)
    const renamed = {
      ...current,
      filename,
      relativePath: `./${encodeMarkdownImageTarget(filename)}`,
      sourceFilename: filename
    }
    await rename(source, destination)
    try {
      await writeJsonAtomic(join(directory, NOTE_DRAFT_MANIFEST), {
        schemaVersion: 2,
        attachments: attachments.map((entry) => (entry.id === attachmentId ? renamed : entry))
      })
      return renamed
    } catch (error) {
      await rename(destination, source)
      throw error
    }
  }

  async removeCaptureDraftAttachment(libraryPath: string, attachmentId: string): Promise<void> {
    const directory = this.captureDraftDirectory(libraryPath)
    const attachments = await this.readCaptureDraftAttachments(libraryPath)
    const removed = attachments.find((entry) => entry.id === attachmentId)
    if (removed) await rm(join(directory, removed.filename), { force: true })
    const remaining = attachments.filter((entry) => entry.id !== attachmentId)
    if (remaining.length === 0) return this.discardCaptureDraft(libraryPath)
    await writeJsonAtomic(join(directory, NOTE_DRAFT_MANIFEST), {
      schemaVersion: 2,
      attachments: remaining
    })
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
    if (!attachment) throw new Error('The staged image no longer exists.')
    return {
      attachment,
      bytes: await readFile(join(this.captureDraftDirectory(libraryPath), attachment.filename))
    }
  }

  async finalizeInboxItem(
    libraryPath: string,
    metadata: PersistedItem,
    files: Array<{ filename: string; data: string | Uint8Array }>,
    location: ActiveItemLocation = { type: 'inbox' }
  ): Promise<void> {
    await this.readPersistedLibrary(libraryPath)
    let filename: string
    let content: string | Uint8Array
    if (metadata.type === 'url') {
      filename = `${safeStem(metadata.title, metadata.domain)}${INTERNET_SHORTCUT_EXTENSION}`
      content = createInternetShortcut(metadata.sourceUrl)
    } else if (metadata.type === 'note') {
      filename = `${safeStem(metadata.title)}.md`
      const note = files.find((entry) => entry.filename.toLowerCase().endsWith('.md'))
      if (!note || typeof note.data !== 'string') throw new Error('The note content is missing.')
      content = note.data
    } else if (metadata.type === 'image') {
      const extension = `.${IMAGE_EXTENSIONS[metadata.mediaType]}`
      const original = metadata.sourceFilename
      filename =
        original && extname(original)
          ? safeStem(basename(original, extname(original))) + extension
          : `${safeStem(metadata.title, 'Pasted image')}${extension}`
      const image = files.find((entry) => !entry.filename.includes('/'))
      if (!image) throw new Error('The image content is missing.')
      content = image.data
    } else {
      throw new Error(
        'General files are indexed from the vault but are not captured through this operation.'
      )
    }
    const recoveryMarker = kuskusPath(libraryPath, 'temp', `${metadata.id}.capture-recovery.json`)
    let destination: string
    let recoveredAttachmentPaths: Array<{ id: string; relativePath: string }> = []
    try {
      const marker = await readJson<unknown>(recoveryMarker)
      const relativePath =
        marker && typeof marker === 'object'
          ? (marker as Record<string, unknown>).relativePath
          : null
      if (typeof relativePath !== 'string') throw new Error('Invalid capture recovery marker.')
      destination = resolveInsideVault(libraryPath, relativePath)
      const attachmentPaths = (marker as Record<string, unknown>).attachmentPaths
      if (Array.isArray(attachmentPaths)) {
        recoveredAttachmentPaths = attachmentPaths.flatMap((entry) => {
          if (!entry || typeof entry !== 'object') return []
          const candidate = entry as Record<string, unknown>
          return typeof candidate.id === 'string' && typeof candidate.relativePath === 'string'
            ? [{ id: candidate.id, relativePath: candidate.relativePath }]
            : []
        })
      }
    } catch {
      const directory = await this.destinationDirectory(libraryPath, location, metadata.id)
      await mkdir(directory, { recursive: true })
      destination = await this.uniquePath(directory, filename)
      if (metadata.type === 'note') {
        for (const attachment of metadata.attachments ?? []) {
          const placement = resolveAttachmentPlacement({
            libraryPath,
            notePath: destination,
            filename: attachment.filename
          })
          const attachmentPath = await this.uniquePath(placement.directory, attachment.filename)
          recoveredAttachmentPaths.push({
            id: attachment.id,
            relativePath: slash(relative(libraryPath, attachmentPath))
          })
        }
      }
      await writeJsonAtomic(recoveryMarker, {
        schemaVersion: 2,
        relativePath: slash(relative(libraryPath, destination)),
        attachmentPaths: recoveredAttachmentPaths
      })
    }
    if (
      metadata.type === 'note' &&
      (metadata.attachments ?? []).some(
        (attachment) => !recoveredAttachmentPaths.some((entry) => entry.id === attachment.id)
      )
    ) {
      recoveredAttachmentPaths = []
      for (const attachment of metadata.attachments ?? []) {
        const placement = resolveAttachmentPlacement({
          libraryPath,
          notePath: destination,
          filename: attachment.filename
        })
        const attachmentPath = await this.uniquePath(placement.directory, attachment.filename)
        recoveredAttachmentPaths.push({
          id: attachment.id,
          relativePath: slash(relative(libraryPath, attachmentPath))
        })
      }
      await writeJsonAtomic(recoveryMarker, {
        schemaVersion: 2,
        relativePath: slash(relative(libraryPath, destination)),
        attachmentPaths: recoveredAttachmentPaths
      })
    }
    const temporary = kuskusPath(libraryPath, 'temp', `${metadata.id}.capture`)
    const stagedContent = join(temporary, basename(destination))
    const destinationAlreadyFinalized = await this.pathExists(destination)
    if (!destinationAlreadyFinalized) {
      await mkdir(temporary, { recursive: true })
      await writeFile(stagedContent, content)
    }
    let attachments: PersistedNoteAttachment[] | undefined
    if (metadata.type === 'note' && metadata.attachments?.length) {
      attachments = []
      for (const attachment of metadata.attachments) {
        const file = files.find((entry) => basename(entry.filename) === attachment.filename)
        if (!file) throw new Error(`The attachment ${attachment.filename} is missing.`)
        const reserved = recoveredAttachmentPaths.find((entry) => entry.id === attachment.id)
        if (!reserved) throw new Error(`The attachment ${attachment.filename} has no destination.`)
        const attachmentPath = resolveInsideVault(libraryPath, reserved.relativePath)
        const relativePath = markdownPathForAttachment(destination, attachmentPath)
        attachments.push({ ...attachment, filename: basename(attachmentPath), relativePath })
        if (!(await this.pathExists(attachmentPath))) {
          const stagedAttachment = join(temporary, `${attachment.id}${extname(attachmentPath)}`)
          await writeFile(stagedAttachment, file.data)
          await rename(stagedAttachment, attachmentPath)
        }
        const bytes = Buffer.from(file.data)
        const detected = detectImage(bytes)
        if (!detected) throw new Error(`The attachment ${attachment.filename} is invalid.`)
        const imageMetadata = {
          ...createImageMetadata(
            attachment.id,
            attachment.sourceFilename ?? basename(attachmentPath),
            detected,
            metadata.createdAt
          ),
          relativePath: reserved.relativePath,
          referencedAttachment: true,
          attachmentOrigin: 'note-capture'
        } satisfies PersistedImageItem
        await this.writeItemRecord(libraryPath, {
          schemaVersion: 2,
          id: attachment.id,
          relativePath: reserved.relativePath,
          fingerprint: await this.fingerprint(attachmentPath),
          fileIdentity: await this.fileIdentity(attachmentPath),
          recovery: { lastSeenAt: new Date().toISOString(), missingSince: null },
          metadata: imageMetadata
        })
      }
      if (!destinationAlreadyFinalized) {
        let markdown = await readFile(stagedContent, 'utf8')
        const replacements = new Map<string, string>()
        for (let index = 0; index < metadata.attachments.length; index += 1) {
          for (const alias of stagedAttachmentAliases(metadata.attachments[index])) {
            replacements.set(alias, encodeMarkdownImageTarget(attachments[index].relativePath))
          }
        }
        markdown = rewriteMarkdownImageDestinations(
          markdown,
          (reference) => replacements.get(markdownImageTargetKey(reference.destination)) ?? null
        )
        await writeFile(stagedContent, markdown, 'utf8')
      }
    }
    if (!destinationAlreadyFinalized) await rename(stagedContent, destination)
    await rm(temporary, { recursive: true, force: true })
    const relativePath = slash(relative(libraryPath, destination))
    const nextMetadata = {
      ...metadata,
      schemaVersion: 2,
      title: titleFromPath(relativePath),
      contentFilename: metadata.type === 'url' ? null : basename(destination),
      relativePath,
      ...(metadata.type === 'note' && attachments ? { attachments } : {})
    } as PersistedItem
    await this.writeItemRecord(libraryPath, {
      schemaVersion: 2,
      id: metadata.id,
      relativePath,
      fingerprint: await this.fingerprint(destination),
      fileIdentity: await this.fileIdentity(destination),
      recovery: { lastSeenAt: new Date().toISOString(), missingSince: null },
      metadata: nextMetadata
    })
    await rm(recoveryMarker, { force: true })
  }

  async importVaultFile(
    libraryPath: string,
    input: {
      id: string
      filename: string
      mediaType: string
      bytes: Uint8Array
      timestamp: string
    },
    location: ActiveItemLocation = { type: 'inbox' }
  ): Promise<FileItemDto> {
    await this.readPersistedLibrary(libraryPath)
    const extension = extname(input.filename)
    const safeFilename = `${safeStem(basename(input.filename, extension), 'Imported file')}${extension}`
    const recoveryMarker = kuskusPath(libraryPath, 'temp', `${input.id}.file-import-recovery.json`)
    let destination: string
    try {
      const marker = await readJson<unknown>(recoveryMarker)
      const markedRelativePath =
        marker && typeof marker === 'object'
          ? (marker as Record<string, unknown>).relativePath
          : null
      if (typeof markedRelativePath !== 'string') {
        throw new Error('Invalid file recovery marker.')
      }
      destination = resolveInsideVault(libraryPath, markedRelativePath)
    } catch {
      const directory = await this.destinationDirectory(libraryPath, location, input.id)
      await mkdir(directory, { recursive: true })
      destination = await this.uniquePath(directory, safeFilename)
      await writeJsonAtomic(recoveryMarker, {
        schemaVersion: 1,
        relativePath: slash(relative(libraryPath, destination))
      })
    }
    const temporary = kuskusPath(libraryPath, 'temp', `${input.id}.file-import`)
    if (!(await this.pathExists(destination))) {
      await writeFile(temporary, input.bytes)
      await rename(temporary, destination)
    }
    const relativePath = slash(relative(libraryPath, destination))
    const metadata: PersistedFileItem = {
      schemaVersion: 2,
      id: input.id,
      type: 'file',
      title: titleFromPath(relativePath),
      createdAt: input.timestamp,
      updatedAt: input.timestamp,
      sourceUrl: null,
      sourceFilename: input.filename,
      contentFilename: basename(destination),
      mediaType: input.mediaType || mimeForExtension(extension),
      size: input.bytes.byteLength,
      note: '',
      originalCollectionId: null,
      relativePath,
      referencedAttachment: false
    }
    await this.writeItemRecord(libraryPath, {
      schemaVersion: 2,
      id: input.id,
      relativePath,
      fingerprint: await this.fingerprint(destination),
      fileIdentity: await this.fileIdentity(destination),
      recovery: { lastSeenAt: new Date().toISOString(), missingSince: null },
      metadata
    })
    await rm(recoveryMarker, { force: true })
    const saved = (await this.buildLibraryDto(libraryPath)).items.find(
      (candidate): candidate is FileItemDto =>
        candidate.id === metadata.id && candidate.type === 'file'
    )
    if (!saved) throw new Error('The imported file could not be reopened.')
    return saved
  }

  async resolveItem(libraryPath: string, itemId: string): Promise<ResolvedLibraryItem> {
    if (!ITEM_ID_PATTERN.test(itemId)) throw new Error('The item identifier is invalid.')
    await this.scanVault(libraryPath)
    const record = (await this.readItemRecords(libraryPath)).find((entry) => entry.id === itemId)
    if (!record) throw new Error('The saved item no longer exists.')
    const collections = await this.readCollectionRecords(libraryPath)
    const path = resolveInsideVault(libraryPath, record.relativePath)
    return {
      directory: dirname(path),
      path,
      relativePath: record.relativePath,
      location: this.locationForPath(record.relativePath, collections, record.metadata),
      metadata: { ...record.metadata, relativePath: record.relativePath }
    }
  }

  async readPersistedItem(libraryPath: string, itemId: string): Promise<PersistedItem> {
    return (await this.resolveItem(libraryPath, itemId)).metadata
  }

  async updateItem(libraryPath: string, item: PersistedItem): Promise<void> {
    const resolved = await this.resolveItem(libraryPath, item.id)
    let path = resolved.path
    if (item.title !== resolved.metadata.title && resolved.location.type !== 'trash') {
      const extension = extname(path) || (item.type === 'url' ? MARKDOWN_EXTENSION : '')
      const destination = await this.uniquePath(
        dirname(path),
        `${safeStem(item.title)}${extension}`
      )
      await rename(path, destination)
      if (resolved.metadata.type === 'note') {
        const oldAssets = join(dirname(path), `${basename(path, MARKDOWN_EXTENSION)}.assets`)
        const newAssets = join(
          dirname(destination),
          `${basename(destination, MARKDOWN_EXTENSION)}.assets`
        )
        const movedLegacyAssets =
          (await this.pathExists(oldAssets)) && !(await this.pathExists(newAssets))
        if (movedLegacyAssets) {
          await rename(oldAssets, newAssets)
        }
        const source = await readFile(destination, 'utf8')
        const replacements = new Map<string, string>()
        const availablePaths = (await this.readItemRecords(libraryPath)).flatMap((record) => [
          resolveInsideVault(libraryPath, record.relativePath),
          ...(record.metadata.trashedFromRelativePath
            ? [resolveInsideVault(libraryPath, record.metadata.trashedFromRelativePath)]
            : [])
        ])
        for (const reference of extractVaultReferenceTargets(source)) {
          const previousTarget = resolveVaultReferencePath(reference, path, libraryPath, [
            ...availablePaths,
            oldAssets
          ])
          const nextTarget =
            movedLegacyAssets && previousTarget.startsWith(`${oldAssets}${sep}`)
              ? join(newAssets, relative(oldAssets, previousTarget))
              : previousTarget
          replacements.set(previousTarget, nextTarget)
        }
        const rewritten = rewriteVaultReferences(
          source,
          path,
          destination,
          libraryPath,
          replacements
        )
        if (rewritten !== source) await writeFile(destination, rewritten, 'utf8')
      } else if (resolved.metadata.type === 'image' || resolved.metadata.type === 'file') {
        await this.rewriteInboundReferences(libraryPath, new Map([[path, destination]]))
      }
      path = destination
    }
    const relativePath = slash(relative(libraryPath, path))
    const existing = (await this.readItemRecords(libraryPath)).find((entry) => entry.id === item.id)
    await this.writeItemRecord(libraryPath, {
      schemaVersion: 2,
      id: item.id,
      relativePath,
      fingerprint: (await this.pathExists(path))
        ? await this.fingerprint(path)
        : (existing?.fingerprint ?? null),
      fileIdentity: (await this.pathExists(path))
        ? await this.fileIdentity(path)
        : (existing?.fileIdentity ?? null),
      recovery: { lastSeenAt: new Date().toISOString(), missingSince: null },
      metadata: {
        ...item,
        schemaVersion: 2,
        title: titleFromPath(relativePath),
        contentFilename: item.type === 'url' ? null : basename(path),
        relativePath
      } as PersistedItem
    })
  }

  async updateNote(
    libraryPath: string,
    metadata: PersistedNoteItem,
    markdown: string
  ): Promise<void> {
    const resolved = await this.resolveItem(libraryPath, metadata.id)
    if (resolved.metadata.type !== 'note') throw new Error('The saved item is not a note.')
    const temporary = kuskusPath(libraryPath, 'temp', `${metadata.id}.note-update`)
    await writeFile(temporary, markdown, 'utf8')
    const current = `${resolved.path}.${randomUUID()}.previous`
    await rename(resolved.path, current)
    try {
      await rename(temporary, resolved.path)
      await rm(current, { force: true })
    } catch (error) {
      if (await this.pathExists(current)) await rename(current, resolved.path)
      throw error
    }
    await this.updateItem(libraryPath, { ...metadata, relativePath: resolved.relativePath })
  }

  async readNoteAttachment(
    libraryPath: string,
    itemId: string,
    attachmentId: string
  ): Promise<{ attachment: PersistedNoteAttachment; bytes: Buffer }> {
    const item = await this.resolveItem(libraryPath, itemId)
    if (item.metadata.type !== 'note') throw new Error('The saved item is not a note.')
    const source = await readFile(item.path, 'utf8')
    const attachments = await this.noteAttachments(
      libraryPath,
      {
        schemaVersion: 2,
        id: itemId,
        relativePath: item.relativePath,
        fingerprint: null,
        metadata: item.metadata
      },
      source
    )
    const attachment = attachments.find((entry) => entry.id === attachmentId)
    if (!attachment) throw new Error('The note attachment no longer exists.')
    const path = resolve(dirname(item.path), attachment.relativePath)
    return { attachment, bytes: await readFile(path) }
  }

  async getItemContentPath(libraryPath: string, itemId: string): Promise<string> {
    const item = await this.resolveItem(libraryPath, itemId)
    if (item.metadata.type === 'url') return item.path
    return item.path
  }

  async getItemRevealPath(libraryPath: string, itemId: string): Promise<string> {
    const item = await this.resolveItem(libraryPath, itemId)
    return (await this.pathExists(item.path)) ? item.path : this.itemRecordPath(libraryPath, itemId)
  }

  async readItemContent(libraryPath: string, metadata: PersistedItem): Promise<Buffer> {
    const item = await this.resolveItem(libraryPath, metadata.id)
    return readFile(item.path)
  }

  private urlPreviewDirectory(libraryPath: string, itemId: string): string {
    return kuskusPath(libraryPath, URL_PREVIEW_DIRECTORY, itemId)
  }

  async readUrlPreviewCache(
    libraryPath: string,
    itemId: string,
    kind: UrlPreviewKind
  ): Promise<{ bytes: Buffer; mediaType: UrlPreviewMediaType } | null> {
    const directory = this.urlPreviewDirectory(libraryPath, itemId)
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
    await this.removeUrlPreviewCache(libraryPath, itemId, kind)
    const temporary = join(directory, `${kind}.${randomUUID()}.pending`)
    await writeFile(temporary, bytes)
    await rename(temporary, join(directory, `${kind}.${extension}`))
  }

  async removeUrlPreviewCache(
    libraryPath: string,
    itemId: string,
    kind?: UrlPreviewKind
  ): Promise<void> {
    const directory = this.urlPreviewDirectory(libraryPath, itemId)
    if (!kind) return rm(directory, { recursive: true, force: true })
    for (const extension of Object.keys(URL_PREVIEW_EXTENSIONS)) {
      await rm(join(directory, `${kind}.${extension}`), { force: true })
    }
  }

  async collectionExists(libraryPath: string, collectionId: string): Promise<boolean> {
    return (await this.readCollectionRecords(libraryPath)).some(
      (entry) => entry.id === collectionId
    )
  }

  private async destinationDirectory(
    libraryPath: string,
    location: ItemLocation,
    itemId: string
  ): Promise<string> {
    if (location.type === 'inbox') return libraryPath
    if (location.type === 'archive') return join(libraryPath, DEFAULT_ARCHIVE_DIRECTORY)
    if (location.type === 'trash') return kuskusPath(libraryPath, TRASH_DIRECTORY, itemId)
    const collection = (await this.readCollectionRecords(libraryPath)).find(
      (entry) => entry.id === location.collectionId
    )
    if (!collection) throw new Error('The destination folder no longer exists.')
    return resolveInsideVault(libraryPath, collection.relativePath)
  }

  async moveItems(libraryPath: string, requests: ItemMoveRequest[]): Promise<void> {
    if (requests.length === 0) return
    const transaction = kuskusPath(libraryPath, 'temp', `${randomUUID()}.item-move`)
    await mkdir(transaction, { recursive: true })
    const staged: Array<{
      request: ItemMoveRequest
      file: string
      assets: string | null
      original: string
      originalAssets: string | null
      destination: string | null
      destinationAssets: string | null
      referenceReplacements: Map<string, string> | null
      missingSource: boolean
    }> = []
    try {
      for (const request of requests) {
        const missingSource = !(await this.pathExists(request.item.path))
        if (missingSource && request.destination.type !== 'trash') {
          throw new Error(
            "The item's file is missing from the library, so it cannot be moved or archived. Move it to Trash to remove it."
          )
        }
        const stagedFile = join(
          transaction,
          `${request.item.metadata.id}${extname(request.item.path)}`
        )
        let stagedAssets: string | null = null
        let originalAssets: string | null = null
        if (!missingSource) {
          await rename(request.item.path, stagedFile)
          if (request.item.metadata.type === 'note') {
            originalAssets = join(
              dirname(request.item.path),
              `${basename(request.item.path, MARKDOWN_EXTENSION)}.assets`
            )
            if (await this.pathExists(originalAssets)) {
              stagedAssets = join(transaction, `${request.item.metadata.id}.assets`)
              await rename(originalAssets, stagedAssets)
            }
          }
        }
        staged.push({
          request,
          file: stagedFile,
          assets: stagedAssets,
          original: request.item.path,
          originalAssets,
          destination: null,
          destinationAssets: null,
          referenceReplacements: null,
          missingSource
        })
      }
      for (const entry of staged) {
        const directory = await this.destinationDirectory(
          libraryPath,
          entry.request.destination,
          entry.request.item.metadata.id
        )
        await mkdir(directory, { recursive: true })
        const destination = await this.uniquePath(directory, basename(entry.original))
        if (!entry.missingSource) await rename(entry.file, destination)
        entry.destination = destination
        let legacyAssetDestination: string | null = null
        if (entry.assets) {
          const assetDestination = join(
            directory,
            `${basename(destination, MARKDOWN_EXTENSION)}.assets`
          )
          await rename(entry.assets, assetDestination)
          legacyAssetDestination = assetDestination
          entry.destinationAssets = assetDestination
        }
        let nextRequestMetadata = entry.request.metadata
        if (!entry.missingSource && entry.request.item.metadata.type === 'note') {
          const source = await readFile(destination, 'utf8')
          const replacements = new Map<string, string>()
          const availablePaths = (await this.readItemRecords(libraryPath)).flatMap((record) => [
            resolveInsideVault(libraryPath, record.relativePath),
            ...(record.metadata.trashedFromRelativePath
              ? [resolveInsideVault(libraryPath, record.metadata.trashedFromRelativePath)]
              : [])
          ])
          for (const reference of extractVaultReferenceTargets(source)) {
            const previousTarget = resolveVaultReferencePath(
              reference,
              entry.original,
              libraryPath,
              [...availablePaths, entry.originalAssets ?? entry.original]
            )
            const nextTarget =
              entry.originalAssets &&
              legacyAssetDestination &&
              previousTarget.startsWith(`${entry.originalAssets}${sep}`)
                ? join(legacyAssetDestination, relative(entry.originalAssets, previousTarget))
                : previousTarget
            replacements.set(previousTarget, nextTarget)
          }
          entry.referenceReplacements = replacements
          const rewritten = rewriteVaultReferences(
            source,
            entry.original,
            destination,
            libraryPath,
            replacements
          )
          if (rewritten !== source) await writeFile(destination, rewritten, 'utf8')
          if (nextRequestMetadata.type === 'note' && nextRequestMetadata.attachments) {
            nextRequestMetadata = {
              ...nextRequestMetadata,
              attachments: nextRequestMetadata.attachments.map((attachment) => {
                const previousTarget = resolve(dirname(entry.original), attachment.relativePath)
                const nextTarget = replacements.get(previousTarget) ?? previousTarget
                return {
                  ...attachment,
                  relativePath: markdownPathForAttachment(destination, nextTarget)
                }
              })
            }
          }
        } else if (
          !entry.missingSource &&
          entry.request.destination.type !== 'trash' &&
          (entry.request.item.metadata.type === 'image' ||
            entry.request.item.metadata.type === 'file')
        ) {
          const previousPath = entry.request.item.metadata.trashedFromRelativePath
            ? resolveInsideVault(libraryPath, entry.request.item.metadata.trashedFromRelativePath)
            : entry.original
          entry.referenceReplacements = new Map([[previousPath, destination]])
          await this.rewriteInboundReferences(libraryPath, entry.referenceReplacements)
        }
        const relativePath = slash(relative(libraryPath, destination))
        const record = (await this.readItemRecords(libraryPath)).find(
          (item) => item.id === entry.request.item.metadata.id
        )
        await this.writeItemRecord(libraryPath, {
          schemaVersion: 2,
          id: entry.request.item.metadata.id,
          relativePath,
          fingerprint: record?.fingerprint ?? null,
          ...(entry.missingSource && record?.recovery ? { recovery: record.recovery } : {}),
          metadata: {
            ...nextRequestMetadata,
            schemaVersion: 2,
            relativePath,
            contentFilename: nextRequestMetadata.type === 'url' ? null : basename(destination)
          } as PersistedItem
        })
      }
      await rm(transaction, { recursive: true, force: true })
    } catch (error) {
      for (const entry of staged.reverse()) {
        try {
          if (entry.destination && (await this.pathExists(entry.destination))) {
            if (entry.referenceReplacements) {
              const reversed = new Map(
                [...entry.referenceReplacements].map(([from, to]) => [to, from])
              )
              if (entry.request.item.metadata.type === 'note') {
                const source = await readFile(entry.destination, 'utf8')
                const restored = rewriteVaultReferences(
                  source,
                  entry.destination,
                  entry.original,
                  libraryPath,
                  reversed
                )
                if (restored !== source) await writeFile(entry.destination, restored, 'utf8')
              } else if (entry.request.destination.type !== 'trash') {
                await this.rewriteInboundReferences(libraryPath, reversed)
              }
            }
            await rename(entry.destination, entry.original)
          } else if (await this.pathExists(entry.file)) {
            await rename(entry.file, entry.original)
          }
          if (
            entry.destinationAssets &&
            entry.originalAssets &&
            (await this.pathExists(entry.destinationAssets))
          ) {
            await rename(entry.destinationAssets, entry.originalAssets)
          } else if (
            entry.assets &&
            entry.originalAssets &&
            (await this.pathExists(entry.assets))
          ) {
            await rename(entry.assets, entry.originalAssets)
          }
          const relativePath = slash(relative(libraryPath, entry.original))
          await this.writeItemRecord(libraryPath, {
            schemaVersion: 2,
            id: entry.request.item.metadata.id,
            relativePath,
            fingerprint: await this.fingerprint(entry.original),
            fileIdentity: await this.fileIdentity(entry.original),
            recovery: { lastSeenAt: new Date().toISOString(), missingSince: null },
            metadata: {
              ...entry.request.item.metadata,
              relativePath,
              contentFilename:
                entry.request.item.metadata.type === 'url' ? null : basename(entry.original)
            } as PersistedItem
          })
        } catch {
          // Preserve the original failure; startup scanning can reconcile any remaining paths.
        }
      }
      throw error
    }
  }

  async permanentlyDeleteItems(libraryPath: string, itemIds: string[]): Promise<void> {
    for (const itemId of itemIds) {
      const item = await this.resolveItem(libraryPath, itemId)
      if (item.location.type !== 'trash')
        throw new Error('Only items in Trash can be deleted forever.')
      const trashRoot = kuskusPath(libraryPath, TRASH_DIRECTORY, itemId)
      await rm(trashRoot, { recursive: true, force: true })
      await rm(this.itemRecordPath(libraryPath, itemId), { force: true })
    }
  }

  async inspectItemDeletion(
    libraryPath: string,
    itemIds: string[],
    mode: 'trash' | 'permanent'
  ): Promise<ItemDeletionInspectionDto> {
    const library = await this.buildLibraryDto(libraryPath)
    const selected = new Set(itemIds)
    const selectedItems = library.items.filter((item) => selected.has(item.id))
    const notes = library.items.filter((item) => item.type === 'note')
    const references = new Map<string, Array<{ id: string; title: string }>>()
    for (const note of notes) {
      for (const attachment of note.attachments) {
        const entries = references.get(attachment.id) ?? []
        if (!entries.some((entry) => entry.id === note.id))
          entries.push({ id: note.id, title: note.title })
        references.set(attachment.id, entries)
      }
    }
    const referencedItems = selectedItems.flatMap((item) => {
      if (item.type !== 'image' && item.type !== 'file') return []
      const noteReferences = references.get(item.id) ?? []
      return noteReferences.length > 0
        ? [
            {
              itemId: item.id,
              title: item.title,
              noteTitles: noteReferences.slice(0, 5).map((entry) => entry.title),
              referenceCount: noteReferences.length
            }
          ]
        : []
    })
    const cleanupIds = new Set<string>()
    if (mode === 'permanent') {
      for (const note of selectedItems) {
        if (note.type !== 'note') continue
        for (const attachment of note.attachments) {
          const remaining = (references.get(attachment.id) ?? []).some(
            (entry) => !selected.has(entry.id)
          )
          if (!remaining) cleanupIds.add(attachment.id)
        }
      }
    }
    const cleanupCandidates = library.items.flatMap((item) =>
      cleanupIds.has(item.id) && item.type === 'image' && item.location.type !== 'trash'
        ? [{ itemId: item.id, title: item.title }]
        : []
    )
    const revisionPayload = JSON.stringify({
      mode,
      selected: [...selected].sort(),
      referencedItems,
      cleanupCandidates,
      notes: notes
        .map((note) => ({ id: note.id, updatedAt: note.updatedAt }))
        .sort((a, b) => a.id.localeCompare(b.id))
    })
    return {
      revision: createHash('sha256').update(revisionPayload).digest('hex'),
      referencedItems,
      cleanupCandidates
    }
  }
}
