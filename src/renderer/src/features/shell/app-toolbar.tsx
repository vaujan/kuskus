import { LayoutGrid, Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { WindowControls } from '@/features/shell/window-controls'

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
  onSearchChange
}: {
  search: string
  onSearchChange: (value: string) => void
}): React.JSX.Element {
  return (
    <header className="flex h-12 shrink-0 select-none items-center gap-2 bg-background pl-4 [-webkit-app-region:drag]">
      <ShellSidebarTrigger />
      <div className="relative min-w-0 max-w-xl flex-1 [-webkit-app-region:no-drag]">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50"
          aria-hidden="true"
        />
        <Input
          className="h-8 border-0 pl-9"
          type="search"
          name="search"
          autoComplete="off"
          placeholder="Search Inbox…"
          aria-label="Search Inbox"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className="ml-auto flex items-center gap-1 [-webkit-app-region:no-drag]">
        <ToggleGroup value={['visual']} aria-label="View selection" spacing={0}>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  className="min-w-10"
                  value="visual"
                  aria-label="Visual view"
                  size={'sm'}
                >
                  <LayoutGrid data-icon="inline-start" aria-hidden="true" />
                  <span className="hidden md:inline">Visual</span>
                </ToggleGroupItem>
              }
            />
            <TooltipContent>Visual view</TooltipContent>
          </Tooltip>
        </ToggleGroup>
      </div>
      <WindowControls />
    </header>
  )
}
