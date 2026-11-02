import { IconDownload, IconLoader2, IconRefresh } from '@tabler/icons-react'
import { useAppUpdates } from '@/hooks/use-app-updates'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from './app-sidebar'

export function SidebarUpdates(): React.JSX.Element | null {
  const { status, busy, message, label, act } = useAppUpdates()
  if (!['available', 'downloading', 'ready', 'installing', 'error'].includes(status.phase)) {
    return null
  }

  const Icon = busy ? IconLoader2 : status.phase === 'available' ? IconDownload : IconRefresh
  const buttonLabel =
    status.phase === 'downloading'
      ? `Downloading… ${Math.floor(status.percent ?? 0)}%`
      : status.phase === 'error'
        ? 'Retry update'
        : label

  return (
    <SidebarMenu aria-label="App updates">
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-label={buttonLabel}
          aria-busy={busy}
          disabled={busy}
          tooltip={message}
          title={message}
          onClick={() => void act()}
        >
          <Icon aria-hidden="true" className={busy ? 'motion-safe:animate-spin' : undefined} />
          <span className="tabular-nums">{buttonLabel}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
