import { useEffect, useRef } from 'react'
import { IconAdjustmentsHorizontal, IconPlus, IconSearch, IconX } from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@/components/ui/input-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ItemFilterMenuGroups, ItemSortMenuGroup } from '@/features/items/item-retrieval-menu'
import { DEFAULT_ITEM_SORT, type ItemSort } from '@/features/items/item-sort'
import type { ItemTypeFilter } from '@/features/items/item-view'
import { ShellSidebarTrigger } from '@/features/shell/shell-sidebar-trigger'

export function FocusListHeader({
  keyboardShortcutsEnabled,
  destinationLabel,
  composerOpen,
  hasDraft,
  newItemFocusRequest,
  onNewItem,
  search,
  onSearchChange,
  searchPending,
  resultCount,
  totalCount,
  typeFilters,
  onTypeFilterChange,
  showReferencedAttachments,
  onShowReferencedAttachmentsChange,
  onClearFilters,
  sort,
  onSortChange
}: {
  keyboardShortcutsEnabled: boolean
  destinationLabel: string
  composerOpen: boolean
  hasDraft: boolean
  newItemFocusRequest: number
  onNewItem: () => void
  search: string
  onSearchChange: (value: string) => void
  searchPending: boolean
  resultCount: number
  totalCount: number
  typeFilters: ItemTypeFilter[]
  onTypeFilterChange: (type: ItemTypeFilter, selected: boolean) => void
  showReferencedAttachments: boolean
  onShowReferencedAttachmentsChange: (show: boolean) => void
  onClearFilters: () => void
  sort: ItemSort
  onSortChange: (sort: ItemSort) => void
}): React.JSX.Element {
  const searchRef = useRef<HTMLInputElement>(null)
  const newItemRef = useRef<HTMLButtonElement>(null)
  const hasSearch = search.trim().length > 0
  const filterCount = typeFilters.length + Number(showReferencedAttachments)
  const retrievalActive = filterCount > 0 || sort !== DEFAULT_ITEM_SORT
  const searchStatus = searchPending
    ? 'Searching...'
    : resultCount === 0
      ? 'No matches'
      : `${resultCount} of ${totalCount}`

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (!keyboardShortcutsEnabled || event.defaultPrevented) return
      if (
        event.target instanceof Element &&
        event.target.closest(
          '[data-detail-surface], [role="dialog"], [role="menu"], [role="listbox"]'
        )
      ) {
        return
      }
      const key = event.key.toLocaleLowerCase()
      if ((event.ctrlKey || event.metaKey) && (key === 'k' || key === 'f')) {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      if (
        event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        key === 'n' &&
        document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]') === null
      ) {
        event.preventDefault()
        onNewItem()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [keyboardShortcutsEnabled, onNewItem])

  useEffect(() => {
    if (newItemFocusRequest > 0) newItemRef.current?.focus()
  }, [newItemFocusRequest])

  return (
    <header
      data-focus-list-header
      className="@container/focus-header flex h-14 shrink-0 select-none items-center gap-1 border-b border-border/70 px-2 [-webkit-app-region:drag]"
    >
      <ShellSidebarTrigger />

      <InputGroup className="h-10 min-w-0 flex-1 border-transparent bg-muted/55 transition-[background-color,box-shadow] [transition-duration:var(--motion-duration-ui)] [-webkit-app-region:no-drag] hover:bg-muted/75 has-[[data-slot=input-group-control]:focus-visible]:bg-background has-[[data-slot=input-group-control]:focus-visible]:shadow-[inset_0_0_0_1px_var(--ring)] has-[[data-slot=input-group-control]:focus-visible]:ring-0">
        <InputGroupInput
          ref={searchRef}
          className="h-10 min-w-0 text-sm [&::-webkit-search-cancel-button]:hidden md:text-sm"
          type="search"
          name="focus-search"
          aria-keyshortcuts="Control+K Meta+K Control+F Meta+F"
          autoComplete="off"
          placeholder="Search..."
          aria-label={`Search ${destinationLabel} by title, note text, link, or filename`}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && search) {
              event.preventDefault()
              onSearchChange('')
            } else if (event.key === 'Escape') event.currentTarget.blur()
          }}
        />
        <InputGroupAddon align="inline-start" className="min-w-0 gap-1.5 pl-2.5 pr-1">
          <IconSearch aria-hidden="true" />
          <span
            className="hidden max-w-24 truncate text-xs font-medium text-foreground/70 @min-[22rem]/focus-header:inline"
            title={destinationLabel}
          >
            {destinationLabel}
          </span>
          <span
            className="hidden h-3.5 w-px shrink-0 bg-border @min-[22rem]/focus-header:block"
            aria-hidden="true"
          />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end" className="gap-1 pr-1.5">
          <span
            className="hidden max-w-20 truncate text-[0.6875rem] tabular-nums text-muted-foreground @min-[34rem]/focus-header:inline"
            aria-live="polite"
            aria-atomic="true"
          >
            {hasSearch ? searchStatus : ''}
          </span>
          {hasSearch ? (
            <InputGroupButton
              size="icon-xs"
              aria-label="Clear search"
              onClick={() => {
                onSearchChange('')
                searchRef.current?.focus()
              }}
            >
              <IconX aria-hidden="true" />
            </InputGroupButton>
          ) : null}
        </InputGroupAddon>
      </InputGroup>

      <div className="[-webkit-app-region:no-drag]">
        <Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <TooltipTrigger
                  render={
                    <Button
                      className="relative size-10"
                      size="icon"
                      variant={retrievalActive ? 'secondary' : 'ghost'}
                      aria-label={`Sort and filter ${destinationLabel}`}
                    />
                  }
                />
              }
            >
              <IconAdjustmentsHorizontal aria-hidden="true" />
              {filterCount > 0 ? (
                <Badge
                  className="absolute -top-1 -right-1 min-w-4 justify-center px-1 tabular-nums"
                  variant="secondary"
                >
                  {filterCount}
                </Badge>
              ) : null}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
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
          <TooltipContent>Sort and filter items</TooltipContent>
        </Tooltip>
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              ref={newItemRef}
              className="relative size-10 [-webkit-app-region:no-drag]"
              size="icon"
              variant="ghost"
              data-new-item-button
              aria-expanded={composerOpen}
              aria-keyshortcuts="Control+N"
              aria-label={hasDraft && !composerOpen ? 'Continue New item draft' : 'Create new item'}
              onClick={onNewItem}
            />
          }
        >
          <IconPlus aria-hidden="true" />
          {hasDraft ? (
            <span
              className="absolute top-2 right-2 size-1.5 rounded-full bg-primary"
              aria-hidden="true"
            />
          ) : null}
        </TooltipTrigger>
        <TooltipContent>{hasDraft && !composerOpen ? 'Continue draft' : 'New item'}</TooltipContent>
      </Tooltip>
    </header>
  )
}
