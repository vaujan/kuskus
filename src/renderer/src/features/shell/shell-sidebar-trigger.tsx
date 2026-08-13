import { SidebarTrigger, useSidebar } from '@/features/shell/app-sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function ShellSidebarTrigger(): React.JSX.Element {
  const { isMobile, openMobile, state } = useSidebar()
  const isOpen = isMobile ? openMobile : state === 'expanded'
  const label = isOpen ? 'Hide sidebar' : 'Show sidebar'

  return (
    <div className="[-webkit-app-region:no-drag]">
      <Tooltip>
        <TooltipTrigger render={<SidebarTrigger size="icon-sm" aria-label={label} />} />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </div>
  )
}
