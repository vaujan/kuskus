import { useEffect, useRef } from 'react'
import { IconAdjustmentsHorizontal, IconNote, IconPlus, IconSearch } from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { FocusRailDensity } from '@/features/items/focus-view-state'
import { ItemFilterMenuGroups, ItemSortMenuGroup } from '@/features/items/item-retrieval-menu'
import { DEFAULT_ITEM_SORT, type ItemSort } from '@/features/items/item-sort'
import type { ItemTypeFilter } from '@/features/items/item-view'
import { ShellSidebarTrigger } from '@/features/shell/shell-sidebar-trigger'

export function FocusListHeader({
  destinationLabel,
  composerOpen,
  hasDraft,
  newItemFocusRequest,
  onNewNote,
  onNewItem,
  onOpenSearch,
  typeFilters,
  onTypeFilterChange,
  showReferencedAttachments,
  onShowReferencedAttachmentsChange,
  onClearFilters,
  sort,
  onSortChange,
  density,
  onDensityChange
}: {
  destinationLabel: string
  composerOpen: boolean
  hasDraft: boolean
  newItemFocusRequest: number
  onNewNote: () => void
  onNewItem: () => void
  onOpenSearch: () => void
  typeFilters: ItemTypeFilter[]
  onTypeFilterChange: (type: ItemTypeFilter, selected: boolean) => void
  showReferencedAttachments: boolean
  onShowReferencedAttachmentsChange: (show: boolean) => void
  onClearFilters: () => void
  sort: ItemSort
  onSortChange: (sort: ItemSort) => void
  density: FocusRailDensity
  onDensityChange: (density: FocusRailDensity) => void
}): React.JSX.Element {
  const newItemRef = useRef<HTMLButtonElement>(null)
  const filterCount = typeFilters.length + Number(showReferencedAttachments)
  const retrievalActive = filterCount > 0 || sort !== DEFAULT_ITEM_SORT

  useEffect(() => {
    if (newItemFocusRequest > 0) newItemRef.current?.focus()
  }, [newItemFocusRequest])

  return (
    <header
      data-focus-list-header
      className="@container/focus-header flex h-10 shrink-0 select-none items-center gap-0.5 px-1 [-webkit-app-region:drag] [&_[data-slot=button]]:size-10"
    >
      <ShellSidebarTrigger />

      <div className="flex min-w-0 flex-1 items-center [-webkit-app-region:no-drag]">
        <span className="min-w-0 truncate px-1.5 text-sm font-medium text-foreground/80">
          {destinationLabel}
        </span>
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className="[-webkit-app-region:no-drag]"
              size="icon-sm"
              variant="ghost"
              aria-label="Search the entire library"
              aria-keyshortcuts="Control+K Meta+K"
              onClick={onOpenSearch}
            />
          }
        >
          <IconSearch data-icon="inline-start" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Search library (Ctrl+K)</TooltipContent>
      </Tooltip>

      <div className="mr-0.5 [-webkit-app-region:no-drag]">
        <Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <TooltipTrigger
                  render={
                    <Button
                      className="relative"
                      size="icon-sm"
                      variant={retrievalActive ? 'secondary' : 'ghost'}
                      aria-label={`Sort and filter ${destinationLabel}`}
                    />
                  }
                />
              }
            >
              <IconAdjustmentsHorizontal data-icon="inline-start" aria-hidden="true" />
              {filterCount > 0 ? (
                <Badge
                  className="absolute top-0.5 right-0.5 min-w-4 justify-center tabular-nums"
                  size="sm"
                  variant="default"
                >
                  {filterCount}
                </Badge>
              ) : null}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <ItemSortMenuGroup sort={sort} onSortChange={onSortChange} />
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Item layout</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={density}
                  onValueChange={(value) => onDensityChange(value as FocusRailDensity)}
                >
                  <DropdownMenuRadioItem value="index">Index</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="visual">Visual</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
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
          <TooltipContent>Sort and filter items</TooltipContent>
        </Tooltip>
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className="relative [-webkit-app-region:no-drag]"
              size="icon-sm"
              variant="ghost"
              aria-keyshortcuts="Control+N"
              aria-label="Create new note"
              onClick={onNewNote}
            />
          }
        >
          <IconNote data-icon="inline-start" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>New note (Ctrl+N)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              ref={newItemRef}
              className="relative [-webkit-app-region:no-drag]"
              size="icon-sm"
              variant="ghost"
              data-new-item-button
              aria-expanded={composerOpen}
              aria-label={hasDraft && !composerOpen ? 'Continue Add item draft' : 'Add item'}
              onClick={onNewItem}
            />
          }
        >
          <IconPlus data-icon="inline-start" aria-hidden="true" />
          {hasDraft ? (
            <span
              className="absolute top-2 right-2 size-1.5 rounded-full bg-primary"
              aria-hidden="true"
            />
          ) : null}
        </TooltipTrigger>
        <TooltipContent>{hasDraft && !composerOpen ? 'Continue draft' : 'Add item'}</TooltipContent>
      </Tooltip>
    </header>
  )
}
