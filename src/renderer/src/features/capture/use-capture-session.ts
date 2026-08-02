import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'

import {
  CaptureDraftTracker,
  type CaptureDraftWriteToken
} from '@/features/capture/capture-draft-tracker'
import type { CaptureSessionDto, CaptureSurface } from '../../../../shared/capture-contract'

export function useCaptureSession({
  libraryId,
  surface,
  legacyStorageKey
}: {
  libraryId: string
  surface: CaptureSurface
  legacyStorageKey?: string
}): {
  markdown: string
  revision: number
  assetsRevision: number
  owner: CaptureSurface | null
  busy: boolean
  loaded: boolean
  error: string
  setMarkdown: (markdown: SetStateAction<string>) => void
  clear: () => Promise<void>
  touchAssets: () => Promise<void>
  setBusy: (busy: boolean) => Promise<void>
  claim: () => Promise<void>
  flush: () => Promise<number>
} {
  const legacyMarkdown = legacyStorageKey ? (localStorage.getItem(legacyStorageKey) ?? '') : ''
  const [markdown, setMarkdownState] = useState(legacyMarkdown)
  const [owner, setOwner] = useState<CaptureSurface | null>(null)
  const [busy, setBusyState] = useState(false)
  const [revisionState, setRevisionState] = useState(0)
  const [assetsRevision, setAssetsRevision] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const tracker = useRef(new CaptureDraftTracker(legacyMarkdown))
  const persistQueue = useRef(Promise.resolve())

  const accept = useCallback(
    (session: CaptureSessionDto): void => {
      if (session.libraryId !== libraryId) return
      const markdownChanged = tracker.current.accept(session, surface)
      const snapshot = tracker.current.getSnapshot()
      setRevisionState(snapshot.revision)
      setAssetsRevision(snapshot.assetsRevision)
      setOwner(snapshot.owner)
      setBusyState(snapshot.busy)
      if (markdownChanged) setMarkdownState(snapshot.markdown)
      setLoaded(true)
    },
    [libraryId, surface]
  )

  const acceptFinishedWrite = useCallback(
    (token: CaptureDraftWriteToken, session: CaptureSessionDto | null): void => {
      const markdownChanged = tracker.current.finish(token, session, surface)
      const snapshot = tracker.current.getSnapshot()
      setRevisionState(snapshot.revision)
      setAssetsRevision(snapshot.assetsRevision)
      setOwner(snapshot.owner)
      setBusyState(snapshot.busy)
      if (markdownChanged) setMarkdownState(snapshot.markdown)
    },
    [surface]
  )

  const claim = useCallback(async (): Promise<void> => {
    const result = await window.capture.claimSurface(libraryId, surface)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError('')
    accept(result.data)
  }, [accept, libraryId, surface])

  useEffect(() => {
    let active = true
    const unsubscribe = window.capture.onSessionChanged((session) => {
      if (active) accept(session)
    })
    void (async () => {
      if (surface === 'main') await claim()
      const result = await window.capture.getSession(libraryId)
      if (!active) return
      if (!result.ok) {
        setError(result.error)
        setLoaded(true)
        return
      }
      accept(result.data)
      if (legacyStorageKey && legacyMarkdown && !result.data.markdown) {
        const claimed = await window.capture.claimSurface(libraryId, surface)
        if (!claimed.ok || !active) return
        accept(claimed.data)
        const migrated = await window.capture.updateSession({
          libraryId,
          expectedRevision: tracker.current.getSnapshot().revision,
          markdown: legacyMarkdown
        })
        if (!active) return
        if (migrated.ok) {
          localStorage.removeItem(legacyStorageKey)
          accept(migrated.data)
        }
      } else if (legacyStorageKey && result.data.markdown) {
        localStorage.removeItem(legacyStorageKey)
      }
    })()
    return () => {
      active = false
      unsubscribe()
    }
  }, [accept, claim, legacyMarkdown, legacyStorageKey, libraryId, surface])

  const setMarkdown = useCallback(
    (nextValue: SetStateAction<string>): void => {
      const nextMarkdown =
        typeof nextValue === 'function'
          ? nextValue(tracker.current.getSnapshot().markdown)
          : nextValue
      const token = tracker.current.edit(nextMarkdown)
      setMarkdownState(nextMarkdown)
      persistQueue.current = persistQueue.current.then(async () => {
        if (!tracker.current.canPersist(token, surface)) return
        let result = await window.capture.updateSession({
          libraryId,
          expectedRevision: tracker.current.getSnapshot().revision,
          markdown: nextMarkdown
        })
        if (!result.ok && result.code === 'conflict') {
          const latest = await window.capture.getSession(libraryId)
          if (latest.ok) accept(latest.data)
          if (
            latest.ok &&
            latest.data.owner === surface &&
            tracker.current.canPersist(token, surface)
          ) {
            result = await window.capture.updateSession({
              libraryId,
              expectedRevision: tracker.current.getSnapshot().revision,
              markdown: nextMarkdown
            })
          }
        }
        if (result.ok) {
          setError('')
          acceptFinishedWrite(token, result.data)
        } else {
          acceptFinishedWrite(token, null)
          setError(result.error)
        }
      })
    },
    [accept, acceptFinishedWrite, libraryId, surface]
  )

  const clear = useCallback(async (): Promise<void> => {
    await persistQueue.current
    const result = await window.capture.clearSession(libraryId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError('')
    accept(result.data)
  }, [accept, libraryId])

  const touchAssets = useCallback(async (): Promise<void> => {
    const result = await window.capture.touchAssets(libraryId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    accept(result.data)
  }, [accept, libraryId])

  const setBusy = useCallback(
    async (nextBusy: boolean): Promise<void> => {
      const result = await window.capture.setBusy(libraryId, nextBusy)
      if (!result.ok) {
        setError(result.error)
        return
      }
      accept(result.data)
    },
    [accept, libraryId]
  )

  const flush = useCallback(async (): Promise<number> => {
    await persistQueue.current
    return tracker.current.getSnapshot().revision
  }, [])

  return {
    markdown,
    revision: revisionState,
    assetsRevision,
    owner,
    busy,
    loaded,
    error,
    setMarkdown,
    clear,
    touchAssets,
    setBusy,
    claim,
    flush
  }
}
