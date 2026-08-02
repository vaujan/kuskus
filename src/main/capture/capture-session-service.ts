import { readJson, writeJsonAtomic } from '../library/storage/json-file'
import type { CaptureSessionDto, CaptureSurface } from '../../shared/capture-contract'

const MAXIMUM_CAPTURE_MARKDOWN_LENGTH = 2_000_000

interface PersistedCaptureSession {
  revision: number
  assetsRevision: number
  markdown: string
  lastSubmission?: {
    sourceRevision: number
    id: string
  }
}

interface PersistedCaptureSessions {
  schemaVersion: 1
  sessions: Record<string, PersistedCaptureSession>
}

function isPersistedSession(value: unknown): value is PersistedCaptureSession {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    Number.isSafeInteger(candidate.revision) &&
    (candidate.revision as number) >= 0 &&
    (candidate.assetsRevision === undefined || Number.isSafeInteger(candidate.assetsRevision)) &&
    typeof candidate.markdown === 'string' &&
    candidate.markdown.length <= MAXIMUM_CAPTURE_MARKDOWN_LENGTH &&
    (candidate.lastSubmission === undefined ||
      (!!candidate.lastSubmission &&
        typeof candidate.lastSubmission === 'object' &&
        Number.isSafeInteger(
          (candidate.lastSubmission as Record<string, unknown>).sourceRevision
        ) &&
        typeof (candidate.lastSubmission as Record<string, unknown>).id === 'string'))
  )
}

export class StaleCaptureSessionError extends Error {
  constructor() {
    super('The capture draft changed in another window. Retrying with the latest version.')
  }
}

export class CaptureSessionService {
  private readonly sessions = new Map<string, PersistedCaptureSession>()
  private readonly owners = new Map<string, CaptureSurface>()
  private readonly busyLibraries = new Set<string>()
  private persistQueue: Promise<void> = Promise.resolve()

  constructor(private readonly storagePath: string) {}

  async initialize(): Promise<void> {
    try {
      const persisted = await readJson<unknown>(this.storagePath)
      if (!persisted || typeof persisted !== 'object') return
      const sessions = (persisted as Record<string, unknown>).sessions
      if (!sessions || typeof sessions !== 'object') return
      for (const [libraryId, session] of Object.entries(sessions)) {
        if (isPersistedSession(session)) {
          this.sessions.set(libraryId, { ...session, assetsRevision: session.assetsRevision ?? 0 })
        }
      }
    } catch {
      // Missing or malformed disposable draft state starts clean.
    }
  }

  get(libraryId: string): CaptureSessionDto {
    this.validateLibraryId(libraryId)
    const session = this.sessions.get(libraryId) ?? {
      revision: 0,
      assetsRevision: 0,
      markdown: ''
    }
    return {
      libraryId,
      ...session,
      owner: this.owners.get(libraryId) ?? null,
      busy: this.busyLibraries.has(libraryId)
    }
  }

  async update(
    libraryId: string,
    expectedRevision: number,
    markdown: string,
    surface: CaptureSurface
  ): Promise<CaptureSessionDto> {
    this.validateLibraryId(libraryId)
    if (typeof markdown !== 'string' || markdown.length > MAXIMUM_CAPTURE_MARKDOWN_LENGTH) {
      throw new Error('The capture draft is invalid or too large.')
    }
    const current = this.get(libraryId)
    if (current.owner !== surface) throw new Error('This capture surface is no longer active.')
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== current.revision) {
      throw new StaleCaptureSessionError()
    }
    const next = {
      revision: current.revision + 1,
      assetsRevision: current.assetsRevision,
      markdown,
      lastSubmission: this.sessions.get(libraryId)?.lastSubmission
    }
    this.sessions.set(libraryId, next)
    await this.persist()
    return this.get(libraryId)
  }

  async clear(libraryId: string): Promise<CaptureSessionDto> {
    const current = this.get(libraryId)
    this.sessions.set(libraryId, {
      revision: current.revision + 1,
      assetsRevision: current.assetsRevision + 1,
      markdown: '',
      lastSubmission: this.sessions.get(libraryId)?.lastSubmission
    })
    await this.persist()
    return this.get(libraryId)
  }

  claim(libraryId: string, surface: CaptureSurface): CaptureSessionDto {
    this.validateLibraryId(libraryId)
    const currentOwner = this.owners.get(libraryId)
    if (this.busyLibraries.has(libraryId) && currentOwner && currentOwner !== surface) {
      throw new Error('Capture is still saving or staging in the other window.')
    }
    this.owners.set(libraryId, surface)
    return this.get(libraryId)
  }

  setBusy(libraryId: string, surface: CaptureSurface, busy: boolean): CaptureSessionDto {
    const current = this.get(libraryId)
    if (current.owner !== surface) throw new Error('This capture surface is no longer active.')
    if (busy) this.busyLibraries.add(libraryId)
    else this.busyLibraries.delete(libraryId)
    return this.get(libraryId)
  }

  async touchAssets(libraryId: string): Promise<CaptureSessionDto> {
    const current = this.get(libraryId)
    this.sessions.set(libraryId, {
      revision: current.revision,
      assetsRevision: current.assetsRevision + 1,
      markdown: current.markdown,
      lastSubmission: this.sessions.get(libraryId)?.lastSubmission
    })
    await this.persist()
    return this.get(libraryId)
  }

  submissionForRevision(libraryId: string, sourceRevision: number): string | null {
    const session = this.sessions.get(libraryId)
    return session?.lastSubmission?.sourceRevision === sourceRevision
      ? session.lastSubmission.id
      : null
  }

  async resetAfterSubmission(
    libraryId: string,
    expectedRevision: number,
    submissionId: string
  ): Promise<CaptureSessionDto> {
    const current = this.get(libraryId)
    const persisted = this.sessions.get(libraryId)
    if (persisted?.lastSubmission?.sourceRevision === expectedRevision) return current
    if (current.revision !== expectedRevision) throw new StaleCaptureSessionError()
    this.sessions.set(libraryId, {
      revision: current.revision + 1,
      assetsRevision: current.assetsRevision + 1,
      markdown: '',
      lastSubmission: { sourceRevision: expectedRevision, id: submissionId }
    })
    this.busyLibraries.delete(libraryId)
    await this.persist()
    return this.get(libraryId)
  }

  async restore(
    libraryId: string,
    markdown: string,
    surface: CaptureSurface
  ): Promise<CaptureSessionDto> {
    const current = this.get(libraryId)
    if (current.markdown.trim()) throw new Error('Save or discard the current draft first.')
    this.owners.set(libraryId, surface)
    this.sessions.set(libraryId, {
      revision: current.revision + 1,
      assetsRevision: current.assetsRevision + 1,
      markdown,
      lastSubmission: this.sessions.get(libraryId)?.lastSubmission
    })
    await this.persist()
    return this.get(libraryId)
  }

  private async persist(): Promise<void> {
    this.persistQueue = this.persistQueue.then(() => {
      const sessions = Object.fromEntries(this.sessions)
      return writeJsonAtomic(this.storagePath, {
        schemaVersion: 1,
        sessions
      } satisfies PersistedCaptureSessions)
    })
    await this.persistQueue
  }

  private validateLibraryId(libraryId: string): void {
    if (typeof libraryId !== 'string' || libraryId.length < 1 || libraryId.length > 200) {
      throw new Error('The capture library identifier is invalid.')
    }
  }
}
