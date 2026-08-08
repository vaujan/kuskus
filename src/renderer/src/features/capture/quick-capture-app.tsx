import { lazy, Suspense, useEffect, useRef, useState } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'
import type { LibraryDto, LibraryState } from '../../../../shared/library-contract'

const AddItemComposer = lazy(() =>
  import('@/features/capture/add-item-composer').then((module) => ({
    default: module.AddItemComposer
  }))
)

function QuickCaptureSurface({ library }: { library: LibraryDto }): React.JSX.Element {
  const [focusRequest, setFocusRequest] = useState(1)
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')
  const [status, setStatus] = useState('Quick capture ready in Inbox.')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(
    () =>
      window.capture.onQuickCaptureActivated(() => {
        setVisible(true)
        setFocusRequest((request) => request + 1)
      }),
    [library.id]
  )

  useEffect(() => {
    const updateVisibility = (): void => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let observedContent: HTMLElement | null = null
    const resize = new ResizeObserver(() => measure())
    const measure = (): void => {
      const composerContent = root.querySelector<HTMLElement>('.quick-capture-composer > *')
      const cardContent = root.querySelector<HTMLElement>(
        '.quick-capture-composer [data-slot="card-content"]'
      )
      const measuredContent = cardContent ?? composerContent
      if (measuredContent && measuredContent !== observedContent) {
        if (observedContent) resize.unobserve(observedContent)
        observedContent = measuredContent
        resize.observe(measuredContent)
      }
      let measuredHeight = measuredContent?.getBoundingClientRect().height ?? root.scrollHeight
      if (cardContent) {
        const contentTop = cardContent.getBoundingClientRect().top
        const occupiedBottom = Array.from(cardContent.children).reduce((bottom, child) => {
          const bounds = child.getBoundingClientRect()
          return bounds.width > 0 && bounds.height > 0 ? Math.max(bottom, bounds.bottom) : bottom
        }, contentTop)
        const paddingBottom =
          Number.parseFloat(window.getComputedStyle(cardContent).paddingBottom) || 0
        measuredHeight = occupiedBottom - contentTop + paddingBottom
      }
      window.capture.setQuickCaptureHeight(Math.ceil(measuredHeight))
    }
    const mutations = new MutationObserver(measure)
    mutations.observe(root, { childList: true, subtree: true })
    measure()
    return () => {
      resize.disconnect()
      mutations.disconnect()
    }
  }, [])

  return (
    <TooltipProvider>
      <div ref={rootRef} className="quick-capture-shell">
        <div className="quick-capture-composer">
          <Suspense fallback={null}>
          <AddItemComposer
            open
            focusRequest={focusRequest}
            discardRequest={0}
            libraryId={library.id}
            surface="quick"
            ownershipActive={visible}
            importRequest={null}
            view="grid"
            completionDelayMs={650}
            completeLinkAfterLocalSave
            dismissNoteInBackground
            onOpenChange={(open) => {
              if (!open) window.capture.hideQuickCapture()
            }}
            onImportRequestHandled={() => undefined}
            onCreated={() => true}
            onLinkCommitted={async (item) => ({ item, remainsVisible: true })}
            onLinkUpdated={() => undefined}
            onLinkReleased={() => undefined}
            onStatus={setStatus}
            onDraftStateChange={() => undefined}
            onTransientWorkChange={() => undefined}
            onFileDialogActiveChange={window.capture.setQuickCaptureBlurSuppressed}
          />
          </Suspense>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </TooltipProvider>
  )
}

export function QuickCaptureApp(): React.JSX.Element | null {
  const [state, setState] = useState<LibraryState | null>(null)

  useEffect(() => {
    let active = true
    void window.kuskus.getState().then((result) => {
      if (!active) return
      if (!result.ok || result.data.status !== 'ready') {
        window.capture.openMainCapture()
        window.capture.hideQuickCapture()
        return
      }
      setState(result.data)
    })
    return () => {
      active = false
    }
  }, [])

  return state?.status === 'ready' ? <QuickCaptureSurface library={state.library} /> : null
}
