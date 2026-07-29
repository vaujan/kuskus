import {
  IconArchive,
  IconArchiveOff,
  IconDots,
  IconEye,
  IconExternalLink,
  IconFolder,
  IconFolderOpen,
  IconPencil,
  IconRestore,
  IconTrash,
  IconTrashX
} from '@tabler/icons-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  FolderContextDestinationItems,
  FolderDropdownDestinationItems
} from '@/features/collections/folder-destination-items'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuShortcut,
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
  DropdownMenuShortcut,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
  showQuickSourceAction?: boolean
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
          <DropdownMenuItem onClick={onOpen}>
            <IconEye aria-hidden="true" />
            Open
          </DropdownMenuItem>
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
          <DropdownMenuItem
            variant="destructive"
            aria-keyshortcuts="Delete"
            onClick={onDeletePermanently}
          >
            <IconTrashX aria-hidden="true" />
            Delete permanently
            <DropdownMenuShortcut>Delete</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </>
    )
  }

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuItem onClick={onOpen}>
          <IconEye aria-hidden="true" />
          Open
        </DropdownMenuItem>
        {item.type === 'url' ? (
          <DropdownMenuItem onClick={onOpenSource}>
            <IconExternalLink aria-hidden="true" />
            Open source link
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem aria-keyshortcuts="F2" onClick={onRename}>
          <IconPencil aria-hidden="true" />
          Rename
          <DropdownMenuShortcut>F2</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconFolder aria-hidden="true" />
            Move to
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuGroup>
              <FolderDropdownDestinationItems
                collections={collections}
                currentLocations={[item.location]}
                onSelect={onMove}
              />
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
        <DropdownMenuItem variant="destructive" aria-keyshortcuts="Delete" onClick={onTrash}>
          <IconTrash aria-hidden="true" />
          Move to Trash
          <DropdownMenuShortcut>Delete</DropdownMenuShortcut>
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
          <ContextMenuItem onClick={props.onOpen}>
            <IconEye aria-hidden="true" />
            Open
          </ContextMenuItem>
          <ContextMenuItem onClick={props.onReveal}>
            <IconFolderOpen aria-hidden="true" />
            Show in Explorer
          </ContextMenuItem>
          <ContextMenuItem onClick={props.onRestore}>
            <IconRestore aria-hidden="true" />
            Restore
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem
            variant="destructive"
            aria-keyshortcuts="Delete"
            onClick={props.onDeletePermanently}
          >
            <IconTrashX aria-hidden="true" />
            Delete permanently
            <ContextMenuShortcut>Delete</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuGroup>
      </>
    )
  }
  return (
    <>
      <ContextMenuGroup>
        <ContextMenuItem onClick={props.onOpen}>
          <IconEye aria-hidden="true" />
          Open
        </ContextMenuItem>
        {item.type === 'url' ? (
          <ContextMenuItem onClick={props.onOpenSource}>
            <IconExternalLink aria-hidden="true" />
            Open source link
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem aria-keyshortcuts="F2" onClick={props.onRename}>
          <IconPencil aria-hidden="true" />
          Rename
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <IconFolder aria-hidden="true" />
            Move to
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuGroup>
              <FolderContextDestinationItems
                collections={collections}
                currentLocations={[item.location]}
                onSelect={props.onMove}
              />
            </ContextMenuGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onClick={props.onReveal}>
          <IconFolderOpen aria-hidden="true" />
          Show in Explorer
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        {item.location.type === 'archive' ? (
          <ContextMenuItem onClick={props.onUnarchive}>
            <IconArchiveOff aria-hidden="true" />
            Unarchive
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={props.onArchive}>
            <IconArchive aria-hidden="true" />
            Archive
          </ContextMenuItem>
        )}
        <ContextMenuItem variant="destructive" aria-keyshortcuts="Delete" onClick={props.onTrash}>
          <IconTrash aria-hidden="true" />
          Move to Trash
          <ContextMenuShortcut>Delete</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuGroup>
    </>
  )
}

export function ItemActionMenu(props: ItemActionMenuProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const actionButtonClassName = cn(
    'rounded-full shadow-sm transition-[opacity,scale] [transition-duration:var(--motion-duration-press)] [transition-timing-function:var(--motion-ease-out)]',
    !props.alwaysVisible && 'opacity-0 group-hover/saved-item:opacity-100 focus-visible:opacity-100'
  )

  return (
    <div className="flex items-center gap-1">
      {props.item.type === 'url' && props.showQuickSourceAction ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className={actionButtonClassName}
                aria-label={`Open source link for ${props.item.title}`}
                onClick={(event) => {
                  event.stopPropagation()
                  props.onOpenSource()
                }}
              />
            }
          >
            <IconExternalLink aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>Open source link</TooltipContent>
        </Tooltip>
      ) : null}
      <DropdownMenu open={menuOpen} onOpenChange={(open) => setMenuOpen(open)}>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className={cn(actionButtonClassName, menuOpen && 'opacity-100')}
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
    </div>
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
