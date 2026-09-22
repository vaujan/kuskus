import { startTransition, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FocusIndexRow } from '@/features/items/focus-index-row'
import {
  resolveFocusNavigationItemId,
  type FocusRailDensity
} from '@/features/items/focus-view-state'
import { SavedItemCard } from '@/features/items/saved-item-card'
import { OrderedMasonry } from '@/features/library/ordered-masonry'
import { cn } from '@/lib/utils'
import type { LibraryItemDto } from '../../../../shared/library-contract'

const PLAIN_ACTIVATION = { shiftKey: false, ctrlKey: false, metaKey: false } as const
const FOCUS_PAGE_SIZE = 50

export function FocusItemList({
  items,
  density,
  activeItemId,
  selectedIds,
  draggedIds,
  composer,
  pageKey,
  searchActive,
  emptyMessage,
  emptyDescription,
  emptyAction,
  onActivate,
  onDragStart,
  onDragEnd,
  renderActions,
  wrapRow
}: {
  items: readonly LibraryItemDto[]
  density: FocusRailDensity
  activeItemId: string | null
  selectedIds: ReadonlySet<string>
  draggedIds: ReadonlySet<string>
  composer: React.ReactNode
  pageKey: string
  searchActive: boolean
  emptyMessage: string | null
  emptyDescription: string | null
  emptyAction: React.ReactNode
  onActivate: (
    itemId: string,
    event: Pick<React.MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>
  ) => void
  onDragStart: (itemId: string, event: React.DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  renderActions: (item: LibraryItemDto) => React.ReactNode
  wrapRow: (item: LibraryItemDto, row: React.ReactElement) => React.ReactNode
}): React.JSX.Element {
  const itemIds = items.map((item) => item.id)
  const viewportRef = useRef<HTMLElement | null>(null)
  const returnScrollTopRef = useRef(0)
  const previousSearchActiveRef = useRef(searchActive)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [page, setPage] = useState({ key: pageKey, limit: FOCUS_PAGE_SIZE })
  const pageLimit = page.key === pageKey ? page.limit : FOCUS_PAGE_SIZE
  const activeItemIndex = activeItemId ? items.findIndex((item) => item.id === activeItemId) : -1
  const renderLimit = Math.max(pageLimit, activeItemIndex + 1)
  const mountedItems = items.slice(0, renderLimit)

  useEffect(() => {
    if (renderLimit >= items.length) return
    const target = sentinelRef.current
    if (!target) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        startTransition(() =>
          setPage((current) => ({
            key: pageKey,
            limit: (current.key === pageKey ? current.limit : FOCUS_PAGE_SIZE) + FOCUS_PAGE_SIZE
          }))
        )
      },
      { rootMargin: '600px 0px' }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [items.length, pageKey, renderLimit])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !activeItemId) return
    const row = viewport.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(activeItemId)}"]`)
    if (!row) return
    row.scrollIntoView({ behavior: 'auto', block: 'nearest' })
  }, [activeItemId, renderLimit])

  useLayoutEffect(() => {
    if (!searchActive && previousSearchActiveRef.current && viewportRef.current) {
      viewportRef.current.scrollTop = returnScrollTopRef.current
    }
    previousSearchActiveRef.current = searchActive
  }, [searchActive])

  return (
    <ScrollArea
      ref={(root) => {
        viewportRef.current =
          root?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? null
      }}
      onScrollCapture={(event) => {
        if (!previousSearchActiveRef.current && event.target instanceof HTMLElement) {
          returnScrollTopRef.current = event.target.scrollTop
        }
      }}
      className="library-scroll-container min-h-0 min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]]:focus-visible:ring-0 [&_[data-slot=scroll-area-viewport]]:focus-visible:outline-none"
    >
      {emptyMessage ? (
        <Empty className="min-h-56 px-6 py-10" aria-live="polite">
          <EmptyHeader>
            <EmptyTitle className="text-base">{emptyMessage}</EmptyTitle>
            {emptyDescription ? <EmptyDescription>{emptyDescription}</EmptyDescription> : null}
          </EmptyHeader>
          {emptyAction ? <EmptyContent className="gap-2">{emptyAction}</EmptyContent> : null}
        </Empty>
      ) : density === 'index' ? (
        <div className="min-h-full" role="group" aria-label="Items">
          {composer}

          {mountedItems.map((item) => {
            const active = item.id === activeItemId
            const selected = selectedIds.has(item.id)
            const row = (
              <FocusIndexRow
                key={item.id}
                item={item}
                active={active}
                selected={selected}
                dragging={draggedIds.has(item.id)}
                onActivate={(event) => onActivate(item.id, event)}
                onDragStart={(event) => onDragStart(item.id, event)}
                onDragEnd={onDragEnd}
                onNavigate={(key) => {
                  const nextId = resolveFocusNavigationItemId(itemIds, item.id, key)
                  const next = document.querySelector<HTMLElement>(
                    `[data-item-id="${CSS.escape(nextId)}"] [data-slot="item-card-primary-action"]`
                  )
                  next?.focus()
                  onActivate(nextId, PLAIN_ACTIVATION)
                }}
                actions={renderActions(item)}
              />
            )
            return wrapRow(item, row)
          })}
          {mountedItems.length < items.length ? (
            <div ref={sentinelRef} className="h-px" aria-hidden="true" />
          ) : null}
        </div>
      ) : (
        <div className="min-h-full py-2 pr-3 pl-2" role="group" aria-label="Items">
          <OrderedMasonry gap={8}>
            {composer ? <div className="rounded-xl p-1">{composer}</div> : null}

            {mountedItems.map((item) => {
              const active = item.id === activeItemId
              const selected = selectedIds.has(item.id)
              const row = (
                <div
                  key={item.id}
                  className={cn(
                    'group/focus-card group/saved-item relative min-w-0 rounded-xl p-1 outline-none',
                    'transition-opacity [transition-duration:var(--motion-duration-ui)]',
                    'data-[active=true]:bg-primary/10 data-[selected=true]:bg-primary/10 data-[dragging=true]:opacity-40'
                  )}
                  data-item-id={item.id}
                  data-active={active || undefined}
                  data-selected={selected || undefined}
                  data-dragging={draggedIds.has(item.id) || undefined}
                  aria-current={active ? 'true' : undefined}
                  draggable
                  onDragStart={(event) => onDragStart(item.id, event)}
                  onDragEnd={onDragEnd}
                  onKeyDownCapture={(event) => {
                    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
                    event.preventDefault()
                    const nextId = resolveFocusNavigationItemId(
                      itemIds,
                      item.id,
                      event.key as 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'
                    )
                    const next = event.currentTarget.parentElement?.querySelector<HTMLElement>(
                      `[data-item-id="${CSS.escape(nextId)}"] [data-slot="item-card-primary-action"]`
                    )
                    next?.focus()
                    onActivate(nextId, PLAIN_ACTIVATION)
                  }}
                >
                  <SavedItemCard
                    item={item}
                    view="visual"
                    compact
                    selected={selected}
                    showSelectionVisual={false}
                    opensDialog={false}
                    onActivate={(event) => onActivate(item.id, event)}
                    onOpen={() => onActivate(item.id, PLAIN_ACTIVATION)}
                  />
                  <div
                    data-drag-preview-hidden
                    className="absolute top-3 right-3 z-30 group-data-[active=true]/focus-card:[&_[data-slot=button]]:opacity-100"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {renderActions(item)}
                  </div>
                </div>
              )
              return wrapRow(item, row)
            })}
          </OrderedMasonry>
          {mountedItems.length < items.length ? (
            <div ref={sentinelRef} className="h-px" aria-hidden="true" />
          ) : null}
        </div>
      )}
    </ScrollArea>
  )
}
