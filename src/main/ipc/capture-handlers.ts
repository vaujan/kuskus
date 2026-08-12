import { BrowserWindow, ipcMain, type WebContents } from 'electron'

import {
  CAPTURE_CHANNELS,
  type CaptureSessionDto,
  type CaptureQueueDto,
  type CaptureSurface,
  type SubmitCaptureInput,
  type UpdateCaptureSessionInput
} from '../../shared/capture-contract'
import type { LibraryService } from '../library/library-service'
import {
  BusyCaptureSessionError,
  CaptureSessionService,
  StaleCaptureSessionError
} from '../capture/capture-session-service'
import { CaptureSubmissionService } from '../capture/capture-submission-service'
import { errorResult } from './api-result'

interface CaptureWindowActions {
  surfaceFor: (sender: WebContents) => CaptureSurface | null
  hideQuickCapture: () => void
  openMainCapture: () => void
  openMainItem: (itemId: string) => void
  openRecovery: () => void
  setQuickCaptureHeight: (height: number) => void
  setQuickCaptureBlurSuppressed: (suppressed: boolean) => void
}

function broadcast(session: CaptureSessionDto): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(CAPTURE_CHANNELS.sessionChanged, session)
  }
}

function broadcastQueue(queue: CaptureQueueDto): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(CAPTURE_CHANNELS.queueChanged, queue)
  }
}

export function registerCaptureIpc(
  sessions: CaptureSessionService,
  libraryService: LibraryService,
  windows: CaptureWindowActions
): void {
  const submissions = new CaptureSubmissionService(
    sessions,
    libraryService,
    broadcastQueue,
    broadcast
  )
  const requireReadyLibrary = async (libraryId: unknown): Promise<string> => {
    if (typeof libraryId !== 'string') throw new Error('The capture library is invalid.')
    const state = await libraryService.getState()
    if (state.status !== 'ready' || state.library.id !== libraryId) {
      throw new Error('Open the matching library before editing this draft.')
    }
    return libraryId
  }

  ipcMain.handle(CAPTURE_CHANNELS.getSession, async (_event, libraryId: unknown) => {
    try {
      return { ok: true, data: sessions.get(await requireReadyLibrary(libraryId)) }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(
    CAPTURE_CHANNELS.claimSurface,
    async (event, libraryId: unknown, requested: unknown) => {
      try {
        const surface = windows.surfaceFor(event.sender)
        if ((requested !== 'main' && requested !== 'quick') || requested !== surface) {
          throw new Error('The capture surface is invalid.')
        }
        const session = sessions.claim(await requireReadyLibrary(libraryId), surface)
        broadcast(session)
        return { ok: true, data: session }
      } catch (error) {
        return errorResult(
          error,
          error instanceof BusyCaptureSessionError ? 'busy' : 'invalid-input'
        )
      }
    }
  )

  ipcMain.handle(CAPTURE_CHANNELS.updateSession, async (event, input: unknown) => {
    try {
      if (!input || typeof input !== 'object') throw new Error('The capture update is invalid.')
      const surface = windows.surfaceFor(event.sender)
      if (!surface) throw new Error('The capture surface is unavailable.')
      const candidate = input as UpdateCaptureSessionInput
      const libraryId = await requireReadyLibrary(candidate.libraryId)
      const session = await sessions.update(
        libraryId,
        candidate.expectedRevision,
        candidate.markdown,
        surface
      )
      broadcast(session)
      return { ok: true, data: session }
    } catch (error) {
      return errorResult(
        error,
        error instanceof StaleCaptureSessionError ? 'conflict' : 'invalid-input'
      )
    }
  })

  ipcMain.handle(CAPTURE_CHANNELS.clearSession, async (_event, libraryId: unknown) => {
    try {
      const session = await sessions.clear(await requireReadyLibrary(libraryId))
      broadcast(session)
      return { ok: true, data: session }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(CAPTURE_CHANNELS.touchAssets, async (_event, libraryId: unknown) => {
    try {
      const session = await sessions.touchAssets(await requireReadyLibrary(libraryId))
      broadcast(session)
      return { ok: true, data: session }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(CAPTURE_CHANNELS.setBusy, async (event, libraryId: unknown, busy: unknown) => {
    try {
      const surface = windows.surfaceFor(event.sender)
      if (!surface || typeof busy !== 'boolean') throw new Error('The capture state is invalid.')
      const session = sessions.setBusy(await requireReadyLibrary(libraryId), surface, busy)
      broadcast(session)
      return { ok: true, data: session }
    } catch (error) {
      return errorResult(error, 'invalid-input')
    }
  })

  ipcMain.handle(CAPTURE_CHANNELS.submit, async (event, input: unknown) => {
    try {
      if (!input || typeof input !== 'object') {
        throw new Error('The capture submission is invalid.')
      }
      const surface = windows.surfaceFor(event.sender)
      if (!surface) throw new Error('The capture surface is unavailable.')
      const candidate = input as SubmitCaptureInput
      await requireReadyLibrary(candidate.libraryId)
      return { ok: true, data: await submissions.submit(candidate, surface) }
    } catch (error) {
      return errorResult(
        error,
        error instanceof StaleCaptureSessionError ? 'conflict' : 'invalid-input'
      )
    }
  })

  ipcMain.handle(CAPTURE_CHANNELS.waitForSubmission, async (_event, id: unknown) => {
    try {
      if (typeof id !== 'string') throw new Error('The capture submission is invalid.')
      return { ok: true, data: await submissions.waitForSubmission(id) }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(CAPTURE_CHANNELS.getQueue, async (_event, libraryId: unknown) => {
    try {
      return { ok: true, data: await submissions.getQueue(await requireReadyLibrary(libraryId)) }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(CAPTURE_CHANNELS.retrySubmission, async (_event, id: unknown) => {
    try {
      if (typeof id !== 'string') throw new Error('The capture submission is invalid.')
      return { ok: true, data: await submissions.retry(id) }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(CAPTURE_CHANNELS.restoreSubmission, async (event, id: unknown) => {
    try {
      if (typeof id !== 'string') throw new Error('The capture submission is invalid.')
      const surface = windows.surfaceFor(event.sender)
      if (!surface) throw new Error('The capture surface is unavailable.')
      return { ok: true, data: await submissions.restore(id, surface) }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.handle(CAPTURE_CHANNELS.discardSubmission, async (_event, id: unknown) => {
    try {
      if (typeof id !== 'string') throw new Error('The capture submission is invalid.')
      return { ok: true, data: await submissions.discard(id) }
    } catch (error) {
      return errorResult(error)
    }
  })

  ipcMain.on(CAPTURE_CHANNELS.hideQuickCapture, windows.hideQuickCapture)
  ipcMain.on(CAPTURE_CHANNELS.openMainCapture, windows.openMainCapture)
  ipcMain.on(CAPTURE_CHANNELS.openMainItem, (_event, itemId: unknown) => {
    if (typeof itemId === 'string' && itemId.length > 0) windows.openMainItem(itemId)
  })
  ipcMain.on(CAPTURE_CHANNELS.openRecovery, windows.openRecovery)
  ipcMain.on(CAPTURE_CHANNELS.setQuickCaptureHeight, (_event, height: unknown) => {
    if (typeof height === 'number') windows.setQuickCaptureHeight(height)
  })
  ipcMain.on(CAPTURE_CHANNELS.setQuickCaptureBlurSuppressed, (_event, suppressed: unknown) => {
    if (typeof suppressed === 'boolean') windows.setQuickCaptureBlurSuppressed(suppressed)
  })
  void submissions.initialize()
}
