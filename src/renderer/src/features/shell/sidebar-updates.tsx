import { IconDownload, IconRefresh, IconAlertTriangle } from '@tabler/icons-react'
import { useAppUpdates } from '@/hooks/use-app-updates'
import { Spinner } from '@/components/ui/spinner'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from './app-sidebar'

export function SidebarUpdates(): React.JSX.Element | null {
  const { status, busy, message, label, act } = useAppUpdates()
  if (['unavailable', 'idle', 'current'].includes(status.phase)) return null

  const actionLabel = status.phase === 'error' ? 'Retry update' : label
  const buttonLabel =
    status.phase === 'downloading'
      ? `Downloading… ${Math.floor(status.percent ?? 0)}%`
      : actionLabel
  const Icon =
    status.phase === 'ready'
      ? IconRefresh
      : status.phase === 'error'
        ? IconAlertTriangle
        : IconDownload

  return (
    <SidebarMenu aria-label="App updates">
      <SidebarMenuItem>
        <SidebarMenuButton
          disabled={busy}
          aria-disabled={busy}
          aria-label={buttonLabel}
          tooltip={message}
          title={message}
          onClick={() => void act()}
        >
          {busy ? (
            <Spinner aria-hidden="true" className="motion-reduce:animate-none" />
          ) : (
            <Icon aria-hidden="true" />
          )}
          <span className="tabular-nums" role="status">
            {buttonLabel}
          </span>
        </SidebarMenuButton>
        {status.message ? (
          <p
            role="status"
            className="px-2 py-1 text-xs text-sidebar-foreground/70 group-data-[state=narrow]:hidden"
          >
            {status.message}
          </p>
        ) : null}
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
