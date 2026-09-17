import {
  IconArchive,
  IconArchiveOff,
  IconArrowsDiagonal,
  IconCopy,
  IconCopyPlus,
  IconDots,
  IconEye,
  IconExternalLink,
  IconFolder,
  IconFolderOpen,
  IconInfoCircle,
  IconPaperclip,
  IconPencil,
  IconPhoto,
  IconPin,
  IconPinnedOff,
  IconRulerMeasure,
  IconTextCaption,
  IconRestore,
  IconRefresh,
  IconTrash,
  IconTrashX,
  IconWindowMaximize
} from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'

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
  ContextMenuLabel,
  ContextMenuShortcut,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { hasBulkItemSelection } from '@/features/items/item-shortcuts'
import type {
  ActiveItemLocation,
  CollectionDto,
  ItemLocation,
  LibraryItemDto
} from '../../../../shared/library-contract'

export interface NoteDetailMenuOptions {
  inlineTitle: boolean
  readableLineLength: boolean
  onInlineTitleChange: (checked: boolean) => void
  onReadableLineLengthChange: (checked: boolean) => void
  onManageAttachments: () => void
  onShowDetails: () => void
  onCopyAsMarkdown: () => void
  onUseFirstLineAsTitle?: () => void
  zen?: boolean
  onZenChange?: (checked: boolean) => void
}

export interface ItemActionHandlers {
  onOpen: () => void
  onOpenInNewWindow: () => void
  onDuplicate: () => void
  onRename: () => void
  onPin: () => void
  onUnpin: () => void
  onMove: (destination: ActiveItemLocation) => void
  onCopyPath: () => void
  onCopyImage: () => void
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
  targetCount: number
  targetLocations: readonly ItemLocation[]
  pinned: boolean
  onMenuOpen?: () => void
  alwaysVisible?: boolean
  showQuickSourceAction?: boolean
  triggerSurface?: 'default' | 'caption'
  hideOpenAction?: boolean
  detailOptions?: NoteDetailMenuOptions
}

function selectedItemsLabel(count: number): string {
  return `${count} selected`
}

type MenuSurface = 'dropdown' | 'context'

function ActionGroup({
  surface,
  children
}: {
  surface: MenuSurface
  children: ReactNode
}): React.JSX.Element {
  return surface === 'dropdown' ? (
    <DropdownMenuGroup>{children}</DropdownMenuGroup>
  ) : (
    <ContextMenuGroup>{children}</ContextMenuGroup>
  )
}

function ActionLabel({
  surface,
  children
}: {
  surface: MenuSurface
  children: ReactNode
}): React.JSX.Element {
  const className = children === 'This item' ? undefined : 'tabular-nums'
  return surface === 'dropdown' ? (
    <DropdownMenuLabel className={className}>{children}</DropdownMenuLabel>
  ) : (
    <ContextMenuLabel className={className}>{children}</ContextMenuLabel>
  )
}

function ActionSeparator({ surface }: { surface: MenuSurface }): React.JSX.Element {
  return surface === 'dropdown' ? <DropdownMenuSeparator /> : <ContextMenuSeparator />
}

function ActionItem({
  surface,
  onClick,
  children,
  destructive = false,
  shortcut
}: {
  surface: MenuSurface
  onClick: () => void
  children: ReactNode
  destructive?: boolean
  shortcut?: 'F2' | 'Delete'
}): React.JSX.Element {
  const content = (
    <>
      {children}
      {shortcut ? (
        surface === 'dropdown' ? (
          <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>
        ) : (
          <ContextMenuShortcut>{shortcut}</ContextMenuShortcut>
        )
      ) : null}
    </>
  )
  const commonProps = {
    'aria-keyshortcuts': shortcut,
    onClick,
    variant: destructive ? ('destructive' as const) : ('default' as const)
  }
  return surface === 'dropdown' ? (
    <DropdownMenuItem {...commonProps}>{content}</DropdownMenuItem>
  ) : (
    <ContextMenuItem {...commonProps}>{content}</ContextMenuItem>
  )
}

