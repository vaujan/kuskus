import { useEffect, useRef } from 'react'
import {
  IconAdjustmentsHorizontal,
  IconFileText,
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
import { ITEM_TYPE_FILTERS, type ItemTypeFilter } from '@/features/items/item-view'
import { WindowControls } from '@/features/shell/window-controls'
import { cn } from '@/lib/utils'

const TYPE_OPTIONS: Record<ItemTypeFilter, { label: string; icon: TablerIcon }> = {
  note: { label: 'Notes', icon: IconFileText },
  image: { label: 'Images', icon: IconPhoto },
  url: { label: 'Links', icon: IconLink }
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
  onClearFilters
}: {
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
  onClearFilters: () => void
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
      const key = event.key.toLocaleLowerCase()
      if ((event.ctrlKey || event.metaKey) && (key === 'k' || key === 'f')) {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  useEffect(() => {
    if (newItemFocusRequest > 0) newItemRef.current?.focus()
  }, [newItemFocusRequest])

  return (
    <header className="flex h-12 shrink-0 select-none items-center bg-background [-webkit-app-region:drag]">
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(2rem,1fr)_minmax(16rem,40rem)_minmax(2rem,1fr)] items-center gap-2 px-5 lg:px-7">
        <div className="flex justify-start">
          <ShellSidebarTrigger />
        </div>

        <div className="flex min-w-0 items-center gap-1 [-webkit-app-region:no-drag]">
          <InputGroup className="h-8 min-w-0 flex-1 border-transparent transition-[background-color,box-shadow] duration-200 hover:bg-muted/80 has-[[data-slot=input-group-control]:focus-visible]:bg-background has-[[data-slot=input-group-control]:focus-visible]:shadow-[inset_0_0_0_1px_var(--ring),0_4px_14px_rgb(0_0_0/0.08)] has-[[data-slot=input-group-control]:focus-visible]:ring-0">
            <InputGroupInput
              ref={searchRef}
              className="h-8 min-w-0 text-sm [&::-webkit-search-cancel-button]:hidden md:text-sm"
              type="search"
              name="search"
              aria-keyshortcuts="Control+K Meta+K Control+F Meta+F"
              autoComplete="off"
              placeholder={`Search ${searchScope}…`}
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
            <InputGroupAddon align="inline-start" className="pl-2.5">
              <IconSearch aria-hidden="true" />
              <span className="sr-only">Search {searchScope}</span>
            </InputGroupAddon>
            <InputGroupAddon align="inline-end" className="gap-2 pr-1.5">
              <span
                className="hidden max-w-28 truncate text-[0.6875rem] font-normal tabular-nums text-muted-foreground min-[900px]:inline"
                aria-live="polite"
                aria-atomic="true"
              >
                {hasSearch ? searchStatus : ''}
              </span>
              <span className="relative flex h-6 w-6 shrink-0 items-center justify-end min-[760px]:w-14">
                <Kbd
                  className={cn(
                    'absolute right-0 hidden transition-[opacity,filter,scale] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)] min-[760px]:inline-flex',
                    hasSearch ? 'scale-[0.25] opacity-0 blur-[4px]' : 'scale-100 opacity-100 blur-0'
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
                    "absolute right-0 transition-[opacity,filter,scale] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)] after:absolute after:-inset-2 after:content-[''] active:scale-[0.96]",
                    hasSearch
                      ? 'scale-100 opacity-100 blur-0'
                      : 'pointer-events-none scale-[0.25] opacity-0 blur-[4px]'
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
                  variant={typeFilters.length > 0 ? 'secondary' : 'ghost'}
                  aria-label={`Filter ${searchScope} by item type`}
                />
              }
            >
              <IconAdjustmentsHorizontal data-icon="inline-start" aria-hidden="true" />
              <span className="hidden min-[900px]:inline">Filter</span>
              {typeFilters.length > 0 ? (
                <Badge variant="secondary" className="tabular-nums">
                  {typeFilters.length}
                </Badge>
              ) : null}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
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
              {typeFilters.length > 0 ? (
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

        <div className="flex min-w-0 items-center justify-end gap-1 [-webkit-app-region:no-drag]">
          <Button
            ref={newItemRef}
            data-new-item-button
            aria-expanded={newItemOpen}
            aria-label={hasDraft && !newItemOpen ? 'Continue New item draft' : 'Create new item'}
            onClick={onNewItem}
          >
            <IconPlus data-icon="inline-start" aria-hidden="true" />
            <span className="hidden min-[720px]:inline">
              {hasDraft && !newItemOpen ? 'Continue draft' : 'New item'}
            </span>
            {hasDraft ? (
              <span className="size-1.5 rounded-full bg-primary-foreground" aria-hidden="true" />
            ) : null}
          </Button>
          {hasDraft ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    className="rounded-xl active:scale-[0.96] transition-transform"
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
      <WindowControls />
    </header>
  )
}
