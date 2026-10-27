import { runDevReloadAction, type DevReloadAction } from './dev-menu-actions'
import { useState } from 'react'
import { IconCode } from '@tabler/icons-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from './app-sidebar'

export function DevMenu({
  resetBlocked,
  beforeReload
}: {
  resetBlocked: boolean
  beforeReload: () => Promise<boolean>
}): React.JSX.Element {
  const [busy, setBusy] = useState(false)

  async function reload(action: DevReloadAction): Promise<void> {
    setBusy(true)
    try {
      await runDevReloadAction(action, beforeReload)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not complete development action.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton tooltip="Development" disabled={busy} />}>
            <IconCode aria-hidden="true" />
            <span>Development</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Development tools</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={resetBlocked || busy}
                onClick={() => void reload('reset-onboarding')}
              >
                Reset onboarding (keep library files)
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={resetBlocked || busy}
                onClick={() => void reload('reset-preferences')}
              >
                Reset UI preferences
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={resetBlocked || busy}
                onClick={() => void reload('reload')}
              >
                Reload app
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  void window.electron.window
                    .devAction?.('devtools')
                    .catch(() => toast.error('Could not open DevTools.'))
                }}
              >
                Toggle DevTools
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
