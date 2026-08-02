import { useCallback, useEffect, useState } from 'react'

import type { CaptureQueueDto } from '../../../../shared/capture-contract'

const EMPTY_QUEUE: CaptureQueueDto = { pendingCount: 0, failures: [] }

export function useCaptureQueue(libraryId: string): {
  queue: CaptureQueueDto
  refresh: () => Promise<void>
} {
  const [queue, setQueue] = useState<CaptureQueueDto>(EMPTY_QUEUE)

  const refresh = useCallback(async (): Promise<void> => {
    const result = await window.capture.getQueue(libraryId)
    if (result.ok) setQueue(result.data)
  }, [libraryId])

  useEffect(() => {
    let active = true
    void window.capture.getQueue(libraryId).then((result) => {
      if (active && result.ok) setQueue(result.data)
    })
    const unsubscribe = window.capture.onQueueChanged(setQueue)
    return () => {
      active = false
      unsubscribe()
    }
  }, [libraryId])

  return { queue, refresh }
}
