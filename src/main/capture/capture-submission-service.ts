import { randomUUID } from 'node:crypto'

import type {
  CaptureQueueDto,
  CaptureSessionDto,
  CaptureSubmissionReceiptDto,
  CaptureSurface,
  SubmitCaptureInput
} from '../../shared/capture-contract'
import type { LibraryItemDto } from '../../shared/library-contract'
import type { LibraryService } from '../library/library-service'
import type { CaptureSubmissionRecord } from './capture-submission-record'
import { CaptureSessionService, StaleCaptureSessionError } from './capture-session-service'

type QueueListener = (queue: CaptureQueueDto) => void
type SessionListener = (session: CaptureSessionDto) => void

export class CaptureSubmissionService {
  private running = false
  private readonly completed = new Map<string, LibraryItemDto>()
  private readonly waiters = new Map<
    string,
    Array<{ resolve: (item: LibraryItemDto) => void; reject: (error: Error) => void }>
  >()

  constructor(
    private readonly sessions: CaptureSessionService,
    private readonly libraryService: LibraryService,
    private readonly onQueueChanged: QueueListener,
    private readonly onSessionChanged: SessionListener
  ) {}

  async initialize(): Promise<void> {
    if (!this.libraryService.isReadyForCapture()) return
    const records = await this.libraryService.listCaptureSubmissions()
    await Promise.all(
      records.map(async (record) => {
        if (record.status === 'processing') {
          await this.libraryService.updateCaptureSubmission({
            ...record,
            status: 'accepted',
            error: null
          })
        } else if (record.status === 'prepared') {
          const receipt = this.sessions.submissionForRevision(
            record.libraryId,
            record.sourceRevision
          )
          if (receipt === record.id) {
            await this.libraryService.discardActiveCaptureDraft().catch(() => undefined)
            await this.libraryService.updateCaptureSubmission({
              ...record,
              status: 'accepted'
            })
          } else {
            // The prepared payload was copied, not moved. Without a persisted session receipt the
            // original draft remains authoritative and the unaccepted copy must not become a duplicate.
            await this.libraryService.discardCaptureSubmission(record.id)
          }
        }
      })
    )
    await this.broadcastQueue()
    this.scheduleDrain()
  }

  async submit(
    input: SubmitCaptureInput,
    surface: CaptureSurface
  ): Promise<CaptureSubmissionReceiptDto> {
    const normalizedInput: SubmitCaptureInput = {
      ...input,
      destination: input.destination ?? { type: 'inbox' }
    }
    const existingId = this.sessions.submissionForRevision(input.libraryId, input.expectedRevision)
    if (existingId) {
      const existing = (await this.libraryService.listCaptureSubmissions()).find(
        (record) => record.id === existingId
      )
      return {
        id: existingId,
        libraryId: input.libraryId,
        kind: existing?.kind ?? input.kind,
        submittedAt: existing?.submittedAt ?? new Date().toISOString()
      }
    }

    const session = this.sessions.get(input.libraryId)
    if (session.owner !== surface) throw new Error('This capture surface is no longer active.')
    if (session.revision !== input.expectedRevision) throw new StaleCaptureSessionError()
    this.validateInput(normalizedInput)

    const record: CaptureSubmissionRecord = {
      schemaVersion: 2,
      id: randomUUID(),
      libraryId: input.libraryId,
      kind: input.kind,
      markdown: input.kind === 'url' ? session.markdown.trim() : session.markdown,
      attachmentIds: input.attachmentIds,
      fileId: input.fileId,
      destination: normalizedInput.destination,
      submittedAt: new Date().toISOString(),
      sourceRevision: input.expectedRevision,
      status: 'prepared',
      attempts: 0,
      error: null
    }
    await this.libraryService.prepareCaptureSubmission(record)
    const nextSession = await this.sessions.resetAfterSubmission(
      input.libraryId,
      input.expectedRevision,
      record.id
    )
    await this.libraryService.discardActiveCaptureDraft().catch(() => undefined)
    await this.libraryService.updateCaptureSubmission({ ...record, status: 'accepted' })
    this.onSessionChanged(nextSession)
    await this.broadcastQueue()
    this.scheduleDrain()
    return this.toReceipt(record)
  }

  async waitForSubmission(id: string): Promise<LibraryItemDto> {
    const completed = this.completed.get(id)
    if (completed) return completed
    const record = (await this.libraryService.listCaptureSubmissions()).find(
      (candidate) => candidate.id === id
    )
    if (!record) throw new Error('The capture submission is no longer available.')
    if (record.status === 'failed')
      throw new Error(record.error ?? 'The capture could not be saved.')
    return new Promise<LibraryItemDto>((resolve, reject) => {
      const current = this.waiters.get(id) ?? []
      current.push({ resolve, reject })
      this.waiters.set(id, current)
    })
  }

  async getQueue(libraryId: string): Promise<CaptureQueueDto> {
    const context = await this.libraryService.getCaptureContext()
    if (context.libraryId !== libraryId) throw new Error('The capture library is no longer active.')
    return this.queueSnapshot()
  }

