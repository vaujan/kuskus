import {
  IconArchive,
  IconArchiveOff,
  IconDots,
  IconExternalLink,
  IconFolder,
  IconFolderOpen,
  IconPencil,
  IconRestore,
  IconTrash,
  IconTrashX
} from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type {
  ActiveItemLocation,
  CollectionDto,
  LibraryItemDto
} from '../../../../shared/library-contract'

export interface ItemActionHandlers {
  onOpen: () => void
  onRename: () => void
  onMove: (destination: ActiveItemLocation) => void
  onReveal: () => void
  onArchive: () => void
  onUnarchive: () => void
  onTrash: () => void
  onRestore: () => void
  onDeletePermanently: () => void
  onOpenSource: () => void
}

interface ItemActionMenuProps extends ItemActionHandlers {
  item: LibraryItemDto
  collections: CollectionDto[]
  alwaysVisible?: boolean
}

function DropdownActions({
  item,
  collections,
  onOpen,
  onRename,
  onMove,
  onReveal,
  onArchive,
  onUnarchive,
  onTrash,
  onRestore,
  onDeletePermanently,
  onOpenSource
}: ItemActionMenuProps): React.JSX.Element {
  if (item.location.type === 'trash') {
    return (
      <>
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
          <DropdownMenuItem onClick={onReveal}>
            <IconFolderOpen aria-hidden="true" />
            Show in Explorer
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRestore}>
            <IconRestore aria-hidden="true" />
            Restore
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={onDeletePermanently}>
            <IconTrashX aria-hidden="true" />
            Delete permanently
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </>
    )
  }

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
        {item.type === 'url' ? (
          <DropdownMenuItem onClick={onOpenSource}>
            <IconExternalLink aria-hidden="true" />
            Open source link
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={onRename}>
          <IconPencil aria-hidden="true" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconFolder aria-hidden="true" />
            Move to
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onMove({ type: 'inbox' })}>Inbox</DropdownMenuItem>
              {collections.map((collection) => (
                <DropdownMenuItem
                  key={collection.id}
                  onClick={() => onMove({ type: 'collection', collectionId: collection.id })}
                >
                  {collection.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={onReveal}>
          <IconFolderOpen aria-hidden="true" />
          Show in Explorer
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        {item.location.type === 'archive' ? (
          <DropdownMenuItem onClick={onUnarchive}>
            <IconArchiveOff aria-hidden="true" />
            Unarchive
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onArchive}>
            <IconArchive aria-hidden="true" />
            Archive
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={onTrash}>
          <IconTrash aria-hidden="true" />
          Move to Trash
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  )
}

function ContextActions(props: ItemActionMenuProps): React.JSX.Element {
  const { item, collections } = props
  if (item.location.type === 'trash') {
    return (
      <>
        <ContextMenuGroup>
          <ContextMenuItem onClick={props.onOpen}>Open</ContextMenuItem>
          <ContextMenuItem onClick={props.onReveal}>Show in Explorer</ContextMenuItem>
          <ContextMenuItem onClick={props.onRestore}>Restore</ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem variant="destructive" onClick={props.onDeletePermanently}>
            Delete permanently
          </ContextMenuItem>
        </ContextMenuGroup>
      </>
    )
  }
  return (
    <>
      <ContextMenuGroup>
        <ContextMenuItem onClick={props.onOpen}>Open</ContextMenuItem>
        {item.type === 'url' ? (
          <ContextMenuItem onClick={props.onOpenSource}>Open source link</ContextMenuItem>
        ) : null}
        <ContextMenuItem onClick={props.onRename}>Rename</ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Move to</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuGroup>
              <ContextMenuItem onClick={() => props.onMove({ type: 'inbox' })}>
                Inbox
              </ContextMenuItem>
              {collections.map((collection) => (
                <ContextMenuItem
                  key={collection.id}
                  onClick={() => props.onMove({ type: 'collection', collectionId: collection.id })}
                >
                  {collection.name}
                </ContextMenuItem>
              ))}
            </ContextMenuGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onClick={props.onReveal}>Show in Explorer</ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        {item.location.type === 'archive' ? (
          <ContextMenuItem onClick={props.onUnarchive}>Unarchive</ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={props.onArchive}>Archive</ContextMenuItem>
        )}
        <ContextMenuItem variant="destructive" onClick={props.onTrash}>
          Move to Trash
        </ContextMenuItem>
      </ContextMenuGroup>
    </>
  )
}

export function ItemActionMenu(props: ItemActionMenuProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className={cn(
              'size-10 rounded-full shadow-sm transition-[opacity,scale] duration-150 data-popup-open:opacity-100 active:scale-[0.96]',
              !props.alwaysVisible &&
                'opacity-0 group-data-[selected=true]/saved-item:opacity-100 group-data-[state=selected]/saved-item:opacity-100 group-focus-within/saved-item:opacity-100 group-hover/saved-item:opacity-100'
            )}
            aria-label={`Actions for ${props.item.title}`}
          />
        }
      >
        <IconDots aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownActions {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ItemContextMenu({
  children,
  ...props
}: ItemActionMenuProps & { children: React.ReactElement }): React.JSX.Element {
  return (
    <ContextMenu>
      <ContextMenuTrigger render={children} />
      <ContextMenuContent className="w-52">
        <ContextActions {...props} />
      </ContextMenuContent>
    </ContextMenu>
  )
}
