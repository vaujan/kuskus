import { useMemo } from 'react'
import { IconFileAlert as FileWarning, IconNote as Note } from '@tabler/icons-react'

import {
  ItemCard,
  ItemCardCaption,
  ItemCardPrimaryAction,
  ItemCardSelectionIndicator,
  ItemCardSurface
} from '@/features/items/item-card'
import type { LibraryView } from '@/features/items/item-view'
import { noteCardSnippet } from '@/features/items/note-card-snippet'
import { useNearViewport } from '@/features/items/use-near-viewport'
import { cn } from '@/lib/utils'
import type { NoteItemDto } from '../../../../shared/library-contract'

export function NoteItemCard({
  item,
  onActivate,
  onOpen,
  selected,
  opensDialog,
  view,
  compact = false,
  showSelectionVisual = true
}: {
  item: NoteItemDto
  onActivate: (event: React.MouseEvent<HTMLButtonElement>) => void
  onOpen: () => void
  selected: boolean
  opensDialog: boolean
  view: LibraryView
  compact?: boolean
  showSelectionVisual?: boolean
}): React.JSX.Element {
  const { nearViewport, observe } = useNearViewport()
  const snippet = useMemo(() => noteCardSnippet(item.body), [item.body])

  return (
    <ItemCard ref={observe} data-selected={selected && showSelectionVisual}>
      <ItemCardPrimaryAction
        aria-label={`Open note ${item.title}`}
        aria-haspopup={opensDialog ? 'dialog' : undefined}
        aria-pressed={selected}
        focusSurface
        onClick={onActivate}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          onOpen()
        }}
      />
      <ItemCardSelectionIndicator />
      <ItemCardSurface
        className={cn(
          view === 'grid' ? 'h-64 p-4' : 'max-h-[24rem] p-4',
          compact && 'max-h-[15rem] p-3.5'
        )}
      >
        {item.missingContent ? (
          <div className="flex size-full min-h-28 flex-col items-center justify-center gap-2 bg-destructive/8 px-5 text-center text-destructive">
            <FileWarning className="size-5" aria-hidden="true" />
            <span className="text-xs font-medium">The note file is missing from the library.</span>
          </div>
        ) : !item.body.trim() ? (
          <div className="flex size-full min-h-28 flex-col items-center justify-center gap-2 px-5 text-center text-muted-foreground">
            <Note className="size-5" stroke={1.5} aria-hidden="true" />
            <span className="max-w-full truncate text-sm font-medium text-foreground">
              {item.title}
            </span>
            <span className="text-xs">Empty note</span>
          </div>
        ) : nearViewport ? (
          <p className="line-clamp-[6] max-h-28 overflow-hidden whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
            {snippet}
          </p>
        ) : (
          <div className="size-full min-h-28" aria-hidden="true" />
        )}
      </ItemCardSurface>
      {!item.missingContent && item.body.trim() ? (
        <ItemCardCaption compact={compact}>
          <p className="min-w-0 flex-1 truncate font-normal text-foreground/80">{item.title}</p>
        </ItemCardCaption>
      ) : null}
    </ItemCard>
  )
}
