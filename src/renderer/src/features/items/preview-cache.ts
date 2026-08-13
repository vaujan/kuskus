interface PreviewBytes {
  bytes: ArrayBuffer
  mediaType: string
  width?: number
  height?: number
}

interface CachedPreview {
  url: string
  references: number
  lastUsed: number
  decodedBytes: number
}

interface PreviewLease {
  url: string
  release: () => void
}

const MAX_CONCURRENT_REQUESTS = 6
const MAX_CACHED_PREVIEWS = 64
const MAX_DECODED_BYTES = 32 * 1024 * 1024
const DEFAULT_DECODED_BYTES = 4 * 1024 * 1024
const cache = new Map<string, CachedPreview>()
const pending = new Map<string, Promise<CachedPreview>>()
const queue: Array<() => void> = []
let activeRequests = 0
let cachedDecodedBytes = 0

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

function removePreview(key: string, entry: CachedPreview): void {
  cache.delete(key)
  cachedDecodedBytes -= entry.decodedBytes
  URL.revokeObjectURL(entry.url)
}

function evictUnusedPreviews(): void {
  if (cache.size <= MAX_CACHED_PREVIEWS && cachedDecodedBytes <= MAX_DECODED_BYTES) return
  const candidates = [...cache.entries()]
    .filter(([, entry]) => entry.references === 0)
    .sort((left, right) => left[1].lastUsed - right[1].lastUsed)
  for (const [key, entry] of candidates) {
    removePreview(key, entry)
    if (cache.size <= MAX_CACHED_PREVIEWS && cachedDecodedBytes <= MAX_DECODED_BYTES) break
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
        const decodedBytes =
          preview.width && preview.height
            ? preview.width * preview.height * 4
            : DEFAULT_DECODED_BYTES
        const loaded = {
          url: URL.createObjectURL(new Blob([preview.bytes], { type: preview.mediaType })),
          references: 0,
          lastUsed: performance.now(),
          decodedBytes
        }
        cache.set(key, loaded)
        cachedDecodedBytes += decodedBytes
        pending.delete(key)
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
  evictUnusedPreviews()
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
