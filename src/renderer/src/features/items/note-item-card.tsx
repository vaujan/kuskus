import { IconFileAlert as FileWarning } from '@tabler/icons-react'

import { ItemCard, ItemCardPrimaryAction, ItemCardSurface } from '@/features/items/item-card'
import type { LibraryView } from '@/features/items/item-view'
import { MarkdownPreview } from '@/features/items/markdown-preview'
import type { NoteItemDto } from '../../../../shared/library-contract'

export function NoteItemCard({
  item,
  onError,
  onOpen,
  view
}: {
  item: NoteItemDto
  onError: (error: string) => void
  onOpen: () => void
  view: Exclude<LibraryView, 'table'>
}): React.JSX.Element {
  return (
    <ItemCard>
      <ItemCardPrimaryAction aria-label={`Open note ${item.title}`} focusSurface onClick={onOpen} />
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
