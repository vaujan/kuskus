import type { ApiResult, LibraryItemDto, UrlItemDto } from '../../../../shared/library-contract'

// One queue per open vault. Network requests are bounded and completed metadata is published
// together, so a large import cannot create thousands of simultaneous IPC calls or renders.
export class UrlEnrichmentQueue {
  private readonly attempted = new Set<string>()
  private readonly pending = new Map<string, UrlItemDto>()
  private readonly completed = new Map<string, UrlItemDto>()
  private active = 0
  private pauseUntil = 0
  private pumpTimer: ReturnType<typeof setTimeout> | null = null
  private disposed = false
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly request: (id: string) => Promise<ApiResult<UrlItemDto>>,
    private readonly publish: (items: readonly UrlItemDto[]) => void
  ) {}

  sync(items: readonly LibraryItemDto[]): void {
    if (this.disposed) return
    this.pending.clear()
    for (const item of items) {
      if (
        item.type === 'url' &&
        (item.metadataStatus === 'pending' || item.metadataVersion < 2) &&
        !this.attempted.has(item.id)
      ) {
        this.pending.set(item.id, item)
      }
    }
    this.pump()
  }

  deferForInteraction(): void {
    this.pauseUntil = Date.now() + 150
  }

  dispose(): void {
    this.disposed = true
    if (this.timer) clearTimeout(this.timer)
    if (this.pumpTimer) clearTimeout(this.pumpTimer)
    this.pending.clear()
    this.completed.clear()
  }

  private flush(): void {
    this.timer = null
    if (this.disposed) return
    const remaining = this.pauseUntil - Date.now()
    if (remaining > 0) {
      this.timer = setTimeout(() => this.flush(), remaining)
      return
    }
    const updates = [...this.completed.values()]
    this.completed.clear()
    this.publish(updates)
  }

  private pump(): void {
    if (this.disposed) return
    const remaining = this.pauseUntil - Date.now()
    if (remaining > 0) {
      if (!this.pumpTimer)
        this.pumpTimer = setTimeout(() => {
          this.pumpTimer = null
          this.pump()
        }, remaining)
      return
    }
    while (!this.disposed && this.active < 4 && this.pending.size > 0) {
      const id = this.pending.keys().next().value!
      this.pending.delete(id)
      this.attempted.add(id)
      this.active++
      void Promise.resolve()
        .then(() => this.request(id))
        .then((result) => {
          if (this.disposed || !result.ok) return
          this.completed.set(id, result.data)
          if (this.timer) return
          this.timer = setTimeout(() => this.flush(), 100)
        })
        .catch(() => {
          // A failed IPC attempt is retried when the vault is reopened, never in a tight loop.
        })
        .finally(() => {
          this.active--
          this.pump()
        })
    }
  }
}
