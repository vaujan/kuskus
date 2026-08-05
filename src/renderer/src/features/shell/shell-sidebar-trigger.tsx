import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function ShellSidebarTrigger(): React.JSX.Element {
  const { isMobile, openMobile, state } = useSidebar()
  const isOpen = isMobile ? openMobile : state === 'expanded'
  const label = isOpen ? 'Hide sidebar' : 'Show sidebar'

  return (
    <div className="[-webkit-app-region:no-drag]">
      <Tooltip>
        <TooltipTrigger render={<SidebarTrigger className="size-10" aria-label={label} />} />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </div>
  )
}
