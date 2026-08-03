import type { CaptureSessionDto, CaptureSurface } from '../../../../shared/capture-contract'

export interface CaptureDraftWriteToken {
  id: number
  generation: number
  ownershipGeneration: number
}

export interface CaptureDraftSnapshot {
  markdown: string
  revision: number
  assetsRevision: number
  owner: CaptureSurface | null
  busy: boolean
}

export type CaptureOwnershipAction = 'idle' | 'wait' | 'claim'

export function resolveCaptureOwnershipAction({
  active,
  loaded,
  busy,
  owner,
  surface
}: {
  active: boolean
  loaded: boolean
  busy: boolean
  owner: CaptureSurface | null
  surface: CaptureSurface
}): CaptureOwnershipAction {
  if (!active || !loaded || owner === surface) return 'idle'
  return busy ? 'wait' : 'claim'
}

export function shouldYieldMainComposer(
  owner: CaptureSurface | null,
  mainOwnershipRequested: boolean
): boolean {
  return owner === 'quick' && !mainOwnershipRequested
}

export class CaptureDraftTracker {
  private snapshot: CaptureDraftSnapshot
  private localGeneration: number
  private synchronizedGeneration = 0
  private ownershipGeneration = 0
  private nextWriteId = 0
  private readonly pendingWrites = new Set<number>()

  constructor(initialMarkdown: string) {
    this.localGeneration = initialMarkdown ? 1 : 0
    this.snapshot = {
      markdown: initialMarkdown,
      revision: 0,
      assetsRevision: 0,
      owner: null,
      busy: false
    }
  }

  getSnapshot(): CaptureDraftSnapshot {
    return this.snapshot
  }

  edit(markdown: string): CaptureDraftWriteToken {
    this.localGeneration += 1
    this.nextWriteId += 1
    const token = {
      id: this.nextWriteId,
      generation: this.localGeneration,
      ownershipGeneration: this.ownershipGeneration
    }
    this.pendingWrites.add(token.id)
    this.snapshot = { ...this.snapshot, markdown }
    return token
  }

  accept(session: CaptureSessionDto, surface: CaptureSurface): boolean {
    if (session.revision < this.snapshot.revision) return false

    const previousMarkdown = this.snapshot.markdown
    const remoteOwner = session.owner !== null && session.owner !== surface
    if (remoteOwner) {
      this.ownershipGeneration += 1
      this.pendingWrites.clear()
      this.localGeneration += 1
      this.synchronizedGeneration = this.localGeneration
    }

    const hasUnsynchronizedLocalEdit =
      this.localGeneration !== this.synchronizedGeneration || this.pendingWrites.size > 0
    const markdown =
      remoteOwner || !hasUnsynchronizedLocalEdit ? session.markdown : this.snapshot.markdown

    this.snapshot = {
      markdown,
      revision: session.revision,
      assetsRevision: session.assetsRevision,
      owner: session.owner,
      busy: session.busy
    }
    return markdown !== previousMarkdown
  }

  canPersist(token: CaptureDraftWriteToken, surface: CaptureSurface): boolean {
    return (
      this.pendingWrites.has(token.id) &&
      token.ownershipGeneration === this.ownershipGeneration &&
      (this.snapshot.owner === null || this.snapshot.owner === surface)
    )
  }

  finish(
    token: CaptureDraftWriteToken,
    session: CaptureSessionDto | null,
    surface: CaptureSurface
  ): boolean {
    if (!this.pendingWrites.delete(token.id)) return false
    const markdownChanged = session ? this.accept(session, surface) : false
    if (
      session &&
      session.owner === surface &&
      token.generation === this.localGeneration &&
      session.markdown === this.snapshot.markdown
    ) {
      this.synchronizedGeneration = this.localGeneration
    }
    return markdownChanged
  }
}
