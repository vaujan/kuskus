import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconLoader
} from '@tabler/icons-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useEffect, useState } from 'react'

const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = useState<ToasterProps['theme']>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  )
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <IconCircleCheck />,
        info: <IconInfoCircle />,
        warning: <IconAlertTriangle />,
        error: <IconAlertOctagon />,
        loading: <IconLoader className="animate-spin motion-reduce:animate-none" />
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'calc(var(--radius) + 6px)',
          '--width': '22rem'
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            'cn-toast group/toast !flex !items-center !gap-3 !rounded-2xl !border-0 !bg-popover/88 !px-3 !py-2.5 !text-popover-foreground !shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_8px_28px_-12px_rgba(0,0,0,0.28)] !ring-1 !ring-foreground/6 !backdrop-blur-2xl dark:!shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_28px_-12px_rgba(0,0,0,0.72)]',
          content: '!flex !min-w-0 !flex-1 !flex-col !gap-0.5',
          title: '!text-[13px] !leading-4 !font-medium',
          description: '!text-xs !leading-4 !text-muted-foreground',
          icon: '!m-0 !flex !size-8 !shrink-0 !items-center !justify-center !rounded-full !bg-foreground/6 [&>svg]:!size-4 group-data-[type=success]/toast:!text-primary group-data-[type=error]/toast:!text-destructive group-data-[type=warning]/toast:!text-foreground',
          actionButton:
            '!ml-auto !h-8 !shrink-0 !rounded-xl !bg-foreground/7 !px-3 !text-xs !font-medium !text-foreground transition-[scale,background-color] [transition-duration:var(--motion-duration-press)] [transition-timing-function:var(--motion-ease-out)] hover:!bg-foreground/11 active:scale-[0.97] motion-reduce:active:scale-100',
          cancelButton:
            '!ml-auto !h-8 !shrink-0 !rounded-xl !bg-transparent !px-3 !text-xs !font-medium !text-muted-foreground transition-[scale,background-color,color] [transition-duration:var(--motion-duration-press)] [transition-timing-function:var(--motion-ease-out)] hover:!bg-foreground/7 hover:!text-foreground active:scale-[0.97] motion-reduce:active:scale-100'
        }
      }}
      {...props}
    />
  )
}

export { Toaster }
