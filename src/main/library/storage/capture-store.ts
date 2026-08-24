import { access, cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  encodeMarkdownImageTarget,
  markdownImageTargetKey
} from '../../../shared/markdown-image-references'
import {
  isCaptureSubmissionRecord,
  normalizeCaptureSubmissionRecord,
  type CaptureSubmissionRecord
} from '../../capture/capture-submission-record'
import {
  FILE_DRAFT_DIRECTORY,
  FILE_DRAFT_MANIFEST,
  ITEM_ID_PATTERN,
  NOTE_DRAFT_DIRECTORY,
  NOTE_DRAFT_MANIFEST
} from '../constants'
import { isPersistedNoteAttachment, type PersistedNoteAttachment } from '../schemas'
import { readJson, writeJsonAtomic } from './json-file'
import { kuskusPath } from './vault-paths'

const CAPTURE_QUEUE_DIRECTORY = 'capture-queue'
const CAPTURE_SUBMISSION_MANIFEST = 'submission.json'

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

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function captureDraftDirectory(libraryPath: string): string {
  return kuskusPath(libraryPath, 'temp', NOTE_DRAFT_DIRECTORY)
}

function captureDraftFileDirectory(libraryPath: string): string {
  return kuskusPath(libraryPath, 'temp', FILE_DRAFT_DIRECTORY)
}

function captureQueueDirectory(libraryPath: string): string {
  return kuskusPath(libraryPath, 'temp', CAPTURE_QUEUE_DIRECTORY)
}

function captureSubmissionDirectory(libraryPath: string, submissionId: string): string {
  if (!ITEM_ID_PATTERN.test(submissionId)) throw new Error('The capture submission is invalid.')
  return join(captureQueueDirectory(libraryPath), submissionId)
}

export async function prepareCaptureSubmission(
  libraryPath: string,
  record: CaptureSubmissionRecord
): Promise<void> {
  const destination = captureSubmissionDirectory(libraryPath, record.id)
  try {
    const existing = await readJson<unknown>(join(destination, CAPTURE_SUBMISSION_MANIFEST))
    if (isCaptureSubmissionRecord(existing)) return
  } catch {
    // Continue with a clean prepared directory.
  }
  const preparing = join(captureQueueDirectory(libraryPath), `.${record.id}.preparing`)
  await rm(preparing, { recursive: true, force: true })
  await mkdir(preparing, { recursive: true })
  const noteDraft = captureDraftDirectory(libraryPath)
  const fileDraft = captureDraftFileDirectory(libraryPath)
  if (await pathExists(noteDraft)) {
    await cp(noteDraft, join(preparing, NOTE_DRAFT_DIRECTORY), { recursive: true })
  }
  if (await pathExists(fileDraft)) {
    await cp(fileDraft, join(preparing, FILE_DRAFT_DIRECTORY), { recursive: true })
  }
  await writeJsonAtomic(join(preparing, CAPTURE_SUBMISSION_MANIFEST), record)
  await mkdir(captureQueueDirectory(libraryPath), { recursive: true })
  await rename(preparing, destination)
}

export async function listCaptureSubmissions(
  libraryPath: string
): Promise<CaptureSubmissionRecord[]> {
  let entries: string[]
  try {
    entries = await readdir(captureQueueDirectory(libraryPath))
  } catch {
    return []
  }
  return (
    await mapWithConcurrency(entries, 32, async (entry) => {
      if (!ITEM_ID_PATTERN.test(entry)) return null
      try {
        const value = await readJson<unknown>(
          join(captureSubmissionDirectory(libraryPath, entry), CAPTURE_SUBMISSION_MANIFEST)
        )
        return isCaptureSubmissionRecord(value) ? normalizeCaptureSubmissionRecord(value) : null
      } catch {
        // Malformed recovery data stays on disk for manual inspection.
        return null
      }
    })
  ).filter((record): record is CaptureSubmissionRecord => record !== null)
}

export async function readCaptureSubmission(
  libraryPath: string,
  submissionId: string
): Promise<CaptureSubmissionRecord> {
  const value = await readJson<unknown>(
    join(captureSubmissionDirectory(libraryPath, submissionId), CAPTURE_SUBMISSION_MANIFEST)
  )
  if (!isCaptureSubmissionRecord(value)) throw new Error('The capture submission is invalid.')
  return normalizeCaptureSubmissionRecord(value)
}

export async function writeCaptureSubmission(
  libraryPath: string,
  record: CaptureSubmissionRecord
): Promise<void> {
  await writeJsonAtomic(
    join(captureSubmissionDirectory(libraryPath, record.id), CAPTURE_SUBMISSION_MANIFEST),
    normalizeCaptureSubmissionRecord(record)
  )
}

export async function discardCaptureSubmission(
  libraryPath: string,
  submissionId: string
): Promise<void> {
  await rm(captureSubmissionDirectory(libraryPath, submissionId), {
    recursive: true,
    force: true
  })
}

export async function restoreCaptureSubmissionDraft(
  libraryPath: string,
  submissionId: string
): Promise<void> {
  const directory = captureSubmissionDirectory(libraryPath, submissionId)
  const noteDraft = join(directory, NOTE_DRAFT_DIRECTORY)
  const fileDraft = join(directory, FILE_DRAFT_DIRECTORY)
  if (
    (await pathExists(captureDraftDirectory(libraryPath))) ||
    (await pathExists(captureDraftFileDirectory(libraryPath)))
  ) {
    throw new Error('Save or discard the current staged draft first.')
  }
  if (await pathExists(noteDraft)) {
    await cp(noteDraft, captureDraftDirectory(libraryPath), { recursive: true })
  }
  if (await pathExists(fileDraft)) {
    await cp(fileDraft, captureDraftFileDirectory(libraryPath), { recursive: true })
  }
}

