import { IconFile as File } from '@tabler/icons-react'

import {
  ItemCard,
  ItemCardCaption,
  ItemCardPrimaryAction,
  ItemCardSelectionIndicator,
  ItemCardSurface
} from '@/features/items/item-card'
import type { LibraryView } from '@/features/items/item-view'
import type { FileItemDto } from '../../../../shared/library-contract'

export function FileItemCard({
  item,
  view,
  selected,
  onActivate,
  onOpen,
  compact = false
}: {
  item: FileItemDto
  view: Exclude<LibraryView, 'table' | 'focus'>
  selected: boolean
  onActivate: (event: React.MouseEvent<HTMLButtonElement>) => void
  onOpen: () => void
  compact?: boolean
}): React.JSX.Element {
  const extension = item.contentFilename.split('.').pop()?.toLocaleUpperCase() || 'FILE'
  return (
    <ItemCard data-selected={selected}>
      <ItemCardPrimaryAction
        aria-label={`Open file ${item.title}`}
        aria-haspopup="dialog"
        onClick={onActivate}
        onDoubleClick={onOpen}
      />
      <ItemCardSelectionIndicator />
      <ItemCardSurface
        className={
          view === 'grid'
            ? 'flex h-64 items-center justify-center'
            : 'flex aspect-[4/3] items-center justify-center'
        }
      >
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <File className={compact ? 'size-8' : 'size-10'} aria-hidden="true" />
          <span className="text-xs font-medium tracking-wide">{extension}</span>
        </div>
      </ItemCardSurface>
      <ItemCardCaption compact={compact}>
        <span className="truncate">{item.title}</span>
      </ItemCardCaption>
    </ItemCard>
  )
}
