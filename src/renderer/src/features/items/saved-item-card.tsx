import { ImageItemCard } from '@/features/items/image-item-card'
import { NoteItemCard } from '@/features/items/note-item-card'
import { UrlItemCard } from '@/features/items/url-item-card'
import type { LibraryItemDto } from '../../../../shared/library-contract'

export function SavedItemCard({
  item,
  onError,
  onOpen
}: {
  item: LibraryItemDto
  onError: (error: string) => void
  onOpen: () => void
}): React.JSX.Element {
  return item.type === 'note' ? (
    <NoteItemCard item={item} onError={onError} onOpen={onOpen} />
  ) : item.type === 'image' ? (
    <ImageItemCard item={item} onOpen={onOpen} />
  ) : (
    <UrlItemCard item={item} onOpen={onOpen} />
  )
}
