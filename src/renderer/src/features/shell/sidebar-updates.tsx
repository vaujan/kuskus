import { IconLoader2, IconRefresh } from '@tabler/icons-react'
import { useAppUpdates } from '@/hooks/use-app-updates'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from './app-sidebar'

export function SidebarUpdates(): React.JSX.Element | null {
  const { status, busy, message, label, act } = useAppUpdates()
  if (status.phase !== 'ready' && status.phase !== 'installing') return null

  const Icon = busy ? IconLoader2 : IconRefresh

  return (
    <SidebarMenu aria-label="App updates">
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-label={label}
          aria-busy={busy}
          disabled={busy}
          tooltip={message}
          title={message}
          onClick={() => void act()}
        >
          <Icon aria-hidden="true" className={busy ? 'motion-safe:animate-spin' : undefined} />
          <span>{label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
