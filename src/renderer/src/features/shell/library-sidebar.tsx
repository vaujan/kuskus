import { Inbox, Library, Moon, PanelLeftClose, Sun } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sidebar as AppSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Theme } from '@/hooks/use-theme'
import type { LibraryDto } from '../../../../shared/library-contract'

export function LibrarySidebar({
  library,
  theme,
  onHide,
  onToggleTheme
}: {
  library: LibraryDto
  theme: Theme
  onHide: () => void
  onToggleTheme: () => void
}): React.JSX.Element {
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <AppSidebar collapsible="offcanvas">
      <SidebarHeader className="window-no-drag">
        <div className="flex items-center gap-3 px-2 py-2">
          <Library
            className="size-8 rounded-lg bg-primary p-2 text-primary-foreground"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{library.name}</p>
            <p className="truncate text-xs text-muted-foreground">Local Library</p>
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Hide sidebar"
                  onClick={() => (isMobile ? setOpenMobile(false) : onHide())}
                >
                  <PanelLeftClose aria-hidden="true" />
                </Button>
              }
            />
            <TooltipContent>Hide sidebar</TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu aria-label="Library navigation">
              <SidebarMenuItem>
                <SidebarMenuButton isActive>
                  <Inbox aria-hidden="true" />
                  <span>Inbox</span>
                  <Badge className="ml-auto" variant="outline">
                    {library.items.length}
                  </Badge>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onToggleTheme}>
              {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </AppSidebar>
  )
}
