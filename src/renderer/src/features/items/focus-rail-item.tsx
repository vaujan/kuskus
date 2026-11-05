import { memo } from 'react'
import { FocusIndexRow } from './focus-index-row'
import { LibraryCardPreview } from './saved-item-card'
import type { FocusRailDensity } from './focus-view-state'
import { cn } from '@/lib/utils'
import type { LibraryItemDto } from '../../../../shared/library-contract'

export const FocusRailItem = memo(function FocusRailItem({
  item,
  density,
  active,
  selected,
  dragging,
  searchQuery,
  onActivateItem,
  onOpenItem,
  onDragStart,
  onDragEnd,
  onNavigate,
  renderActions,
  wrapRow
}: {
  item: LibraryItemDto
  density: FocusRailDensity
  active: boolean
  selected: boolean
  dragging: boolean
  searchQuery: string
  onActivateItem: (id: string, event: React.MouseEvent<HTMLButtonElement>) => void
  onOpenItem: (id: string) => void
  onDragStart: (id: string, event: React.DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onNavigate: (id: string, key: 'ArrowUp' | 'ArrowDown' | 'Home' | 'End') => void
  renderActions: (item: LibraryItemDto) => React.ReactNode
  wrapRow: (item: LibraryItemDto, row: React.ReactElement) => React.ReactNode
}): React.JSX.Element {
  const row =
    density === 'index' ? (
      <FocusIndexRow
        item={item}
        searchQuery={searchQuery}
        active={active}
        selected={selected}
        dragging={dragging}
        onActivate={(event) => onActivateItem(item.id, event)}
        onDragStart={(event) => onDragStart(item.id, event)}
        onDragEnd={onDragEnd}
        onNavigate={(key) => onNavigate(item.id, key)}
        actions={renderActions(item)}
      />
    ) : (
      <div
        className={cn(
          'group/focus-card group/saved-item relative min-w-0 rounded-xl p-1 outline-none',
          'transition-opacity [transition-duration:var(--motion-duration-ui)]',
          'data-[active=true]:bg-primary/10 data-[selected=true]:bg-primary/10 data-[dragging=true]:opacity-40'
        )}
        data-item-id={item.id}
        data-active={active || undefined}
        data-selected={selected || undefined}
        data-dragging={dragging || undefined}
        aria-current={active ? 'true' : undefined}
        draggable
        onDragStart={(event) => onDragStart(item.id, event)}
        onDragEnd={onDragEnd}
        onKeyDownCapture={(event) => {
          if (
            event.target instanceof Element &&
            !event.target.matches('[data-slot="item-card-primary-action"]')
          )
            return
          if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
          if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          onNavigate(item.id, event.key as 'ArrowUp' | 'ArrowDown' | 'Home' | 'End')
        }}
      >
        <LibraryCardPreview
          item={item}
          view="visual"
          compact
          selected={selected}
          showSelectionVisual={false}
          opensDialog={false}
          onActivateItem={onActivateItem}
          onOpenItem={onOpenItem}
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
  return <>{wrapRow(item, row)}</>
})
