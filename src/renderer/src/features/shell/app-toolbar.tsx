import { useEffect, useRef } from 'react'
import {
  IconAdjustmentsHorizontal,
  IconFileText,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconLink,
  IconList,
  IconPhoto,
  IconSearch,
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
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ITEM_TYPE_FILTERS,
  type ItemTypeFilter,
  type LibraryView
} from '@/features/items/item-view'
import { WindowControls } from '@/features/shell/window-controls'
import { cn } from '@/lib/utils'

const VIEW_OPTIONS: Array<{ value: LibraryView; label: string; icon: TablerIcon }> = [
  { value: 'visual', label: 'Visual', icon: IconLayoutDashboard },
  { value: 'grid', label: 'Grid', icon: IconLayoutGrid },
  { value: 'list', label: 'List', icon: IconList }
]

const TYPE_OPTIONS: Record<ItemTypeFilter, { label: string; icon: TablerIcon }> = {
  note: { label: 'Notes', icon: IconFileText },
  image: { label: 'Images', icon: IconPhoto },
  url: { label: 'Links', icon: IconLink }
}

function ShellSidebarTrigger(): React.JSX.Element {
  return (
    <div className="[-webkit-app-region:no-drag]">
      <Tooltip>
        <TooltipTrigger render={<SidebarTrigger aria-label="Toggle sidebar" />} />
        <TooltipContent>Toggle sidebar</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function AppToolbar({
  search,
  onSearchChange,
  searchPending,
  resultCount,
  totalCount,
  view,
  onViewChange,
  typeFilters,
  onTypeFilterChange,
  onClearFilters
}: {
  search: string
  onSearchChange: (value: string) => void
  searchPending: boolean
  resultCount: number
  totalCount: number
  view: LibraryView
  onViewChange: (value: LibraryView) => void
  typeFilters: ItemTypeFilter[]
  onTypeFilterChange: (type: ItemTypeFilter, selected: boolean) => void
  onClearFilters: () => void
}): React.JSX.Element {
  const searchRef = useRef<HTMLInputElement>(null)
  const activeView = VIEW_OPTIONS.find((option) => option.value === view) ?? VIEW_OPTIONS[0]
  const ActiveViewIcon = activeView.icon
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

  return (
    <header className="flex h-12 shrink-0 select-none items-center gap-2 bg-background pl-4 [-webkit-app-region:drag]">
      <ShellSidebarTrigger />
      <div className="min-w-36 max-w-xl flex-1 px-1 [-webkit-app-region:no-drag]">
        <InputGroup className="h-8 rounded-lg border-transparent bg-muted/60 shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--border)_70%,transparent),0_1px_2px_rgb(0_0_0/0.04)] transition-[background-color,box-shadow] duration-200 hover:bg-muted/80 has-[[data-slot=input-group-control]:focus-visible]:bg-background has-[[data-slot=input-group-control]:focus-visible]:shadow-[inset_0_0_0_1px_var(--ring),0_4px_14px_rgb(0_0_0/0.08)] has-[[data-slot=input-group-control]:focus-visible]:ring-0">
          <InputGroupInput
            ref={searchRef}
            className="h-8 text-sm [&::-webkit-search-cancel-button]:hidden md:text-sm"
            type="search"
            name="search"
            aria-keyshortcuts="Control+K Meta+K Control+F Meta+F"
            autoComplete="off"
            placeholder="Search titles, notes, links, and files…"
            aria-label="Search Inbox by title, note text, link, or filename"
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
            <span className="sr-only">Search Inbox</span>
          </InputGroupAddon>
          <InputGroupAddon align="inline-end" className="gap-2 pr-1.5">
            <span
              className="hidden max-w-28 truncate text-[0.6875rem] font-normal tabular-nums text-muted-foreground sm:inline"
              aria-live="polite"
              aria-atomic="true"
            >
              {hasSearch ? searchStatus : ''}
            </span>
            <span className="relative flex h-6 w-14 shrink-0 items-center justify-end">
              <KbdGroup
                className={cn(
                  'absolute right-0 transition-[opacity,filter,scale] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)]',
                  hasSearch ? 'scale-[0.25] opacity-0 blur-[4px]' : 'scale-100 opacity-100 blur-0'
                )}
                aria-hidden="true"
              >
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
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
      </div>
      <div className="ml-auto flex items-center gap-1 [-webkit-app-region:no-drag]">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant={typeFilters.length > 0 ? 'secondary' : 'ghost'}
                size="sm"
                aria-label="Filter Inbox by item type"
              />
            }
          >
            <IconAdjustmentsHorizontal data-icon="inline-start" aria-hidden="true" />
            <span className="hidden sm:inline">Filter</span>
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
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="sm" aria-label="Change view" />}
          >
            <ActiveViewIcon data-icon="inline-start" aria-hidden="true" />
            <span className="hidden md:inline">{activeView.label}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuGroup>
              <DropdownMenuLabel>View as</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={view}
                onValueChange={(value) => onViewChange(value as LibraryView)}
              >
                {VIEW_OPTIONS.map((option) => {
                  const Icon = option.icon
                  return (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      <Icon aria-hidden="true" />
                      {option.label}
                    </DropdownMenuRadioItem>
                  )
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <WindowControls />
    </header>
  )
}
