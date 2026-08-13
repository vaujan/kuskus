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

export function FocusItemList({
  items,
  density,
  activeItemId,
  selectedIds,
  draggedIds,
  composer,
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

  return (
    <ScrollArea className="library-scroll-container min-h-0 min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]]:focus-visible:ring-0 [&_[data-slot=scroll-area-viewport]]:focus-visible:outline-none">
      {density === 'index' ? (
        <div className="min-h-full pt-2" role="group" aria-label="Items">
          {composer ? <div className="p-2">{composer}</div> : null}

          {items.map((item) => {
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
        </div>
      ) : (
        <div className="min-h-full py-2 pr-3 pl-2" role="group" aria-label="Items">
          <OrderedMasonry gap={8}>
            {composer}

            {items.map((item) => {
              const active = item.id === activeItemId
              const selected = selectedIds.has(item.id)
              const row = (
                <div
                  key={item.id}
                  className={cn(
                    'group/focus-card group/saved-item relative min-w-0 rounded-sm p-1 outline-none',
                    'transition-[background-color,opacity] [transition-duration:var(--motion-duration-ui)]',
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
        </div>
      )}
    </ScrollArea>
  )
}
