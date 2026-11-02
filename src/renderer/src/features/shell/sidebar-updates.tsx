import { IconRefresh } from '@tabler/icons-react'
import { useAppUpdates } from '@/hooks/use-app-updates'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from './app-sidebar'

export function SidebarUpdates(): React.JSX.Element | null {
  const { status, message, act } = useAppUpdates()
  if (status.phase !== 'ready') return null

  return (
    <SidebarMenu aria-label="App updates">
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-label="Restart to update"
          tooltip={message}
          title={message}
          onClick={() => void act()}
        >
          <IconRefresh aria-hidden="true" />
          <span>Restart to update</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
