import { IconCheck, IconInbox } from '@tabler/icons-react'

import { ContextMenuItem } from '@/components/ui/context-menu'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { CollectionIcon } from '@/features/collections/collection-icons'
import { flattenFolderTree } from '@/features/collections/folder-tree'
import type {
  ActiveItemLocation,
  CollectionDto,
  ItemLocation
} from '../../../../shared/library-contract'

function isCurrentDestination(
  locations: readonly ItemLocation[],
  destination: ActiveItemLocation
): boolean {
  if (locations.length === 0) return false
  return locations.every((location) => {
    if (destination.type === 'inbox') return location.type === 'inbox'
    return location.type === 'collection' && location.collectionId === destination.collectionId
  })
}

function FolderIndent({ depth }: { depth: number }): React.JSX.Element | null {
  return depth > 0 ? (
    <span className="shrink-0" style={{ width: depth * 12 }} aria-hidden="true" />
  ) : null
}

interface FolderDestinationItemsProps {
  collections: CollectionDto[]
  currentLocations: readonly ItemLocation[]
  onSelect: (destination: ActiveItemLocation) => void
}

export function FolderDropdownDestinationItems({
  collections,
  currentLocations,
  onSelect
}: FolderDestinationItemsProps): React.JSX.Element {
  const inbox: ActiveItemLocation = { type: 'inbox' }
  const inboxCurrent = isCurrentDestination(currentLocations, inbox)
  return (
    <>
      <DropdownMenuItem disabled={inboxCurrent} onClick={() => onSelect(inbox)}>
        <IconInbox aria-hidden="true" />
        Inbox
        {inboxCurrent ? <IconCheck className="ml-auto" aria-hidden="true" /> : null}
      </DropdownMenuItem>
      {flattenFolderTree(collections).map(({ folder, depth }) => {
        const destination: ActiveItemLocation = {
          type: 'collection',
          collectionId: folder.id
        }
        const current = isCurrentDestination(currentLocations, destination)
        return (
          <DropdownMenuItem
            key={folder.id}
            disabled={current}
            onClick={() => onSelect(destination)}
          >
            <FolderIndent depth={depth} />
            <CollectionIcon icon={folder.icon} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{folder.name}</span>
            {current ? <IconCheck className="ml-auto" aria-hidden="true" /> : null}
          </DropdownMenuItem>
        )
      })}
    </>
  )
}

export function FolderContextDestinationItems({
  collections,
  currentLocations,
  onSelect
}: FolderDestinationItemsProps): React.JSX.Element {
  const inbox: ActiveItemLocation = { type: 'inbox' }
  const inboxCurrent = isCurrentDestination(currentLocations, inbox)
  return (
    <>
      <ContextMenuItem disabled={inboxCurrent} onClick={() => onSelect(inbox)}>
        <IconInbox aria-hidden="true" />
        Inbox
        {inboxCurrent ? <IconCheck className="ml-auto" aria-hidden="true" /> : null}
      </ContextMenuItem>
      {flattenFolderTree(collections).map(({ folder, depth }) => {
        const destination: ActiveItemLocation = {
          type: 'collection',
          collectionId: folder.id
        }
        const current = isCurrentDestination(currentLocations, destination)
        return (
          <ContextMenuItem key={folder.id} disabled={current} onClick={() => onSelect(destination)}>
            <FolderIndent depth={depth} />
            <CollectionIcon icon={folder.icon} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{folder.name}</span>
            {current ? <IconCheck className="ml-auto" aria-hidden="true" /> : null}
          </ContextMenuItem>
        )
      })}
    </>
  )
}
