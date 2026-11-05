import { memo } from 'react'
import { ImageItemCard } from '@/features/items/image-item-card'
import { FileItemCard } from '@/features/items/file-item-card'
import type { LibraryView } from '@/features/items/item-view'
import { NoteItemCard } from '@/features/items/note-item-card'
import { UrlItemCard } from '@/features/items/url-item-card'
import type { LibraryItemDto } from '../../../../shared/library-contract'

export const SavedItemCard = memo(function SavedItemCard({
  item,
  onActivate,
  onOpen,
  selected,
  opensDialog = true,
  view = 'visual',
  compact = false,
  showSelectionVisual = true
}: {
  item: LibraryItemDto
  onActivate: (event: React.MouseEvent<HTMLButtonElement>) => void
  onOpen: () => void
  selected: boolean
  opensDialog?: boolean
  view?: LibraryView
  compact?: boolean
  showSelectionVisual?: boolean
}): React.JSX.Element {
  return item.type === 'note' ? (
    <NoteItemCard
      item={item}
      view={view}
      compact={compact}
      selected={selected}
      showSelectionVisual={showSelectionVisual}
      opensDialog={opensDialog}
      onActivate={onActivate}
      onOpen={onOpen}
    />
  ) : item.type === 'image' ? (
    <ImageItemCard
      item={item}
      view={view}
      compact={compact}
      selected={selected}
      showSelectionVisual={showSelectionVisual}
      opensDialog={opensDialog}
      onActivate={onActivate}
      onOpen={onOpen}
    />
  ) : item.type === 'url' ? (
    <UrlItemCard
      item={item}
      view={view}
      compact={compact}
      selected={selected}
      showSelectionVisual={showSelectionVisual}
      opensDialog={opensDialog}
      onActivate={onActivate}
      onOpen={onOpen}
    />
  ) : (
    <FileItemCard
      item={item}
      view={view}
      compact={compact}
      selected={selected}
      showSelectionVisual={showSelectionVisual}
      onActivate={onActivate}
      onOpen={onOpen}
    />
  )
})

export const LibraryCardPreview = memo(function LibraryCardPreview({
  item,
  view,
  selected,
  showSelectionVisual,
  compact = false,
  opensDialog = true,
  onActivateItem,
  onOpenItem
}: {
  item: LibraryItemDto
  view: LibraryView
  selected: boolean
  showSelectionVisual: boolean
  compact?: boolean
  opensDialog?: boolean
  onActivateItem: (id: string, event: React.MouseEvent<HTMLButtonElement>) => void
  onOpenItem: (id: string) => void
}): React.JSX.Element {
  return (
    <SavedItemCard
      item={item}
      view={view}
      selected={selected}
      showSelectionVisual={showSelectionVisual}
      compact={compact}
      opensDialog={opensDialog}
      onActivate={(event) => onActivateItem(item.id, event)}
      onOpen={() => onOpenItem(item.id)}
    />
  )
})
