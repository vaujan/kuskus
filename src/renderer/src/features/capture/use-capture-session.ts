import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'

import {
  CaptureDraftTracker,
  resolveCaptureOwnershipAction,
  type CaptureDraftWriteToken
} from '@/features/capture/capture-draft-tracker'
import type { CaptureSessionDto, CaptureSurface } from '../../../../shared/capture-contract'

export function useCaptureSession({
  libraryId,
  surface,
  active,
  legacyStorageKey
}: {
  libraryId: string
  surface: CaptureSurface
  active: boolean
  legacyStorageKey?: string
}): {
  markdown: string
  revision: number
  assetsRevision: number
  owner: CaptureSurface | null
  busy: boolean
  waitingForOwnership: boolean
  loaded: boolean
  error: string
  setMarkdown: (markdown: SetStateAction<string>) => void
  clear: () => Promise<void>
  touchAssets: () => Promise<void>
  setBusy: (busy: boolean) => Promise<void>
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
  const legacyMigrationStarted = useRef(false)
  const ownershipAction = resolveCaptureOwnershipAction({ active, loaded, busy, owner, surface })

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
    let result = await window.capture.claimSurface(libraryId, surface)
    if (!result.ok) {
      if (result.code === 'busy') {
        setError('')
        const latest = await window.capture.getSession(libraryId)
        if (!latest.ok) {
          setError(latest.error)
          return
        }
        accept(latest.data)
        if (!active || latest.data.busy || latest.data.owner === surface) return
        result = await window.capture.claimSurface(libraryId, surface)
        if (!result.ok && result.code === 'busy') return
      }
      if (!result.ok) {
        setError(result.error)
        return
      }
    }
    setError('')
    accept(result.data)
  }, [accept, active, libraryId, surface])

  useEffect(() => {
    let mounted = true
    const unsubscribe = window.capture.onSessionChanged((session) => {
      if (mounted) accept(session)
    })
    void (async () => {
      const result = await window.capture.getSession(libraryId)
      if (!mounted) return
      if (!result.ok) {
        setError(result.error)
        setLoaded(true)
        return
      }
      accept(result.data)
      if (legacyStorageKey && result.data.markdown) {
        localStorage.removeItem(legacyStorageKey)
      }
    })()
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [accept, legacyMarkdown, legacyStorageKey, libraryId, surface])

  useEffect(() => {
    if (ownershipAction !== 'claim') return
    const request = window.setTimeout(() => void claim())
    return () => window.clearTimeout(request)
  }, [claim, ownershipAction])

  useEffect(() => {
    if (
      !active ||
      !loaded ||
      owner !== surface ||
      !legacyStorageKey ||
      !legacyMarkdown ||
      legacyMigrationStarted.current
    ) {
      return
    }
    legacyMigrationStarted.current = true
    let mounted = true
    void window.capture
      .updateSession({
        libraryId,
        expectedRevision: tracker.current.getSnapshot().revision,
        markdown: legacyMarkdown
      })
      .then((migrated) => {
        if (!mounted) return
        if (!migrated.ok) {
          legacyMigrationStarted.current = false
          setError(migrated.error)
          return
        }
        localStorage.removeItem(legacyStorageKey)
        setError('')
        accept(migrated.data)
      })
    return () => {
      mounted = false
    }
  }, [accept, active, legacyMarkdown, legacyStorageKey, libraryId, loaded, owner, surface])

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
    waitingForOwnership: ownershipAction === 'wait',
    loaded,
    error,
    setMarkdown,
    clear,
    touchAssets,
    setBusy,
    flush
  }
}
