import { useEffect, useRef } from 'react'
import {
  IconAdjustmentsHorizontal,
  IconFileText,
  IconFile,
  IconLink,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
  type TablerIcon
} from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ITEM_SORT_OPTIONS, DEFAULT_ITEM_SORT, type ItemSort } from '@/features/items/item-sort'
import { ITEM_TYPE_FILTERS, type ItemTypeFilter } from '@/features/items/item-view'
import { WindowControls } from '@/features/shell/window-controls'
import { cn } from '@/lib/utils'

const TYPE_OPTIONS: Record<ItemTypeFilter, { label: string; icon: TablerIcon }> = {
  note: { label: 'Notes', icon: IconFileText },
  image: { label: 'Images', icon: IconPhoto },
  url: { label: 'Links', icon: IconLink },
  file: { label: 'Files', icon: IconFile }
}

function ShellSidebarTrigger(): React.JSX.Element {
  const { isMobile, openMobile, state } = useSidebar()
  const isOpen = isMobile ? openMobile : state === 'expanded'
  const label = isOpen ? 'Hide sidebar' : 'Show sidebar'

  return (
    <div className="[-webkit-app-region:no-drag]">
      <Tooltip>
        <TooltipTrigger render={<SidebarTrigger className="size-8" aria-label={label} />} />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function AppToolbar({
  keyboardShortcutsEnabled = true,
  newItemOpen,
  hasDraft,
  newItemFocusRequest,
  onNewItem,
  onDiscardDraft,
  search,
  searchScope,
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
  keyboardShortcutsEnabled?: boolean
  newItemOpen: boolean
  hasDraft: boolean
  newItemFocusRequest: number
  onNewItem: () => void
  onDiscardDraft: () => void
  search: string
  searchScope: string
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
  const searchStatus = searchPending
    ? 'Searching…'
    : resultCount === 0
      ? 'No matches'
      : `${resultCount} of ${totalCount} ${totalCount === 1 ? 'item' : 'items'}`

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent): void => {
      if (!keyboardShortcutsEnabled || event.defaultPrevented) return
      const key = event.key.toLocaleLowerCase()
      if ((event.ctrlKey || event.metaKey) && (key === 'k' || key === 'f')) {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [keyboardShortcutsEnabled])

  useEffect(() => {
    const openNewItem = (event: KeyboardEvent): void => {
      if (
        !keyboardShortcutsEnabled ||
        event.defaultPrevented ||
        !event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLocaleLowerCase() !== 'n' ||
        document.querySelector('[role="dialog"]') !== null
      ) {
        return
      }
      event.preventDefault()
      onNewItem()
    }
    window.addEventListener('keydown', openNewItem)
    return () => window.removeEventListener('keydown', openNewItem)
  }, [keyboardShortcutsEnabled, onNewItem])

  useEffect(() => {
    if (newItemFocusRequest > 0) newItemRef.current?.focus()
  }, [newItemFocusRequest])

  return (
    <header className="window-toolbar flex h-12 shrink-0 select-none items-center [-webkit-app-region:drag]">
      <div className="@container/toolbar min-w-0 flex-1">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 px-2 @min-[44rem]/toolbar:grid-cols-[minmax(12rem,1fr)_minmax(16rem,40rem)_minmax(12rem,1fr)] @min-[44rem]/toolbar:gap-2 @min-[44rem]/toolbar:px-5 @min-[64rem]/toolbar:px-7">
          <div className="flex justify-start">
            <ShellSidebarTrigger />
          </div>

          <div className="flex min-w-0 items-center gap-1 [-webkit-app-region:no-drag]">
            <InputGroup className="h-8 min-w-0 flex-1 border-transparent transition-[background-color,box-shadow] [transition-duration:var(--motion-duration-ui)] hover:bg-muted/80 has-[[data-slot=input-group-control]:focus-visible]:bg-background has-[[data-slot=input-group-control]:focus-visible]:shadow-[inset_0_0_0_1px_var(--ring),0_4px_14px_rgb(0_0_0/0.08)] has-[[data-slot=input-group-control]:focus-visible]:ring-0">
              <InputGroupInput
                ref={searchRef}
                className="h-8 min-w-0 text-sm [&::-webkit-search-cancel-button]:hidden md:text-sm"
                type="search"
                name="search"
                aria-keyshortcuts="Control+K Meta+K Control+F Meta+F"
                autoComplete="off"
                placeholder="Search…"
                aria-label={`Search ${searchScope} by title, note text, link, or filename`}
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && search) {
                    event.preventDefault()
                    onSearchChange('')
                  } else if (event.key === 'Escape') {
                    event.currentTarget.blur()
                  }
                }}
              />
              <InputGroupAddon align="inline-start" className="min-w-0 gap-1.5 pl-2.5 pr-1">
                <IconSearch aria-hidden="true" />
                <span
                  className="max-w-20 truncate text-xs font-medium text-foreground/70 @min-[56rem]/toolbar:max-w-32"
                  title={searchScope}
                >
                  {searchScope}
                </span>
                <span className="h-3.5 w-px shrink-0 bg-border" aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end" className="gap-2 pr-1.5">
                <span
                  className="hidden max-w-28 truncate text-[0.6875rem] font-normal tabular-nums text-muted-foreground @min-[64rem]/toolbar:inline"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {hasSearch ? searchStatus : ''}
                </span>
                <span className="relative flex h-6 w-6 shrink-0 items-center justify-end @min-[48rem]/toolbar:w-14">
                  <Kbd
                    className={cn(
                      'absolute right-0 hidden @min-[48rem]/toolbar:inline-flex',
                      hasSearch ? 'invisible opacity-0' : 'visible opacity-100'
                    )}
                    aria-hidden="true"
                  >
                    Ctrl+K
                  </Kbd>
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="Clear search"
                    tabIndex={hasSearch ? 0 : -1}
                    className={cn(
                      "absolute right-0 after:absolute after:-inset-2 after:content-['']",
                      hasSearch ? 'visible opacity-100' : 'pointer-events-none invisible opacity-0'
                    )}
                    onClick={() => {
                      onSearchChange('')
                      searchRef.current?.focus()
                    }}
                  >
                    <IconX aria-hidden="true" />
                  </InputGroupButton>
                </span>
              </InputGroupAddon>
            </InputGroup>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    className="min-w-8 px-2.5"
                    variant={
                      typeFilters.length > 0 ||
                      showReferencedAttachments ||
                      sort !== DEFAULT_ITEM_SORT
                        ? 'secondary'
                        : 'ghost'
                    }
                    aria-label={`Sort and filter ${searchScope}`}
                  />
                }
              >
                <IconAdjustmentsHorizontal data-icon="inline-start" aria-hidden="true" />
                <span className="hidden @min-[56rem]/toolbar:inline">Filter</span>
                {typeFilters.length > 0 || showReferencedAttachments ? (
                  <Badge variant="secondary" className="tabular-nums">
                    {typeFilters.length + Number(showReferencedAttachments)}
                  </Badge>
                ) : null}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={sort}
                    onValueChange={(value) => onSortChange(value as ItemSort)}
                  >
                    {ITEM_SORT_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Item type</DropdownMenuLabel>
                  {ITEM_TYPE_FILTERS.map((type) => {
                    const option = TYPE_OPTIONS[type]
                    const Icon = option.icon
                    return (
                      <DropdownMenuCheckboxItem
                        key={type}
                        checked={typeFilters.includes(type)}
                        onCheckedChange={(checked) => onTypeFilterChange(type, checked)}
                      >
                        <Icon aria-hidden="true" />
                        {option.label}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Visibility</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={showReferencedAttachments}
                    onCheckedChange={onShowReferencedAttachmentsChange}
                  >
                    Show referenced attachments
                  </DropdownMenuCheckboxItem>
                </DropdownMenuGroup>
                {typeFilters.length > 0 || showReferencedAttachments ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={onClearFilters}>Clear filters</DropdownMenuItem>
                    </DropdownMenuGroup>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-1">
            <Button
              ref={newItemRef}
              data-new-item-button
              aria-expanded={newItemOpen}
              aria-keyshortcuts="Control+N"
              aria-label={hasDraft && !newItemOpen ? 'Continue New item draft' : 'Create new item'}
              onClick={onNewItem}
            >
              <IconPlus data-icon="inline-start" aria-hidden="true" />
              <span className="hidden @min-[44rem]/toolbar:inline">
                {hasDraft && !newItemOpen ? 'Continue draft' : 'New item'}
              </span>
              <Kbd className="ml-1 hidden bg-primary-foreground/15 text-primary-foreground @min-[56rem]/toolbar:inline-flex">
                Ctrl+N
              </Kbd>
              {hasDraft ? (
                <span className="size-1.5 rounded-full bg-primary-foreground" aria-hidden="true" />
              ) : null}
            </Button>
            {hasDraft ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      className="rounded-xl"
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
      <WindowControls />
    </header>
  )
}
