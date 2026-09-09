import { useEffect, useRef, useState } from 'react'

import {
  clampFocusListWidth,
  FOCUS_SPLIT_BREAKPOINT,
  MAX_FOCUS_LIST_WIDTH,
  MIN_FOCUS_LIST_WIDTH
} from '@/features/items/focus-view-state'
import { ShellSidebarTrigger } from '@/features/shell/shell-sidebar-trigger'
import { WindowControls } from '@/features/shell/window-controls'
import { cn } from '@/lib/utils'

export function FocusWorkspace({
  listWidth,
  onListWidthChange,
  detailOpen,
  expanded,
  onSplitChange,
  onWindowClose,
  list,
  detail,
  className
}: {
  listWidth: number
  onListWidthChange: (width: number) => void
  detailOpen: boolean
  expanded: boolean
  onSplitChange?: (split: boolean) => void
  onWindowClose: () => void
  list: React.ReactNode
  detail: React.ReactNode
  className?: string
}): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLElement>(null)
  const detailRef = useRef<HTMLElement>(null)
  const previousDetailOpenRef = useRef(detailOpen)
  const dragStartRef = useRef<{ pointerX: number; width: number } | null>(null)
  const [availableWidth, setAvailableWidth] = useState(0)
  const split = availableWidth >= FOCUS_SPLIT_BREAKPOINT
  const isMac = window.electron.window.platform === 'darwin'
  const hasRendererCaptionControls = !isMac
  const boundedWidth =
    availableWidth > 0 ? clampFocusListWidth(listWidth, availableWidth) : listWidth

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const update = (): void => setAvailableWidth(root.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (availableWidth > 0 && boundedWidth !== listWidth) onListWidthChange(boundedWidth)
  }, [availableWidth, boundedWidth, listWidth, onListWidthChange])

  useEffect(() => {
    onSplitChange?.(split)
  }, [onSplitChange, split])

  useEffect(() => {
    const wasOpen = previousDetailOpenRef.current
    previousDetailOpenRef.current = detailOpen
    if (split || wasOpen === detailOpen) return

    const frame = requestAnimationFrame(() => {
      if (detailOpen) {
        detailRef.current?.focus()
        return
      }
      const activeCard = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
      activeCard
        ?.querySelector<HTMLElement>('[data-slot="item-card-primary-action"], button')
        ?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [detailOpen, split])

  return (
    <div
      ref={rootRef}
      className={cn('relative flex min-h-0 min-w-0 flex-1 overflow-hidden', className)}
    >
      {split || !detailOpen ? (
        <aside
          ref={listRef}
          data-zen-hidden={expanded}
          className={cn(
            'focus-rail-surface focus-zen-rail relative flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden',
            hasRendererCaptionControls &&
              !split &&
              !detailOpen &&
              '[&_[data-focus-list-header]]:pr-[8.875rem]'
          )}
          style={{ width: split ? (expanded ? 0 : boundedWidth) : '100%' }}
          aria-label="Item list"
          aria-hidden={expanded || undefined}
          inert={expanded || undefined}
        >
          {list}
          {hasRendererCaptionControls && !split && !detailOpen ? (
            <div className="absolute top-0 right-0 z-40 h-10">
              <WindowControls onClose={onWindowClose} />
            </div>
          ) : null}
        </aside>
      ) : null}
      {split ? (
        <div
          data-zen-hidden={expanded}
          role="separator"
          aria-label="Resize item list"
          aria-orientation="vertical"
          aria-valuemin={MIN_FOCUS_LIST_WIDTH}
          aria-valuemax={Math.min(MAX_FOCUS_LIST_WIDTH, Math.floor(availableWidth * 0.45))}
          aria-valuenow={Math.round(boundedWidth)}
          tabIndex={expanded ? -1 : 0}
          className="focus-zen-divider group relative z-10 w-0 shrink-0 cursor-col-resize outline-none before:absolute before:inset-y-0 before:left-1/2 before:w-3 before:-translate-x-1/2 after:pointer-events-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-ring after:opacity-0 after:transition-opacity hover:after:opacity-30 focus-visible:after:opacity-100 motion-reduce:after:transition-none"
          onPointerDown={(event) => {
            dragStartRef.current = { pointerX: event.clientX, width: boundedWidth }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            const start = dragStartRef.current
            if (!start || !event.currentTarget.hasPointerCapture(event.pointerId)) return
            onListWidthChange(
              clampFocusListWidth(start.width + event.clientX - start.pointerX, availableWidth)
            )
          }}
          onPointerUp={(event) => {
            dragStartRef.current = null
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
          }}
          onPointerCancel={() => {
            dragStartRef.current = null
          }}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            onListWidthChange(
              clampFocusListWidth(
                boundedWidth + (event.key === 'ArrowLeft' ? -16 : 16),
                availableWidth
              )
            )
          }}
        />
      ) : null}
      {detailOpen && !split && !expanded ? (
        <div className="absolute top-0 left-1 z-50 flex h-10 items-center">
          <ShellSidebarTrigger />
        </div>
      ) : null}
      {split || detailOpen ? (
        <section
          ref={detailRef}
          data-focus-single-pane={!split}
          data-focus-expanded={expanded}
          className="focus-detail-surface group/focus-detail relative flex min-h-0 min-w-0 flex-1 flex-col"
          aria-label="Focused item"
          tabIndex={-1}
        >
          <div
            className="pointer-events-none absolute top-0 right-0 left-10 z-30 h-10 [-webkit-app-region:drag]"
            aria-hidden="true"
          />
          {hasRendererCaptionControls ? (
            <div
              data-focus-caption-controls
              className="pointer-events-auto absolute top-0 right-0 z-50 h-10 [-webkit-app-region:no-drag]"
            >
              <WindowControls onClose={onWindowClose} />
            </div>
          ) : null}
          {detail}
        </section>
      ) : null}
    </div>
  )
}
