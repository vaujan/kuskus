import { useState } from 'react'
import { IconRefresh, IconRestore, IconTrash } from '@tabler/icons-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCaptureQueue } from '@/features/capture/use-capture-queue'
import type { ApiResult } from '../../../../shared/library-contract'

export function CaptureRecoveryDialog({
  libraryId,
  open,
  onOpenChange,
  onRestored
}: {
  libraryId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestored: () => void
}): React.JSX.Element {
  const { queue, refresh } = useCaptureQueue(libraryId)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const run = async (
    id: string,
    action: () => Promise<ApiResult<unknown>>,
    restored = false
  ): Promise<void> => {
    setWorkingId(id)
    setError('')
    const result = await action()
    setWorkingId(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    await refresh()
    if (restored) {
      onOpenChange(false)
      onRestored()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Capture recovery</DialogTitle>
          <DialogDescription>
            Failed background captures stay here until you retry, restore, or discard them.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to update the capture</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {queue.failures.length === 0 ? (
          <p className="rounded-xl bg-muted/45 p-4 text-sm text-muted-foreground">
            No captures need attention.
          </p>
        ) : (
          <ScrollArea className="max-h-[min(28rem,60vh)]">
            <div className="space-y-3 pr-3">
              {queue.failures.map((failure) => (
                <article key={failure.id} className="space-y-3 rounded-xl border p-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {failure.kind} · {new Date(failure.submittedAt).toLocaleString()}
                    </p>
                    <p className="line-clamp-3 whitespace-pre-wrap text-sm">{failure.preview}</p>
                    <p className="text-xs text-destructive">{failure.error}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={workingId !== null}
                      onClick={() =>
                        void run(failure.id, () => window.capture.retrySubmission(failure.id))
                      }
                    >
                      <IconRefresh data-icon="inline-start" aria-hidden="true" />
                      Retry
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={workingId !== null}
                      onClick={() =>
                        void run(
                          failure.id,
                          () => window.capture.restoreSubmission(failure.id),
                          true
                        )
                      }
                    >
                      <IconRestore data-icon="inline-start" aria-hidden="true" />
                      Restore to composer
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={workingId !== null}
                      onClick={() =>
                        void run(failure.id, () => window.capture.discardSubmission(failure.id))
                      }
                    >
                      <IconTrash data-icon="inline-start" aria-hidden="true" />
                      Discard
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
