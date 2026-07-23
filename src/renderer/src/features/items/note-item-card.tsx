import { IconFileAlert as FileWarning } from '@tabler/icons-react'

import { ItemCard, ItemCardPrimaryAction, ItemCardSurface } from '@/features/items/item-card'
import type { LibraryView } from '@/features/items/item-view'
import { MarkdownPreview } from '@/features/items/markdown-preview'
import type { NoteItemDto } from '../../../../shared/library-contract'

export function NoteItemCard({
  item,
  onError,
  onSelect,
  onOpen,
  selected,
  view
}: {
  item: NoteItemDto
  onError: (error: string) => void
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void
  onOpen: () => void
  selected: boolean
  view: Exclude<LibraryView, 'table'>
}): React.JSX.Element {
  return (
    <ItemCard data-selected={selected}>
      <ItemCardPrimaryAction
        aria-label={`Select note ${item.title}`}
        aria-pressed={selected}
        focusSurface
        onClick={onSelect}
        onDoubleClick={onOpen}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          onOpen()
        }}
      />
      <ItemCardSurface className={view === 'grid' ? 'h-64 p-4' : 'max-h-[24rem] p-4'}>
        {item.missingContent ? (
          <div className="flex size-full min-h-28 flex-col items-center justify-center gap-2 bg-destructive/8 px-5 text-center text-destructive">
            <FileWarning className="size-5" aria-hidden="true" />
            <span className="text-xs font-medium">The note file is missing from the library.</span>
          </div>
        ) : (
          <MarkdownPreview
            value={item.body}
            itemId={item.id}
            attachments={item.attachments}
            onOpenLink={async (url) => {
              const result = await window.kuskus.openExternalUrl(url)
              if (!result.ok) onError(result.error)
            }}
          />
        )}
      </ItemCardSurface>
    </ItemCard>
  )
}
