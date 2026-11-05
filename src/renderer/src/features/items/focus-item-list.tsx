import { memo, startTransition, useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FocusRailItem } from '@/features/items/focus-rail-item'
import {
  resolveFocusNavigationItemId,
  type FocusRailDensity
} from '@/features/items/focus-view-state'
import { VirtualCardList, type VirtualCardListHandle } from '@/features/library/virtual-card-list'
import type { LibraryItemDto } from '../../../../shared/library-contract'

const PLAIN_ACTIVATION = { shiftKey: false, ctrlKey: false, metaKey: false } as const

export const FocusItemList = memo(function FocusItemList({
  items,
  density,
  activeItemId,
  selectedIds,
  draggedIds,
  composer,
  searchActive,
  searchQuery,
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
  searchActive: boolean
  searchQuery: string
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
  const itemIds = useMemo(() => items.map((item) => item.id), [items])
  const viewportRef = useRef<HTMLElement | null>(null)
  const revealedItemRef = useRef<string | null>(null)
  const listRef = useRef<VirtualCardListHandle>(null)
  const returnScrollTopRef = useRef(0)
  const previousSearchActiveRef = useRef(searchActive)

  const activation = useRef(onActivate)
  useLayoutEffect(() => {
    activation.current = onActivate
  }, [onActivate])
  const activatePreview = useCallback(
    (id: string, event: React.MouseEvent<HTMLButtonElement>) => activation.current(id, event),
    []
  )
  const openPreview = useCallback((id: string) => activation.current(id, PLAIN_ACTIVATION), [])

  const navigate = useCallback(
    (itemId: string, key: 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'): void => {
      const nextId = resolveFocusNavigationItemId(itemIds, itemId, key)
      revealedItemRef.current = nextId
      listRef.current?.reveal(nextId, true)
      startTransition(() => onActivate(nextId, PLAIN_ACTIVATION))
    },
    [itemIds, onActivate]
  )

  useLayoutEffect(() => {
    if (!activeItemId) {
      revealedItemRef.current = null
      return
    }
    if (revealedItemRef.current === activeItemId) return
    revealedItemRef.current = activeItemId
    listRef.current?.reveal(activeItemId)
  }, [activeItemId, items])

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
      ) : (
        <div
          className={density === 'index' ? 'min-h-full' : 'min-h-full py-2 pr-3 pl-2'}
          role="group"
          aria-label="Items"
        >
          <VirtualCardList
            ref={listRef}
            items={items}
            layout={density === 'index' ? 'list' : 'masonry'}
            gap={density === 'index' ? 0 : 8}
            estimatedHeight={density === 'index' ? 96 : 260}
            leading={
              density === 'index' ? (
                composer
              ) : composer ? (
                <div className="rounded-xl p-1">{composer}</div>
              ) : null
            }
            leadingVisible={Boolean(composer)}
            renderItem={(item) => (
              <FocusRailItem
                item={item}
                density={density}
                active={item.id === activeItemId}
                selected={selectedIds.has(item.id)}
                dragging={draggedIds.has(item.id)}
                searchQuery={searchQuery}
                onActivateItem={activatePreview}
                onOpenItem={openPreview}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onNavigate={navigate}
                renderActions={renderActions}
                wrapRow={wrapRow}
              />
            )}
          />
        </div>
      )}
    </ScrollArea>
  )
})