  async retry(id: string): Promise<CaptureQueueDto> {
    const record = await this.requireSubmission(id)
    if (record.status !== 'failed') throw new Error('Only failed captures can be retried.')
    await this.libraryService.updateCaptureSubmission({
      ...record,
      status: 'accepted',
      attempts: record.attempts + 1,
      error: null
    })
    await this.broadcastQueue()
    this.scheduleDrain()
    return this.queueSnapshot()
  }

  async restore(id: string, surface: CaptureSurface): Promise<CaptureSessionDto> {
    const record = await this.requireSubmission(id)
    if (record.status !== 'failed') throw new Error('Only failed captures can be restored.')
    await this.libraryService.restoreCaptureSubmissionDraft(id)
    const session = await this.sessions.restore(record.libraryId, record.markdown, surface)
    await this.libraryService.discardCaptureSubmission(id)
    this.onSessionChanged(session)
    await this.broadcastQueue()
    return session
  }

  async discard(id: string): Promise<CaptureQueueDto> {
    const record = await this.requireSubmission(id)
    if (record.status !== 'failed') throw new Error('Only failed captures can be discarded.')
    await this.libraryService.discardCaptureSubmission(id)
    await this.broadcastQueue()
    return this.queueSnapshot()
  }

  private validateInput(input: SubmitCaptureInput): void {
    if (
      !Array.isArray(input.attachmentIds) ||
      input.attachmentIds.some((id) => typeof id !== 'string') ||
      (input.fileId !== null && typeof input.fileId !== 'string')
    ) {
      throw new Error('The capture submission is invalid.')
    }
    if (
      !input.destination ||
      (input.destination.type !== 'inbox' &&
        (input.destination.type !== 'collection' ||
          typeof input.destination.collectionId !== 'string'))
    ) {
      throw new Error('The capture destination is invalid.')
    }
    if (input.kind === 'file' && !input.fileId) {
      throw new Error('The capture file is missing.')
    }
    if (input.kind === 'image' && input.attachmentIds.length !== 1) {
      throw new Error('The capture image is missing.')
    }
    if ((input.kind === 'url' || input.kind === 'file') && input.attachmentIds.length > 0) {
      throw new Error('The capture submission contains unexpected attachments.')
    }
  }

  private scheduleDrain(): void {
    if (this.running) return
    this.running = true
    void this.drain().finally(async () => {
      this.running = false
      const records = await this.libraryService.listCaptureSubmissions().catch(() => [])
      if (records.some((record) => record.status === 'accepted')) this.scheduleDrain()
    })
  }

  private async drain(): Promise<void> {
    while (true) {
      const records = await this.libraryService.listCaptureSubmissions()
      const record = records
        .filter((candidate) => candidate.status === 'accepted')
        .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt))[0]
      if (!record) return
      const processing = { ...record, status: 'processing' as const }
      await this.libraryService.updateCaptureSubmission(processing)
      await this.broadcastQueue()
      try {
        const item = await this.libraryService.commitCaptureSubmission(processing)
        this.completed.set(record.id, item)
        if (this.completed.size > 100) {
          const oldest = this.completed.keys().next().value
          if (oldest) this.completed.delete(oldest)
        }
        for (const waiter of this.waiters.get(record.id) ?? []) waiter.resolve(item)
        this.waiters.delete(record.id)
        await this.libraryService.discardCaptureSubmission(record.id)
        if (item.type === 'url') {
          void this.libraryService.enrichUrl(item.id).catch(() => undefined)
        }
      } catch (caught) {
        const error = caught instanceof Error ? caught.message : 'The capture could not be saved.'
        await this.libraryService.updateCaptureSubmission({
          ...processing,
          status: 'failed',
          error
        })
        for (const waiter of this.waiters.get(record.id) ?? []) waiter.reject(new Error(error))
        this.waiters.delete(record.id)
      }
      await this.broadcastQueue()
    }
  }

  private async requireSubmission(id: string): Promise<CaptureSubmissionRecord> {
    const record = (await this.libraryService.listCaptureSubmissions()).find(
      (candidate) => candidate.id === id
    )
    if (!record) throw new Error('The capture submission no longer exists.')
    return record
  }

  private async queueSnapshot(): Promise<CaptureQueueDto> {
    const records = await this.libraryService.listCaptureSubmissions()
    return {
      pendingCount: records.filter(
        (record) => record.status === 'accepted' || record.status === 'processing'
      ).length,
      failures: records
        .filter((record) => record.status === 'failed')
        .map((record) => ({
          ...this.toReceipt(record),
          status: 'failed' as const,
          error: record.error ?? 'The capture could not be saved.',
          preview: this.preview(record)
        }))
    }
  }

  private async broadcastQueue(): Promise<void> {
    this.onQueueChanged(await this.queueSnapshot())
  }

  private toReceipt(record: CaptureSubmissionRecord): CaptureSubmissionReceiptDto {
    return {
      id: record.id,
      libraryId: record.libraryId,
      kind: record.kind,
      submittedAt: record.submittedAt
    }
  }

  private preview(record: CaptureSubmissionRecord): string {
    if (record.kind === 'file') return 'Submitted file'
    if (record.kind === 'image' && !record.markdown.trim()) return 'Submitted image'
    const compact = record.markdown.trim().replace(/\s+/g, ' ')
    return compact.slice(0, 160) || `Submitted ${record.kind}`
  }
}
