import { ImageItemCard } from '@/features/items/image-item-card'
import type { LibraryView } from '@/features/items/item-view'
import { NoteItemCard } from '@/features/items/note-item-card'
import { UrlItemCard } from '@/features/items/url-item-card'
import type { LibraryItemDto } from '../../../../shared/library-contract'

export function SavedItemCard({
  item,
  onError,
  onOpen,
  view = 'visual'
}: {
  item: LibraryItemDto
  onError: (error: string) => void
  onOpen: () => void
  view?: Exclude<LibraryView, 'table'>
}): React.JSX.Element {
  return item.type === 'note' ? (
    <NoteItemCard item={item} view={view} onError={onError} onOpen={onOpen} />
  ) : item.type === 'image' ? (
    <ImageItemCard item={item} view={view} onOpen={onOpen} />
  ) : (
    <UrlItemCard item={item} view={view} onOpen={onOpen} />
  )
}
