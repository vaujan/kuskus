import type {
  NoteItemDto,
  UpdateNoteInput,
  UpdateNoteResult
} from '../../../../shared/library-contract'

export type NoteSaveStatus = 'saved' | 'dirty' | 'saving' | 'invalid' | 'error' | 'conflict'

export interface NoteAutosaveSnapshot {
  status: NoteSaveStatus
  draft: string
  savedMarkdown: string
  error: string | null
  conflict: NoteItemDto | null
}

interface NoteAutosaveOptions {
  itemId: string
  initialMarkdown: string
  delay?: number
  save: (input: UpdateNoteInput) => Promise<UpdateNoteResult>
  onSaved: (item: NoteItemDto) => void
  onDraftReplaced: (markdown: string) => void
}

export class NoteAutosaveCoordinator {
  private snapshot: NoteAutosaveSnapshot
  private readonly listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private inFlight: Promise<void> | null = null
  private disposed = false
  private readonly delay: number

  constructor(private readonly options: NoteAutosaveOptions) {
    this.delay = options.delay ?? 800
    this.snapshot = {
      status: 'saved',
      draft: options.initialMarkdown,
      savedMarkdown: options.initialMarkdown,
      error: null,
      conflict: null
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): NoteAutosaveSnapshot => this.snapshot

  updateDraft(markdown: string): void {
    if (this.disposed || markdown === this.snapshot.draft) return
    this.clearTimer()
    const dirty = markdown !== this.snapshot.savedMarkdown
    const invalid = dirty && !markdown.trim()
    this.setSnapshot({
      ...this.snapshot,
      draft: markdown,
      error: this.snapshot.conflict
        ? this.snapshot.error
        : invalid
          ? 'A saved note cannot be empty.'
          : null,
      status: this.snapshot.conflict ? 'conflict' : invalid ? 'invalid' : dirty ? 'dirty' : 'saved'
    })
    if (dirty && !invalid && !this.snapshot.conflict) this.schedule()
  }

  async flush(): Promise<boolean> {
    this.clearTimer()
    return this.savePending(true)
  }

  async retry(): Promise<boolean> {
    if (this.snapshot.conflict || !this.snapshot.draft.trim()) return false
    this.setSnapshot({ ...this.snapshot, status: 'dirty', error: null })
    return this.flush()
  }

  restoreSaved(): void {
    this.clearTimer()
    const markdown = this.snapshot.savedMarkdown
    this.setSnapshot({
      status: 'saved',
      draft: markdown,
      savedMarkdown: markdown,
      error: null,
      conflict: null
    })
    this.options.onDraftReplaced(markdown)
  }

  useDiskVersion(current: NoteItemDto): void {
    this.clearTimer()
    this.setSnapshot({
      status: 'saved',
      draft: current.body,
      savedMarkdown: current.body,
      error: null,
      conflict: null
    })
    this.options.onDraftReplaced(current.body)
    this.options.onSaved(current)
  }

  async useLocalVersion(current: NoteItemDto): Promise<boolean> {
    this.setSnapshot({
      ...this.snapshot,
      status: this.snapshot.draft.trim() ? 'dirty' : 'invalid',
      savedMarkdown: current.body,
      error: this.snapshot.draft.trim() ? null : 'A saved note cannot be empty.',
      conflict: null
    })
    return this.flush()
  }

  hasPendingChanges(): boolean {
    return this.inFlight !== null || this.snapshot.draft !== this.snapshot.savedMarkdown
  }

  dispose(): void {
    this.disposed = true
    this.clearTimer()
    this.listeners.clear()
  }

  private schedule(): void {
    this.timer = setTimeout(() => {
      this.timer = null
      void this.savePending(false)
    }, this.delay)
  }

  private async savePending(drain: boolean): Promise<boolean> {
    if (this.disposed || this.snapshot.conflict || !this.snapshot.draft.trim()) return false

    if (this.inFlight) {
      await this.inFlight
      if (!drain) return this.snapshot.status !== 'error' && this.snapshot.status !== 'conflict'
    }

    while (this.snapshot.draft !== this.snapshot.savedMarkdown) {
      if (this.snapshot.conflict || !this.snapshot.draft.trim()) return false
      await this.startSave()
      if (this.snapshot.status === 'error' || this.snapshot.status === 'conflict') return false
      if (!drain && this.snapshot.draft !== this.snapshot.savedMarkdown) {
        this.schedule()
        return true
      }
    }
    return true
  }

  private async startSave(): Promise<void> {
    const markdown = this.snapshot.draft
    const expectedMarkdown = this.snapshot.savedMarkdown
    this.setSnapshot({ ...this.snapshot, status: 'saving', error: null })

    this.inFlight = this.options
      .save({ itemId: this.options.itemId, markdown, expectedMarkdown })
      .then((result) => {
        if (this.disposed) return
        if (!result.ok) {
          if (result.code === 'conflict') {
            this.setSnapshot({
              ...this.snapshot,
              status: 'conflict',
              error: result.error,
              conflict: result.conflict.current
            })
          } else {
            this.setSnapshot({
              ...this.snapshot,
              status: 'error',
              error: result.error,
              conflict: null
            })
          }
          return
        }

        const dirty = this.snapshot.draft !== result.data.body
        this.setSnapshot({
          ...this.snapshot,
          status: dirty ? 'dirty' : 'saved',
          savedMarkdown: result.data.body,
          error: null,
          conflict: null
        })
        this.options.onSaved(result.data)
      })
      .catch((error: unknown) => {
        if (this.disposed) return
        this.setSnapshot({
          ...this.snapshot,
          status: 'error',
          error: error instanceof Error ? error.message : 'The note could not be saved.',
          conflict: null
        })
      })
      .finally(() => {
        this.inFlight = null
      })

    await this.inFlight
  }

  private clearTimer(): void {
    if (!this.timer) return
    clearTimeout(this.timer)
    this.timer = null
  }

  private setSnapshot(snapshot: NoteAutosaveSnapshot): void {
    this.snapshot = snapshot
    this.listeners.forEach((listener) => listener())
  }
}