export async function readCaptureSubmissionAttachment(
  libraryPath: string,
  submissionId: string,
  attachmentId: string
): Promise<{ attachment: PersistedNoteAttachment; bytes: Buffer }> {
  const directory = join(
    captureSubmissionDirectory(libraryPath, submissionId),
    NOTE_DRAFT_DIRECTORY
  )
  const manifest = await readJson<unknown>(join(directory, NOTE_DRAFT_MANIFEST))
  const attachments = normalizeDraftManifestAttachments(manifest)
  const attachment = attachments.find((entry) => entry.id === attachmentId)
  if (!attachment) throw new Error('The submitted image no longer exists.')
  return { attachment, bytes: await readFile(join(directory, attachment.filename)) }
}

export async function readCaptureSubmissionFile(
  libraryPath: string,
  submissionId: string,
  fileId: string
): Promise<{ file: PersistedCaptureDraftFile; bytes: Buffer }> {
  const directory = join(
    captureSubmissionDirectory(libraryPath, submissionId),
    FILE_DRAFT_DIRECTORY
  )
  const value = await readJson<unknown>(join(directory, FILE_DRAFT_MANIFEST))
  if (!isPersistedCaptureDraftFile(value) || value.id !== fileId) {
    throw new Error('The submitted file no longer exists.')
  }
  return { file: value, bytes: await readFile(join(directory, value.filename)) }
}

export async function readCaptureDraftFile(
  libraryPath: string
): Promise<PersistedCaptureDraftFile | null> {
  try {
    const value = await readJson<unknown>(
      join(captureDraftFileDirectory(libraryPath), FILE_DRAFT_MANIFEST)
    )
    return isPersistedCaptureDraftFile(value) ? value : null
  } catch {
    return null
  }
}

export async function stageCaptureDraftFile(
  libraryPath: string,
  file: PersistedCaptureDraftFile,
  bytes: Uint8Array
): Promise<void> {
  const directory = captureDraftFileDirectory(libraryPath)
  await rm(directory, { recursive: true, force: true })
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, file.filename), bytes)
  await writeJsonAtomic(join(directory, FILE_DRAFT_MANIFEST), file)
}

export async function readCaptureDraftFileBytes(
  libraryPath: string,
  fileId: string
): Promise<{ file: PersistedCaptureDraftFile; bytes: Buffer }> {
  const file = await readCaptureDraftFile(libraryPath)
  if (!file || file.id !== fileId) throw new Error('The staged file no longer exists.')
  return {
    file,
    bytes: await readFile(join(captureDraftFileDirectory(libraryPath), file.filename))
  }
}

export async function discardCaptureDraftFile(libraryPath: string): Promise<void> {
  await rm(captureDraftFileDirectory(libraryPath), { recursive: true, force: true })
}

export async function readCaptureDraftAttachments(
  libraryPath: string
): Promise<PersistedNoteAttachment[]> {
  try {
    const value = await readJson<unknown>(
      join(captureDraftDirectory(libraryPath), NOTE_DRAFT_MANIFEST)
    )
    return normalizeDraftManifestAttachments(value)
  } catch {
    return []
  }
}

export async function stageCaptureDraftAttachment(
  libraryPath: string,
  attachment: PersistedNoteAttachment,
  bytes: Uint8Array
): Promise<void> {
  const directory = captureDraftDirectory(libraryPath)
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, attachment.filename), bytes)
  const attachments = await readCaptureDraftAttachments(libraryPath)
  await writeJsonAtomic(join(directory, NOTE_DRAFT_MANIFEST), {
    schemaVersion: 2,
    attachments: [...attachments.filter((entry) => entry.id !== attachment.id), attachment]
  })
}

export async function renameCaptureDraftAttachment(
  libraryPath: string,
  attachmentId: string,
  filename: string
): Promise<PersistedNoteAttachment> {
  const directory = captureDraftDirectory(libraryPath)
  const attachments = await readCaptureDraftAttachments(libraryPath)
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

export async function removeCaptureDraftAttachment(
  libraryPath: string,
  attachmentId: string
): Promise<void> {
  const directory = captureDraftDirectory(libraryPath)
  const attachments = await readCaptureDraftAttachments(libraryPath)
  const removed = attachments.find((entry) => entry.id === attachmentId)
  if (removed) await rm(join(directory, removed.filename), { force: true })
  const remaining = attachments.filter((entry) => entry.id !== attachmentId)
  if (remaining.length === 0) return discardCaptureDraft(libraryPath)
  await writeJsonAtomic(join(directory, NOTE_DRAFT_MANIFEST), {
    schemaVersion: 2,
    attachments: remaining
  })
}

export async function discardCaptureDraft(libraryPath: string): Promise<void> {
  await rm(captureDraftDirectory(libraryPath), { recursive: true, force: true })
}

export async function readCaptureDraftAttachment(
  libraryPath: string,
  attachmentId: string
): Promise<{ attachment: PersistedNoteAttachment; bytes: Buffer }> {
  const attachment = (await readCaptureDraftAttachments(libraryPath)).find(
    (entry) => entry.id === attachmentId
  )
  if (!attachment) throw new Error('The staged image no longer exists.')
  return {
    attachment,
    bytes: await readFile(join(captureDraftDirectory(libraryPath), attachment.filename))
  }
}
