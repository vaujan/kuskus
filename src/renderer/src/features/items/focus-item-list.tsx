import { IconPlus, IconTrash } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
  composerOpen,
  composerBusy,
  composerHasDraft,
  onActivate,
  onActivateComposer,
  onDiscardComposer,
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
  composerOpen: boolean
  composerBusy: boolean
  composerHasDraft: boolean
  onActivate: (
    itemId: string,
    event: Pick<React.MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>
  ) => void
  onActivateComposer: () => void
  onDiscardComposer: () => void
  onDragStart: (itemId: string, event: React.DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  renderActions: (item: LibraryItemDto) => React.ReactNode
  wrapRow: (item: LibraryItemDto, row: React.ReactElement) => React.ReactNode
}): React.JSX.Element {
  const itemIds = items.map((item) => item.id)

  return (
    <ScrollArea
      className="min-h-0 min-w-0 flex-1"
      viewportClassName="dark:library-scroll-viewport focus-visible:ring-0 focus-visible:outline-none"
    >
      {density === 'index' ? (
        <div className="min-h-full" role="group" aria-label="Items">
          {composerOpen ? (
            <div
              className="group/composer relative h-[52px] bg-primary/12 before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary"
              data-active="true"
            >
              <button
                type="button"
                className="flex size-full items-center gap-2 py-1.5 pr-12 pl-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/70"
                aria-current="true"
                aria-busy={composerBusy}
                onClick={onActivateComposer}
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <IconPlus className="size-3.5" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">New item</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {composerBusy ? 'Preparing capture...' : 'Draft in progress'}
                  </span>
                </span>
              </button>
              {composerHasDraft ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        className="absolute top-1.5 right-2 z-30 size-10 opacity-0 transition-[opacity] [transition-duration:var(--motion-duration-ui)] group-hover/composer:opacity-100 group-focus-within/composer:opacity-100"
                        size="icon"
                        variant="ghost"
                        disabled={composerBusy}
                        aria-label="Discard New item draft"
                        onClick={onDiscardComposer}
                      />
                    }
                  >
                    <IconTrash aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>Discard draft</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          ) : null}

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
        <div className="min-h-full p-3" role="group" aria-label="Items">
          <OrderedMasonry>
            {composerOpen ? (
              <div className="group/composer relative min-w-0" data-active="true">
                <button
                  type="button"
                  className="flex min-h-36 w-full flex-col items-start justify-between gap-6 rounded-sm bg-card p-4 text-left shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_2px_8px_rgba(0,0,0,0.04)] outline-none ring-1 ring-primary/45 transition-[background-color,box-shadow,scale] [transition-duration:var(--motion-duration-ui)] hover:bg-card/95 active:scale-[0.96] focus-visible:ring-3 focus-visible:ring-ring/60 motion-reduce:active:scale-100 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                  aria-current="true"
                  aria-busy={composerBusy}
                  onClick={onActivateComposer}
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <IconPlus className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-medium">New item</span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                      {composerBusy ? 'Preparing capture...' : 'Draft in progress'}
                    </span>
                  </span>
                </button>
                {composerHasDraft ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          className="absolute top-2 right-2 size-10 opacity-0 transition-opacity [transition-duration:var(--motion-duration-ui)] group-hover/composer:opacity-100 group-focus-within/composer:opacity-100"
                          size="icon"
                          variant="ghost"
                          disabled={composerBusy}
                          aria-label="Discard New item draft"
                          onClick={onDiscardComposer}
                        />
                      }
                    >
                      <IconTrash aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>Discard draft</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            ) : null}

            {items.map((item) => {
              const active = item.id === activeItemId
              const selected = selectedIds.has(item.id)
              const row = (
                <div
                  key={item.id}
                  className={cn(
                    'group/focus-card group/saved-item relative min-w-0 rounded-sm p-1.5 outline-none',
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
                    className="absolute top-3.5 right-3.5 z-30 group-data-[active=true]/focus-card:[&_[data-slot=button]]:opacity-100"
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
