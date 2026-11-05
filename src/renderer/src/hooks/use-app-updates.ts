import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { UpdateStatus } from '../../../shared/update-contract'

export function useAppUpdates(): {
  status: UpdateStatus
  busy: boolean
  message: string
  label: string
  act: () => Promise<void>
} {
  const [status, setStatus] = useState<UpdateStatus>({ phase: 'unavailable' })
  useEffect(() => {
    const api = window.electron.updates
    let active = true
    let receivedEvent = false
    const unsubscribe = api.onStatus((next) => {
      receivedEvent = true
      if (active) setStatus(next)
    })
    void api
      .getStatus()
      .then((next) => {
        if (active && !receivedEvent) setStatus(next)
      })
      .catch(() => {
        if (active) setStatus({ phase: 'error', message: 'Could not connect to the updater.' })
      })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const busy = ['checking', 'downloading', 'installing'].includes(status.phase)
  const message =
    status.message ??
    {
      unavailable: 'In-app updates are available in installed Windows builds.',
      idle: 'Kusu checks for updates automatically. Downloads start when you choose.',
      checking: 'Checking for updates…',
      current: 'Kusu is up to date.',
      available: `Version ${status.version} is available.`,
      downloading: `Downloading version ${status.version}… ${Math.floor(status.percent ?? 0)}%`,
      ready: `Version ${status.version} is ready. Restart to finish updating.`,
      installing: 'Saving notes and restarting…',
      error: 'Could not update Kusu. Try again.'
    }[status.phase]
  const label =
    status.phase === 'available'
      ? 'Download update'
      : status.phase === 'ready'
        ? 'Restart to update'
        : status.phase === 'downloading'
          ? 'Downloading…'
          : status.phase === 'installing'
            ? 'Restarting…'
            : status.phase === 'checking'
              ? 'Checking…'
              : 'Check for updates'
  const act = async (): Promise<void> => {
    try {
      const api = window.electron.updates
      if (status.phase === 'available') await api.download()
      else if (status.phase === 'ready') await api.install()
      else {
        await api.check()
        if ((await api.getStatus()).phase === 'current') {
          toast.info('Kusu is up to date', { id: 'app-update-current' })
        }
      }
    } catch {
      setStatus({ phase: 'error', message: 'Could not update Kusu. Please try again.' })
    }
  }

  return { status, busy, message, label, act }
}
