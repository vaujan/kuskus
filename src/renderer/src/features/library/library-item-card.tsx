import { memo } from 'react'
import { ItemContextMenu, ItemActionMenu } from '@/features/items/item-action-menu'
import { LibraryCardPreview } from '@/features/items/saved-item-card'
import { cn } from '@/lib/utils'
import type { CollectionDto, LibraryItemDto } from '../../../../shared/library-contract'
import type { ItemMutations } from './use-item-mutations'

export const LibraryItemCard = memo(function LibraryItemCard({
  item,
  collections,
  getMenuProps,
  dragging,
  selected,
  view,
  onDragStart,
  onDragEnd,
  onActivateItem,
  onOpenItem
}: {
  item: LibraryItemDto
  collections: CollectionDto[]
  getMenuProps: ItemMutations['getItemMenuProps']
  dragging: boolean
  selected: boolean
  view: 'visual' | 'grid'
  onDragStart: (id: string, event: React.DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onActivateItem: (id: string, event: React.MouseEvent<HTMLButtonElement>) => void
  onOpenItem: (id: string) => void
}): React.JSX.Element {
  return (
    <ItemContextMenu item={item} collections={collections} {...getMenuProps(item)} key={item.id}>
      <div
        className="min-w-0 transition-opacity [transition-duration:var(--motion-duration-press)] [transition-timing-function:var(--motion-ease-out)] data-[dragging=true]:opacity-40"
        data-dragging={dragging}
        data-item-id={item.id}
        draggable
        onDragStart={(event) => onDragStart(item.id, event)}
        onDragEnd={onDragEnd}
      >
        <div
          className={cn(
            'group/saved-item relative',
            view === 'visual' &&
              'min-w-0 rounded-xl p-1 transition-[background-color] [transition-duration:var(--motion-duration-ui)] [transition-timing-function:var(--motion-ease-out)] hover:bg-muted/45 data-[selected=true]:bg-primary/10'
          )}
          data-selected={selected || undefined}
        >
          <LibraryCardPreview
            item={item}
            view={view === 'visual' ? 'visual' : 'grid'}
            selected={selected}
            showSelectionVisual={view !== 'visual'}
            onActivateItem={onActivateItem}
            onOpenItem={onOpenItem}
          />
          <div
            data-drag-preview-hidden
            className={cn('absolute z-30', view === 'visual' ? 'top-3 right-3' : 'top-2 right-2')}
            onClick={(event) => event.stopPropagation()}
          >
            <ItemActionMenu
              item={item}
              collections={collections}
              showQuickSourceAction
              {...getMenuProps(item)}
            />
          </div>
        </div>
      </div>
    </ItemContextMenu>
  )
})
