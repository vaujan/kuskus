import { useEffect, useMemo, useState } from 'react'

import type { ImagePreviewDto, NoteAttachmentDto } from '../../../../shared/library-contract'
import { markdownImageTargetKey } from '../../../../shared/markdown-image-references'
import { acquirePreview } from './preview-cache'

/**
 * Unified image resolution for a note (or capture draft).
 *
 * Every consumer — Read mode, Live mode, Split, and the capture composer —
 * resolves a markdown image target through this one contract instead of
 * building its own `attachment → preview` map. The fetch/cache layer was
 * already shared (`preview-cache`); this makes the *resolution* layer
 * shared too, so a target resolves to the same `ResolvedImage` no matter
 * which surface renders it.
 */

export type ResolvedImage =
  | {
      kind: 'image'
      src: string
      alt: string
      width?: number
      height?: number
      remote?: boolean
      caption?: string
    }
  | {
      kind: 'loading'
      label: string
    }
  | {
      kind: 'missing'
      label: string
    }
  | {
      kind: 'invalid'
      label: string
    }

export interface NoteImageResolution {
  /** Resolve one markdown image target (relative path or filename). */
  resolve: (target: string) => ResolvedImage | null
  /** All resolved attachments, keyed by attachment id. */
  resolutions: Record<string, ResolvedImage>
}

/**
 * Fetch full-resolution previews for every available attachment and
 * lease them through the shared `preview-cache` (refcounted, evicted,
 * deduped). Returns a stable map once loaded; returns `{}` until then
 * so consumers render their loading state.
 *
 * `fetchPreview` is the per-consumer IPC call: note attachments use
 * `getNoteAttachmentPreview`, capture-draft attachments use
 * `getCaptureDraftImagePreview`. The cache key prefix keeps the two
 * pools apart.
 */
export function useNoteAttachmentPreviews(
  cacheKey: string,
  attachments: NoteAttachmentDto[],
  fetchPreview: (attachment: NoteAttachmentDto) => Promise<ImagePreviewDto>,
  enabled = true
): Record<string, string> {
  const [state, setState] = useState<{ key: string; previews: Record<string, string> }>({
    key: '',
    previews: {}
  })

  useEffect(() => {
    if (!enabled) return
    const available = attachments.filter((attachment) => !attachment.missingContent)
    if (available.length === 0) return

    let active = true
    const releases: Array<() => void> = []
    void Promise.all(
      available.map(async (attachment) => {
        const lease = await acquirePreview(`attachment:${cacheKey}:${attachment.id}`, async () => {
          const result = await fetchPreview(attachment)
          return result
        })
        if (!active) {
          lease.release()
          return null
        }
        releases.push(lease.release)
        return [attachment.id, lease.url] as const
      })
    ).then((entries) => {
      if (!active) return
      setState({
        key: cacheKey,
        previews: Object.fromEntries(entries.filter((entry) => entry !== null))
      })
    })

    return () => {
      active = false
      releases.forEach((release) => release())
    }
  }, [attachments, cacheKey, enabled, fetchPreview])

  return enabled &&
    attachments.some((attachment) => !attachment.missingContent) &&
    state.key === cacheKey
    ? state.previews
    : {}
}

function buildResolutions(
  attachments: NoteAttachmentDto[],
  previews: Record<string, string>
): NoteImageResolution {
  const byKey = new Map<string, { attachment: NoteAttachmentDto; preview: string | null }>()
  const resolutions: Record<string, ResolvedImage> = {}
  for (const attachment of attachments) {
    const entry = { attachment, preview: previews[attachment.id] ?? null }
    byKey.set(markdownImageTargetKey(attachment.relativePath), entry)
    byKey.set(markdownImageTargetKey(attachment.filename), entry)
    resolutions[attachment.id] = {
      kind: 'loading',
      label: attachment.filename
    }
  }

  const resolve = (target: string): ResolvedImage | null => {
    const entry = byKey.get(markdownImageTargetKey(target))
    if (!entry) return null
    if (entry.attachment.missingContent) {
      return { kind: 'missing', label: entry.attachment.filename }
    }
    if (!entry.preview) {
      return { kind: 'loading', label: entry.attachment.filename }
    }
    return {
      kind: 'image',
      src: entry.preview,
      alt: entry.attachment.filename,
      width: entry.attachment.width,
      height: entry.attachment.height,
      remote: false
    }
  }

  // Resolve the `resolutions` map through the same `resolve` so the
  // two access patterns can't drift. A preview arriving after the
  // first render flips each entry from loading → image.
  for (const attachment of attachments) {
    const resolved = resolve(attachment.relativePath)
    if (resolved) resolutions[attachment.id] = resolved
  }

  return { resolve, resolutions }
}

/**
 * One resolution source for a set of attachments (note or capture
 * draft). Read mode reads `resolutions`; live mode's `resolveImage`
 * option and the composer delegate to `resolve`. `attachments` must be
 * referentially stable between renders (memoized by the caller) so the
 * map isn't rebuilt and live decorations don't churn.
 */
export function useNoteImageResolutions(
  cacheKey: string,
  attachments: NoteAttachmentDto[],
  fetchPreview: (attachment: NoteAttachmentDto) => Promise<ImagePreviewDto>
): NoteImageResolution {
  const previews = useNoteAttachmentPreviews(cacheKey, attachments, fetchPreview)
  return useMemo(() => buildResolutions(attachments, previews), [attachments, previews])
}

/** Remote-image resolution shared by read mode and the live widgets. */
export function remoteImageResolution(src: string, alt: string): ResolvedImage {
  return { kind: 'image', src, alt, remote: true }
}
