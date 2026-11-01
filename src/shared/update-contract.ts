export const UPDATE_CHANNELS = {
  status: 'updates:status',
  changed: 'updates:changed',
  check: 'updates:check',
  download: 'updates:download',
  install: 'updates:install',
  prepare: 'updates:prepare',
  prepared: 'updates:prepared'
} as const

export interface UpdateStatus {
  phase:
    | 'unavailable'
    | 'idle'
    | 'checking'
    | 'current'
    | 'available'
    | 'downloading'
    | 'ready'
    | 'installing'
    | 'error'
  version?: string
  percent?: number
  message?: string
}

export interface UpdateApi {
  getStatus(): Promise<UpdateStatus>
  check(): Promise<void>
  download(): Promise<void>
  install(): Promise<void>
  onStatus(callback: (status: UpdateStatus) => void): () => void
  onPrepare(callback: () => Promise<boolean>): () => void
}
