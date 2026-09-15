import { useEffect, useRef } from 'react'
import { IconAdjustmentsHorizontal, IconNote, IconPlus, IconTrash } from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Kbd } from '@/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ItemFilterMenuGroups, ItemSortMenuGroup } from '@/features/items/item-retrieval-menu'
import { DEFAULT_ITEM_SORT, type ItemSort } from '@/features/items/item-sort'
import type { ItemTypeFilter } from '@/features/items/item-view'
import { LibrarySearchInput } from '@/features/search/library-search-input'
import { ShellSidebarTrigger } from '@/features/shell/shell-sidebar-trigger'
import { WindowControls } from '@/features/shell/window-controls'

export function AppToolbar({
  newItemOpen,
  hasDraft,
  newItemFocusRequest,
  onNewNote,
  onNewItem,
  onDiscardDraft,
  destinationLabel,
  searchQuery,
  searchPending,
  searchFocusRequest,
  onSearchQueryChange,
  typeFilters,
  onTypeFilterChange,
  showReferencedAttachments,
  onShowReferencedAttachmentsChange,
  onClearFilters,
  sort,
  onSortChange,
  onWindowClose
}: {
  newItemOpen: boolean
  hasDraft: boolean
  newItemFocusRequest: number
  onNewNote: () => void
  onNewItem: () => void
  onDiscardDraft: () => void
  destinationLabel: string
  searchQuery: string
  searchPending: boolean
  searchFocusRequest: number
  onSearchQueryChange: (query: string) => void
  typeFilters: ItemTypeFilter[]
  onTypeFilterChange: (type: ItemTypeFilter, selected: boolean) => void
  showReferencedAttachments: boolean
  onShowReferencedAttachmentsChange: (show: boolean) => void
  onClearFilters: () => void
  sort: ItemSort
  onSortChange: (sort: ItemSort) => void
  onWindowClose?: () => void
}): React.JSX.Element {
  const newItemRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const filterCount = typeFilters.length + Number(showReferencedAttachments)
  const retrievalActive = filterCount > 0 || sort !== DEFAULT_ITEM_SORT

  useEffect(() => {
    if (newItemFocusRequest > 0) newItemRef.current?.focus()
  }, [newItemFocusRequest])

  useEffect(() => {
    if (searchFocusRequest > 0) searchInputRef.current?.focus()
  }, [searchFocusRequest])

  return (
    <header className="window-toolbar flex h-12 shrink-0 select-none items-center [-webkit-app-region:drag] [&_[data-slot=sidebar-trigger]]:size-10">
      <div className="@container/toolbar min-w-0 flex-1">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(10rem,28rem)_minmax(0,1fr)] items-center gap-3 px-2 @min-[44rem]/toolbar:px-5 @min-[64rem]/toolbar:px-7">
          <div className="flex min-w-0 items-center justify-start gap-1">
            <ShellSidebarTrigger />
            <span className="hidden min-w-0 truncate px-1 text-sm font-medium text-foreground/80 @min-[44rem]/toolbar:block">
              {destinationLabel}
            </span>
          </div>

          <div className="min-w-0 [-webkit-app-region:no-drag]">
            <LibrarySearchInput
              inputRef={searchInputRef}
              value={searchQuery}
              onValueChange={onSearchQueryChange}
              pending={searchPending}
            />
          </div>

          <div className="flex min-w-0 items-center justify-end gap-1 [-webkit-app-region:no-drag]">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    className="h-10 min-w-10 px-2.5 @min-[44rem]/toolbar:mr-1"
                    variant={retrievalActive ? 'secondary' : 'ghost'}
                    aria-label={`Sort and filter ${destinationLabel}`}
                  />
                }
              >
                <IconAdjustmentsHorizontal data-icon="inline-start" aria-hidden="true" />
                <span className="hidden @min-[60rem]/toolbar:inline">Sort &amp; filter</span>
                {filterCount > 0 ? (
                  <Badge variant="default" size="sm" className="tabular-nums">
                    {filterCount}
                  </Badge>
                ) : null}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <ItemSortMenuGroup sort={sort} onSortChange={onSortChange} />
                <DropdownMenuSeparator />
                <ItemFilterMenuGroups
                  typeFilters={typeFilters}
                  onTypeFilterChange={onTypeFilterChange}
                  showReferencedAttachments={showReferencedAttachments}
                  onShowReferencedAttachmentsChange={onShowReferencedAttachmentsChange}
                  onClearFilters={onClearFilters}
                />
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              className="h-10"
              size="sm"
              variant="ghost"
              aria-keyshortcuts="Control+N"
              aria-label="Create new note"
              onClick={onNewNote}
            >
              <IconNote data-icon="inline-start" aria-hidden="true" />
              <span className="hidden @min-[68rem]/toolbar:inline">New note</span>
              <Kbd className="ml-1 hidden @min-[88rem]/toolbar:inline-flex">Ctrl+N</Kbd>
            </Button>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    ref={newItemRef}
                    className="relative h-10 min-w-10 px-3"
                    size="sm"
                    variant="ghost"
                    data-new-item-button
                    aria-expanded={newItemOpen}
                    aria-label={hasDraft && !newItemOpen ? 'Continue Add item draft' : 'Add item'}
                    onClick={onNewItem}
                  />
                }
              >
                <IconPlus data-icon="inline-start" aria-hidden="true" />
                <span className="hidden @min-[76rem]/toolbar:inline">Add item</span>
                {hasDraft ? (
                  <span
                    className="absolute top-2 right-2 size-1.5 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                ) : null}
              </TooltipTrigger>
              <TooltipContent>
                {hasDraft && !newItemOpen ? 'Continue draft' : 'Add item'}
              </TooltipContent>
            </Tooltip>
            {hasDraft ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      className="size-10 rounded-xl"
                      size="icon"
                      variant="ghost"
                      aria-label="Discard New item draft"
                      onClick={onDiscardDraft}
                    />
                  }
                >
                  <IconTrash aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>Discard draft</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>
      </div>
      <WindowControls onClose={onWindowClose} />
    </header>
  )
}
