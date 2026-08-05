import { IconArchive, IconChevronDown, IconFolder, IconInbox, IconTrash } from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { FolderDropdownDestinationItems } from '@/features/collections/folder-destination-items'
import type {
  ActiveItemLocation,
  CollectionDto,
  LibraryItemDto
} from '../../../../shared/library-contract'

function locationLabel(item: LibraryItemDto, collections: CollectionDto[]): string {
  const location = item.location
  if (location.type === 'inbox') return 'Inbox'
  if (location.type === 'archive') return 'Archive'
  if (location.type === 'trash') return 'Trash'
  return collections.find((collection) => collection.id === location.collectionId)?.name ?? 'Folder'
}

export function ItemLocationMenu({
  item,
  collections,
  onMove
}: {
  item: LibraryItemDto
  collections: CollectionDto[]
  onMove: (destination: ActiveItemLocation) => void
}): React.JSX.Element {
  const label = locationLabel(item, collections)

  if (item.location.type === 'archive' || item.location.type === 'trash') {
    const Icon = item.location.type === 'archive' ? IconArchive : IconTrash
    return (
      <Badge className="max-w-56" variant="secondary">
        <Icon data-icon="inline-start" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </Badge>
    )
  }

  const Icon = item.location.type === 'inbox' ? IconInbox : IconFolder
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className="max-w-56"
            size="sm"
            variant="secondary"
            aria-label={`Move ${item.title} from ${label}`}
          />
        }
      >
        <Icon data-icon="inline-start" aria-hidden="true" />
        <span className="truncate">{label}</span>
        <IconChevronDown data-icon="inline-end" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <FolderDropdownDestinationItems
            collections={collections}
            currentLocations={[item.location]}
            onSelect={onMove}
          />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
