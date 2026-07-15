import { LayoutGrid, PanelLeftOpen, Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { WindowControls } from '@/features/shell/window-controls'

function ShellSidebarTrigger({
  sidebarHidden
}: {
  sidebarHidden: boolean
}): React.JSX.Element | null {
  const { isMobile } = useSidebar()
  if (!sidebarHidden && !isMobile) return null

  return (
    <div className="window-no-drag">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarTrigger aria-label="Show sidebar">
              <PanelLeftOpen aria-hidden="true" />
            </SidebarTrigger>
          }
        />
        <TooltipContent>Show sidebar</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function AppToolbar({
  sidebarHidden,
  search,
  onSearchChange
}: {
  sidebarHidden: boolean
  search: string
  onSearchChange: (value: string) => void
}): React.JSX.Element {
  return (
    <header className="window-drag flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
      <ShellSidebarTrigger sidebarHidden={sidebarHidden} />
      <div className="window-no-drag relative min-w-0 max-w-xl flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="h-9 border-0 pl-9"
          type="search"
          name="search"
          autoComplete="off"
          placeholder="Search Inbox…"
          aria-label="Search Inbox"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className="window-no-drag ml-auto flex items-center gap-1">
        <ToggleGroup value={['visual']} aria-label="View selection" spacing={0}>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  className="h-10 min-w-10"
                  value="visual"
                  variant="outline"
                  aria-label="Visual view"
                >
                  <LayoutGrid data-icon="inline-start" aria-hidden="true" />
                  <span className="toolbar-label">Visual</span>
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
