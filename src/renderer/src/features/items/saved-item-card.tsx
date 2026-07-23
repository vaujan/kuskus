import { ImageItemCard } from '@/features/items/image-item-card'
import type { LibraryView } from '@/features/items/item-view'
import { NoteItemCard } from '@/features/items/note-item-card'
import { UrlItemCard } from '@/features/items/url-item-card'
import type { LibraryItemDto } from '../../../../shared/library-contract'

export function SavedItemCard({
  item,
  onError,
  onSelect,
  onOpen,
  selected,
  view = 'visual'
}: {
  item: LibraryItemDto
  onError: (error: string) => void
  onSelect: (event: React.MouseEvent<HTMLButtonElement>) => void
  onOpen: () => void
  selected: boolean
  view?: Exclude<LibraryView, 'table'>
}): React.JSX.Element {
  return item.type === 'note' ? (
    <NoteItemCard
      item={item}
      view={view}
      selected={selected}
      onError={onError}
      onSelect={onSelect}
      onOpen={onOpen}
    />
  ) : item.type === 'image' ? (
    <ImageItemCard
      item={item}
      view={view}
      selected={selected}
      onSelect={onSelect}
      onOpen={onOpen}
    />
  ) : (
    <UrlItemCard item={item} view={view} selected={selected} onSelect={onSelect} onOpen={onOpen} />
  )
}
