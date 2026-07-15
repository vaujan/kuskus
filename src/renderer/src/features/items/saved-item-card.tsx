import { ImageItemCard } from '@/features/items/image-item-card'
import { NoteItemCard } from '@/features/items/note-item-card'
import type { LibraryItemDto } from '../../../../shared/library-contract'

export function SavedItemCard({
  item,
  onError
}: {
  item: LibraryItemDto
  onError: (error: string) => void
}): React.JSX.Element {
  return item.type === 'note' ? (
    <NoteItemCard item={item} onError={onError} />
  ) : (
    <ImageItemCard item={item} onError={onError} />
  )
}
