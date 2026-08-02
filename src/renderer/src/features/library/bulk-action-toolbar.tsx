import {
  IconArchive,
  IconArchiveOff,
  IconChevronDown,
  IconFolderOpen,
  IconRestore,
  IconTrash,
  IconTrashX,
  IconX
} from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FolderDropdownDestinationItems } from '@/features/collections/folder-destination-items'
import { hasBulkItemSelection } from '@/features/items/item-shortcuts'
import type { LibraryDestination } from '@/features/shell/library-sidebar'
import type {
  ActiveItemLocation,
  CollectionDto,
  ItemLocation
} from '../../../../shared/library-contract'

interface BulkActionToolbarProps {
  selectedItemIds: string[]
  selectedItemLocations: ItemLocation[]
  destination: LibraryDestination
  collections: CollectionDto[]
  onMove: (itemIds: string[], destination: ActiveItemLocation) => void
  onArchive: (itemIds: string[]) => void
  onUnarchive: (itemIds: string[]) => void
  onTrash: (itemIds: string[]) => void
  onRestore: (itemIds: string[]) => void
  onDeletePermanently: (itemIds: string[]) => void
  onClearSelection: () => void
}

const actionClassName =
  'h-10 rounded-xl px-3 @max-[34rem]/selection-toolbar:w-10 @max-[34rem]/selection-toolbar:px-0'

const actionLabelClassName = '@max-[34rem]/selection-toolbar:hidden'

export function BulkActionToolbar({
  selectedItemIds,
  selectedItemLocations,
  destination,
  collections,
  onMove,
  onArchive,
  onUnarchive,
  onTrash,
  onRestore,
  onDeletePermanently,
  onClearSelection
}: BulkActionToolbarProps): React.JSX.Element {
  const visible = hasBulkItemSelection(selectedItemIds.length)

  return (
    <div className="@container/selection-toolbar pointer-events-none absolute inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <div
        role="toolbar"
        aria-label="Selected item actions"
        aria-hidden={!visible}
        inert={!visible}
        data-visible={visible}
        className="pointer-events-auto relative isolate flex max-w-full items-center justify-center gap-1.5 overflow-hidden rounded-[1.25rem] bg-popover/70 p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/5 backdrop-blur-2xl backdrop-saturate-150 data-[visible=false]:invisible data-[visible=false]:opacity-0 dark:ring-foreground/10"
      >
        <span
          aria-live="polite"
          className="shrink-0 px-2 text-sm font-medium tabular-nums whitespace-nowrap"
        >
          {selectedItemIds.length} selected
        </span>
        <Separator orientation="vertical" className="mx-0.5 h-6! self-center!" />

        {destination.type !== 'trash' ? (
          <Tooltip>
            <DropdownMenu>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        aria-label="Move selected items"
                        disabled={!visible}
                        className={actionClassName}
                      />
                    }
                  />
                }
              >
                <IconFolderOpen data-icon="inline-start" aria-hidden="true" />
                <span className={actionLabelClassName}>Move to</span>
                <IconChevronDown
                  data-icon="inline-end"
                  className={actionLabelClassName}
                  aria-hidden="true"
                />
              </TooltipTrigger>
              <DropdownMenuContent align="center" side="top" sideOffset={10}>
                <DropdownMenuGroup>
                  <FolderDropdownDestinationItems
                    collections={collections}
                    currentLocations={selectedItemLocations}
                    onSelect={(nextDestination) => onMove(selectedItemIds, nextDestination)}
                  />
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <TooltipContent>Move selected items</TooltipContent>
          </Tooltip>
        ) : null}

        {destination.type === 'archive' ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  aria-label="Unarchive selected items"
                  disabled={!visible}
                  className={actionClassName}
                  onClick={() => onUnarchive(selectedItemIds)}
                />
              }
            >
              <IconArchiveOff data-icon="inline-start" aria-hidden="true" />
              <span className={actionLabelClassName}>Unarchive</span>
            </TooltipTrigger>
            <TooltipContent>Unarchive selected items</TooltipContent>
          </Tooltip>
        ) : destination.type === 'trash' ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  aria-label="Restore selected items"
                  disabled={!visible}
                  className={actionClassName}
                  onClick={() => onRestore(selectedItemIds)}
                />
              }
            >
              <IconRestore data-icon="inline-start" aria-hidden="true" />
              <span className={actionLabelClassName}>Restore</span>
            </TooltipTrigger>
            <TooltipContent>Restore selected items</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  aria-label="Archive selected items"
                  disabled={!visible}
                  className={actionClassName}
                  onClick={() => onArchive(selectedItemIds)}
                />
              }
            >
              <IconArchive data-icon="inline-start" aria-hidden="true" />
              <span className={actionLabelClassName}>Archive</span>
            </TooltipTrigger>
            <TooltipContent>Archive selected items</TooltipContent>
          </Tooltip>
        )}

        {destination.type === 'trash' ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="destructive"
                  aria-label="Permanently delete selected items"
                  disabled={!visible}
                  className={actionClassName}
                  onClick={() => onDeletePermanently(selectedItemIds)}
                />
              }
            >
              <IconTrashX data-icon="inline-start" aria-hidden="true" />
              <span className={actionLabelClassName}>Delete permanently</span>
            </TooltipTrigger>
            <TooltipContent>Delete selected items permanently</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="destructive"
                  aria-label="Move selected items to Trash"
                  disabled={!visible}
                  className={actionClassName}
                  onClick={() => onTrash(selectedItemIds)}
                />
              }
            >
              <IconTrash data-icon="inline-start" aria-hidden="true" />
              <span className={actionLabelClassName}>Move to Trash</span>
            </TooltipTrigger>
            <TooltipContent>Move selected items to Trash</TooltipContent>
          </Tooltip>
        )}

        <Separator orientation="vertical" className="mx-0.5 h-6! self-center!" />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Clear selection"
                disabled={!visible}
                className="size-10 rounded-xl"
                onClick={onClearSelection}
              />
            }
          >
            <IconX aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>Clear selection</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
