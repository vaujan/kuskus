interface PreviewBytes {
  bytes: ArrayBuffer
  mediaType: string
}

interface CachedPreview {
  url: string
  references: number
  lastUsed: number
}

interface PreviewLease {
  url: string
  release: () => void
}

const MAX_CONCURRENT_REQUESTS = 6
const MAX_CACHED_PREVIEWS = 128
const cache = new Map<string, CachedPreview>()
const pending = new Map<string, Promise<CachedPreview>>()
const queue: Array<() => void> = []
let activeRequests = 0

function drainQueue(): void {
  while (activeRequests < MAX_CONCURRENT_REQUESTS && queue.length > 0) {
    activeRequests += 1
    queue.shift()?.()
  }
}

function schedule<T>(operation: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => {
      void operation()
        .then(resolve, reject)
        .finally(() => {
          activeRequests -= 1
          drainQueue()
        })
    })
    drainQueue()
  })
}

function evictUnusedPreviews(): void {
  if (cache.size <= MAX_CACHED_PREVIEWS) return
  const candidates = [...cache.entries()]
    .filter(([, entry]) => entry.references === 0)
    .sort((left, right) => left[1].lastUsed - right[1].lastUsed)
  for (const [key, entry] of candidates) {
    cache.delete(key)
    URL.revokeObjectURL(entry.url)
    if (cache.size <= MAX_CACHED_PREVIEWS) break
  }
}

export async function acquirePreview(
  key: string,
  load: () => Promise<PreviewBytes>
): Promise<PreviewLease> {
  let entry = cache.get(key)
  if (!entry) {
    let request = pending.get(key)
    if (!request) {
      request = schedule(async () => {
        const preview = await load()
        const loaded = {
          url: URL.createObjectURL(new Blob([preview.bytes], { type: preview.mediaType })),
          references: 0,
          lastUsed: performance.now()
        }
        cache.set(key, loaded)
        pending.delete(key)
        evictUnusedPreviews()
        return loaded
      }).catch((error) => {
        pending.delete(key)
        throw error
      })
      pending.set(key, request)
    }
    entry = await request
  }
  entry.references += 1
  entry.lastUsed = performance.now()
  let released = false
  return {
    url: entry.url,
    release: () => {
      if (released) return
      released = true
      entry.references = Math.max(0, entry.references - 1)
      entry.lastUsed = performance.now()
      evictUnusedPreviews()
    }
  }
}