function MoveAction({
  surface,
  collections,
  targetLocations,
  onMove
}: Pick<ItemActionMenuProps, 'collections' | 'targetLocations' | 'onMove'> & {
  surface: MenuSurface
}): React.JSX.Element {
  const destinations =
    surface === 'dropdown' ? (
      <FolderDropdownDestinationItems
        collections={collections}
        currentLocations={targetLocations}
        onSelect={onMove}
      />
    ) : (
      <FolderContextDestinationItems
        collections={collections}
        currentLocations={targetLocations}
        onSelect={onMove}
      />
    )

  return surface === 'dropdown' ? (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2.5">
        <IconFolder aria-hidden="true" />
        Move to
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuGroup>{destinations}</DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  ) : (
    <ContextMenuSub>
      <ContextMenuSubTrigger className="gap-2.5">
        <IconFolder aria-hidden="true" />
        Move to
      </ContextMenuSubTrigger>
      <ContextMenuSubContent>
        <ContextMenuGroup>{destinations}</ContextMenuGroup>
      </ContextMenuSubContent>
    </ContextMenuSub>
  )
}

function ItemActions({
  surface,
  ...props
}: ItemActionMenuProps & { surface: MenuSurface }): React.JSX.Element {
  const { item, targetCount } = props
  const bulk = hasBulkItemSelection(targetCount)
  const inTrash = item.location.type === 'trash'

  return (
    <>
      {surface === 'dropdown' && props.detailOptions ? (
        <>
          <DropdownMenuGroup>
            <DropdownMenuLabel>View</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={props.detailOptions.readableLineLength}
              onCheckedChange={props.detailOptions.onReadableLineLengthChange}
            >
              <IconRulerMeasure aria-hidden="true" />
              Readable line length
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={props.detailOptions.inlineTitle}
              onCheckedChange={props.detailOptions.onInlineTitleChange}
            >
              <IconTextCaption aria-hidden="true" />
              Inline title
            </DropdownMenuCheckboxItem>
            {props.detailOptions.onZenChange ? (
              <DropdownMenuCheckboxItem
                checked={props.detailOptions.zen}
                onCheckedChange={props.detailOptions.onZenChange}
              >
                <IconArrowsDiagonal aria-hidden="true" />
                Zen mode
                <DropdownMenuShortcut>Ctrl+Shift+\</DropdownMenuShortcut>
              </DropdownMenuCheckboxItem>
            ) : null}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={props.detailOptions.onCopyAsMarkdown}>
              <IconCopy aria-hidden="true" />
              Copy as Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.detailOptions.onManageAttachments}>
              <IconPaperclip aria-hidden="true" />
              Manage attachments
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.detailOptions.onShowDetails}>
              <IconInfoCircle aria-hidden="true" />
              Note details
            </DropdownMenuItem>
            {props.detailOptions.onUseFirstLineAsTitle ? (
              <DropdownMenuItem onClick={props.detailOptions.onUseFirstLineAsTitle}>
                <IconRefresh aria-hidden="true" />
                Use first line as title
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
        </>
      ) : null}
      <ActionGroup surface={surface}>
        {bulk ? <ActionLabel surface={surface}>This item</ActionLabel> : null}
        {!props.hideOpenAction ? (
          <ActionItem surface={surface} onClick={props.onOpen}>
            <IconEye aria-hidden="true" />
            Open
          </ActionItem>
        ) : null}
        {!bulk && item.type === 'note' ? (
          <ActionItem surface={surface} onClick={props.onOpenInNewWindow}>
            <IconWindowMaximize aria-hidden="true" />
            Open in new window
          </ActionItem>
        ) : null}
        {!inTrash && item.type === 'url' ? (
          <ActionItem surface={surface} onClick={props.onOpenSource}>
            <IconExternalLink aria-hidden="true" />
            Open source link
          </ActionItem>
        ) : null}
        {!inTrash ? (
          <ActionItem surface={surface} shortcut="F2" onClick={props.onRename}>
            <IconPencil aria-hidden="true" />
            Rename
          </ActionItem>
        ) : null}
        {!inTrash && !bulk && item.type === 'note' ? (
          <ActionItem surface={surface} onClick={props.onDuplicate}>
            <IconCopyPlus aria-hidden="true" />
            Duplicate note
          </ActionItem>
        ) : null}
        {!inTrash ? (
          <ActionItem surface={surface} onClick={props.pinned ? props.onUnpin : props.onPin}>
            {props.pinned ? <IconPinnedOff aria-hidden="true" /> : <IconPin aria-hidden="true" />}
            {props.pinned ? 'Unpin' : 'Pin'}
          </ActionItem>
        ) : null}
        {!inTrash && !bulk ? <MoveAction surface={surface} {...props} /> : null}
        {!bulk && item.type === 'image' ? (
          <ActionItem surface={surface} onClick={props.onCopyImage}>
            <IconPhoto aria-hidden="true" />
            Copy image
          </ActionItem>
        ) : null}
        {!bulk ? (
          <ActionItem surface={surface} onClick={props.onCopyPath}>
            <IconCopy aria-hidden="true" />
            Copy file path
          </ActionItem>
        ) : null}
        <ActionItem surface={surface} onClick={props.onReveal}>
          <IconFolderOpen aria-hidden="true" />
          Show in Explorer
        </ActionItem>
        {inTrash && !bulk ? (
          <ActionItem surface={surface} onClick={props.onRestore}>
            <IconRestore aria-hidden="true" />
            Restore
          </ActionItem>
        ) : null}
      </ActionGroup>
      <ActionSeparator surface={surface} />
      <ActionGroup surface={surface}>
        {bulk ? (
          <>
            <ActionLabel surface={surface}>{selectedItemsLabel(targetCount)}</ActionLabel>
            {inTrash ? (
              <ActionItem surface={surface} onClick={props.onRestore}>
                <IconRestore aria-hidden="true" />
                Restore
              </ActionItem>
            ) : (
              <>
                <MoveAction surface={surface} {...props} />
                <ActionItem surface={surface} onClick={props.pinned ? props.onUnpin : props.onPin}>
                  {props.pinned ? (
                    <IconPinnedOff aria-hidden="true" />
                  ) : (
                    <IconPin aria-hidden="true" />
                  )}
                  {props.pinned ? 'Unpin' : 'Pin'}
                </ActionItem>
              </>
            )}
          </>
        ) : null}
        {inTrash ? (
          <ActionItem
            surface={surface}
            destructive
            shortcut="Delete"
            onClick={props.onDeletePermanently}
          >
            <IconTrashX aria-hidden="true" />
            Delete permanently
          </ActionItem>
        ) : (
          <>
            {item.location.type === 'archive' ? (
              <ActionItem surface={surface} onClick={props.onUnarchive}>
                <IconArchiveOff aria-hidden="true" />
                Unarchive
              </ActionItem>
            ) : (
              <ActionItem surface={surface} onClick={props.onArchive}>
                <IconArchive aria-hidden="true" />
                Archive
              </ActionItem>
            )}
            <ActionItem surface={surface} destructive shortcut="Delete" onClick={props.onTrash}>
              <IconTrash aria-hidden="true" />
              Move to Trash
            </ActionItem>
          </>
        )}
      </ActionGroup>
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
      <DropdownMenu
        open={menuOpen}
        onOpenChange={(open) => {
          if (open) props.onMenuOpen?.()
          setMenuOpen(open)
        }}
      >
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size={props.triggerSurface === 'caption' ? 'icon-sm' : 'icon'}
              variant={props.triggerSurface === 'caption' ? 'ghost' : 'secondary'}
              className={cn(
                props.triggerSurface === 'caption'
                  ? 'text-muted-foreground'
                  : actionButtonClassName,
                menuOpen && 'opacity-100'
              )}
              aria-label={`Actions for ${props.item.title}`}
            />
          }
        >
          <IconDots aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <ItemActions surface="dropdown" {...props} />
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
    <ContextMenu onOpenChange={(open) => open && props.onMenuOpen?.()}>
      <ContextMenuTrigger render={children} />
      <ContextMenuContent className="w-60">
        <ItemActions surface="context" {...props} />
      </ContextMenuContent>
    </ContextMenu>
  )
}
