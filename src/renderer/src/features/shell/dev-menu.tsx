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

export function DevMenu({ resetBlocked }: { resetBlocked: boolean }): React.JSX.Element {
  const [busy, setBusy] = useState(false)

  async function resetOnboarding(): Promise<void> {
    setBusy(true)
    try {
      if (await window.electron.window.devAction?.('reset-onboarding')) window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reset onboarding.')
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
              <DropdownMenuItem disabled={resetBlocked} onClick={() => void resetOnboarding()}>
                Reset onboarding (keep library files)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  localStorage.clear()
                  window.location.reload()
                }}
              >
                Reset UI preferences
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.reload()}>
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
