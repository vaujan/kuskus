import { lazy, Suspense } from 'react'
import { IconFileAlert as FileWarning } from '@tabler/icons-react'

import {
  ItemCard,
  ItemCardPrimaryAction,
  ItemCardSelectionIndicator,
  ItemCardSurface
} from '@/features/items/item-card'
import type { LibraryView } from '@/features/items/item-view'
import { openExternalUrlWithFeedback } from '@/features/items/open-external-url'
import type { NoteItemDto } from '../../../../shared/library-contract'

const MarkdownPreview = lazy(() =>
  import('@/features/items/markdown-preview').then((module) => ({
    default: module.MarkdownPreview
  }))
)

export function NoteItemCard({
  item,
  onActivate,
  onOpen,
  selected,
  opensDialog,
  view
}: {
  item: NoteItemDto
  onActivate: (event: React.MouseEvent<HTMLButtonElement>) => void
  onOpen: () => void
  selected: boolean
  opensDialog: boolean
  view: Exclude<LibraryView, 'table' | 'focus'>
}): React.JSX.Element {
  return (
    <ItemCard data-selected={selected}>
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
      <ItemCardSurface className={view === 'grid' ? 'h-64 p-4' : 'max-h-[24rem] p-4'}>
        {item.missingContent ? (
          <div className="flex size-full min-h-28 flex-col items-center justify-center gap-2 bg-destructive/8 px-5 text-center text-destructive">
            <FileWarning className="size-5" aria-hidden="true" />
            <span className="text-xs font-medium">The note file is missing from the library.</span>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="size-full min-h-28 animate-pulse rounded-lg bg-muted/40" />
            }
          >
            <MarkdownPreview
              value={item.body}
              itemId={item.id}
              attachments={item.attachments}
              onOpenLink={(url) => void openExternalUrlWithFeedback(url)}
            />
          </Suspense>
        )}
      </ItemCardSurface>
    </ItemCard>
  )
}
