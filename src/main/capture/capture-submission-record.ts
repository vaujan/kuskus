import type { CaptureSubmissionKind, CaptureSubmissionStatus } from '../../shared/capture-contract'
import type { ActiveItemLocation } from '../../shared/library-contract'

export interface CaptureSubmissionRecord {
  schemaVersion: 1 | 2
  id: string
  libraryId: string
  kind: CaptureSubmissionKind
  markdown: string
  attachmentIds: string[]
  fileId: string | null
  destination: ActiveItemLocation
  submittedAt: string
  sourceRevision: number
  status: CaptureSubmissionStatus | 'prepared'
  attempts: number
  error: string | null
}

export function isCaptureSubmissionRecord(value: unknown): value is CaptureSubmissionRecord {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    (candidate.schemaVersion === 1 || candidate.schemaVersion === 2) &&
    typeof candidate.id === 'string' &&
    typeof candidate.libraryId === 'string' &&
    (candidate.kind === 'note' ||
      candidate.kind === 'url' ||
      candidate.kind === 'image' ||
      candidate.kind === 'file') &&
    typeof candidate.markdown === 'string' &&
    Array.isArray(candidate.attachmentIds) &&
    candidate.attachmentIds.every((id) => typeof id === 'string') &&
    (candidate.fileId === null || typeof candidate.fileId === 'string') &&
    (candidate.destination === undefined ||
      (!!candidate.destination &&
        typeof candidate.destination === 'object' &&
        ((candidate.destination as Record<string, unknown>).type === 'inbox' ||
          ((candidate.destination as Record<string, unknown>).type === 'collection' &&
            typeof (candidate.destination as Record<string, unknown>).collectionId ===
              'string')))) &&
    typeof candidate.submittedAt === 'string' &&
    Number.isSafeInteger(candidate.sourceRevision) &&
    (candidate.status === 'prepared' ||
      candidate.status === 'accepted' ||
      candidate.status === 'processing' ||
      candidate.status === 'failed') &&
    Number.isSafeInteger(candidate.attempts) &&
    (candidate.error === null || typeof candidate.error === 'string')
  )
}

export function normalizeCaptureSubmissionRecord(
  record:
    | CaptureSubmissionRecord
    | (Omit<CaptureSubmissionRecord, 'destination'> & { destination?: ActiveItemLocation })
): CaptureSubmissionRecord {
  return {
    ...record,
    schemaVersion: 2,
    destination: record.destination ?? { type: 'inbox' }
  }
}
