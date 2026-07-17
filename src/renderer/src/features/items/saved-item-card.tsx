import {
  IconFileText as FileText,
  IconPhoto as FileImage,
  IconWorld as Globe2
} from '@tabler/icons-react'

import { CardContent } from '@/components/ui/card'
import { ImageItemCard } from '@/features/items/image-item-card'
import { ItemCard, ItemCardPrimaryAction } from '@/features/items/item-card'
import type { LibraryView } from '@/features/items/item-view'
import { NoteItemCard } from '@/features/items/note-item-card'
import { UrlItemCard } from '@/features/items/url-item-card'
import type { LibraryItemDto } from '../../../../shared/library-contract'

const CREATED_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
})

function SavedItemListRow({
  item,
  onOpen
}: {
  item: LibraryItemDto
  onOpen: () => void
}): React.JSX.Element {
  const Icon = item.type === 'note' ? FileText : item.type === 'image' ? FileImage : Globe2
  const kind = item.type === 'note' ? 'Note' : item.type === 'image' ? 'Image' : 'Link'
  const context =
    item.type === 'url'
      ? item.domain
      : item.type === 'image'
        ? (item.sourceFilename ?? `${item.width} × ${item.height}`)
        : item.missingContent
          ? 'Content missing'
          : 'Markdown note'

  return (
    <ItemCard presentation="list" className="h-16 rounded-xl">
      <ItemCardPrimaryAction
        aria-label={`Open ${kind.toLocaleLowerCase()} ${item.title}`}
        onClick={onOpen}
      />
      <CardContent className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{item.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{context}</span>
        </span>
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{kind}</span>
        <time
          className="hidden w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground md:block"
          dateTime={item.createdAt}
        >
          {CREATED_DATE_FORMATTER.format(new Date(item.createdAt))}
        </time>
      </CardContent>
    </ItemCard>
  )
}

export function SavedItemCard({
  item,
  onError,
  onOpen,
  view = 'visual'
}: {
  item: LibraryItemDto
  onError: (error: string) => void
  onOpen: () => void
  view?: LibraryView
}): React.JSX.Element {
  if (view === 'list') return <SavedItemListRow item={item} onOpen={onOpen} />

  return item.type === 'note' ? (
    <NoteItemCard item={item} view={view} onError={onError} onOpen={onOpen} />
  ) : item.type === 'image' ? (
    <ImageItemCard item={item} view={view} onOpen={onOpen} />
  ) : (
    <UrlItemCard item={item} view={view} onOpen={onOpen} />
  )
}
