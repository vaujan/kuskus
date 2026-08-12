import type { ActiveItemLocation, ApiResult, LibraryItemDto } from './library-contract'

export const CAPTURE_CHANNELS = {
  getSession: 'capture:get-session',
  updateSession: 'capture:update-session',
  clearSession: 'capture:clear-session',
  touchAssets: 'capture:touch-assets',
  setBusy: 'capture:set-busy',
  claimSurface: 'capture:claim-surface',
  submit: 'capture:submit',
  waitForSubmission: 'capture:wait-for-submission',
  getQueue: 'capture:get-queue',
  retrySubmission: 'capture:retry-submission',
  restoreSubmission: 'capture:restore-submission',
  discardSubmission: 'capture:discard-submission',
  sessionChanged: 'capture:session-changed',
  queueChanged: 'capture:queue-changed',
  openRecovery: 'capture:open-recovery',
  recoveryRequested: 'capture:recovery-requested',
  quickCaptureActivated: 'capture:quick-activated',
  hideQuickCapture: 'capture:hide-quick',
  openMainCapture: 'capture:open-main',
  openMainItem: 'capture:open-main-item',
  mainItemRequested: 'capture:main-item-requested',
  setQuickCaptureHeight: 'capture:set-quick-height',
  setQuickCaptureBlurSuppressed: 'capture:set-quick-blur-suppressed'
} as const

export type CaptureSurface = 'main' | 'quick'
export type CaptureSubmissionKind = 'note' | 'url' | 'image' | 'file'
export type CaptureSubmissionStatus = 'accepted' | 'processing' | 'failed'

export interface CaptureSessionDto {
  libraryId: string
  revision: number
  assetsRevision: number
  markdown: string
  owner: CaptureSurface | null
  busy: boolean
}

export interface UpdateCaptureSessionInput {
  libraryId: string
  expectedRevision: number
  markdown: string
}

export interface SubmitCaptureInput {
  libraryId: string
  expectedRevision: number
  kind: CaptureSubmissionKind
  attachmentIds: string[]
  fileId: string | null
  destination: ActiveItemLocation
}

export interface CaptureSubmissionReceiptDto {
  id: string
  libraryId: string
  kind: CaptureSubmissionKind
  submittedAt: string
}

export interface CaptureFailureDto extends CaptureSubmissionReceiptDto {
  status: 'failed'
  error: string
  preview: string
}

export interface CaptureQueueDto {
  pendingCount: number
  failures: CaptureFailureDto[]
}

export interface CaptureApi {
  getSession: (libraryId: string) => Promise<ApiResult<CaptureSessionDto>>
  updateSession: (input: UpdateCaptureSessionInput) => Promise<ApiResult<CaptureSessionDto>>
  clearSession: (libraryId: string) => Promise<ApiResult<CaptureSessionDto>>
  touchAssets: (libraryId: string) => Promise<ApiResult<CaptureSessionDto>>
  setBusy: (libraryId: string, busy: boolean) => Promise<ApiResult<CaptureSessionDto>>
  claimSurface: (
    libraryId: string,
    surface: CaptureSurface
  ) => Promise<ApiResult<CaptureSessionDto>>
  submit: (input: SubmitCaptureInput) => Promise<ApiResult<CaptureSubmissionReceiptDto>>
  waitForSubmission: (id: string) => Promise<ApiResult<LibraryItemDto>>
  getQueue: (libraryId: string) => Promise<ApiResult<CaptureQueueDto>>
  retrySubmission: (id: string) => Promise<ApiResult<CaptureQueueDto>>
  restoreSubmission: (id: string) => Promise<ApiResult<CaptureSessionDto>>
  discardSubmission: (id: string) => Promise<ApiResult<CaptureQueueDto>>
  openRecovery: () => void
  hideQuickCapture: () => void
  openMainCapture: () => void
  openMainItem: (itemId: string) => void
  setQuickCaptureHeight: (height: number) => void
  setQuickCaptureBlurSuppressed: (suppressed: boolean) => void
  onSessionChanged: (callback: (session: CaptureSessionDto) => void) => () => void
  onQueueChanged: (callback: (queue: CaptureQueueDto) => void) => () => void
  onRecoveryRequested: (callback: () => void) => () => void
  onQuickCaptureActivated: (callback: () => void) => () => void
  onMainItemRequested: (callback: (itemId: string) => void) => () => void
}
