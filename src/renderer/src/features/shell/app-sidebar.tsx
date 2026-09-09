import * as React from 'react'
import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { IconLayoutSidebar } from '@tabler/icons-react'

const SIDEBAR_WIDTH = '16rem'
const SIDEBAR_MIN_WIDTH = 208
const SIDEBAR_MAX_WIDTH = 384
const SIDEBAR_KEYBOARD_SHORTCUT = 'b'
const SIDEBAR_NARROW_QUERY = '(max-width: 767px)'
const SIDEBAR_OVERLAY_QUERY = '(min-width: 768px) and (max-width: 1023px)'

type SidebarState = 'expanded' | 'collapsed' | 'narrow'

type SidebarContextProps = {
  state: SidebarState
  open: boolean
  setOpen: (open: boolean) => void
  isNarrow: boolean
  isOverlay: boolean
  flyoutOpen: boolean
  toggleSidebar: () => void
  width: number
  setWidth: (width: number) => void
  minWidth: number
  maxWidth: number
  isResizing: boolean
  setIsResizing: (isResizing: boolean) => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.')
  }

  return context
}

function SidebarProvider({
  defaultOpen = true,
  defaultWidth = Number.parseFloat(SIDEBAR_WIDTH) * 16,
  keyboardShortcutEnabled = true,
  open: openProp,
  onOpenChange: setOpenProp,
  width: widthProp,
  onWidthChange: setWidthProp,
  minWidth = SIDEBAR_MIN_WIDTH,
  maxWidth = SIDEBAR_MAX_WIDTH,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  defaultOpen?: boolean
  defaultWidth?: number
  keyboardShortcutEnabled?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  width?: number
  onWidthChange?: (width: number) => void
  minWidth?: number
  maxWidth?: number
}) {
  const [isNarrow, setIsNarrow] = React.useState(false)
  const [isOverlay, setIsOverlay] = React.useState(false)
  const [flyoutOpen, setFlyoutOpen] = React.useState(false)
  const [_width, _setWidth] = React.useState(defaultWidth)
  const [isResizing, setIsResizing] = React.useState(false)
  const width = Math.min(maxWidth, Math.max(minWidth, widthProp ?? _width))
  const setWidth = React.useCallback(
    (nextWidth: number) => {
      const boundedWidth = Math.min(maxWidth, Math.max(minWidth, nextWidth))
      if (setWidthProp) setWidthProp(boundedWidth)
      else _setWidth(boundedWidth)
    },
    [maxWidth, minWidth, setWidthProp]
  )

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === 'function' ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }

      // Note: no persistence here; visibility state is owned by the workspace.
    },
    [setOpenProp, open]
  )

  // Narrow windows get a persistent icon rail and medium windows a hover
  // overlay; both reveal the full sidebar without shifting the layout.
  React.useEffect(() => {
    const narrowQuery = window.matchMedia(SIDEBAR_NARROW_QUERY)
    const overlayQuery = window.matchMedia(SIDEBAR_OVERLAY_QUERY)
    const update = (): void => {
      setIsNarrow(narrowQuery.matches)
      setIsOverlay(overlayQuery.matches)
      setFlyoutOpen(false)
    }
    update()
    narrowQuery.addEventListener('change', update)
    overlayQuery.addEventListener('change', update)
    return () => {
      narrowQuery.removeEventListener('change', update)
      overlayQuery.removeEventListener('change', update)
    }
  }, [])

  // Helper to toggle the sidebar. Narrow and overlay modes are click-driven
  // flyouts; wide windows toggle the in-flow sidebar.
  const toggleSidebar = React.useCallback(() => {
    if (isNarrow || isOverlay) {
      setFlyoutOpen((value) => !value)
      return
    }
    setFlyoutOpen(false)
    setOpen(!open)
  }, [isNarrow, isOverlay, setOpen, open])

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!keyboardShortcutEnabled || event.defaultPrevented) return
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [keyboardShortcutEnabled, toggleSidebar])

  // Narrow windows hide the sidebar entirely until toggled; the flyout is
  // reported as expanded so labels, folders, badges, and footer actions show.
  const restingState: SidebarState = open ? (isNarrow ? 'narrow' : 'expanded') : 'collapsed'
  const state: SidebarState = flyoutOpen ? 'expanded' : restingState

  // Escape or a click outside the flyout closes it.
  React.useEffect(() => {
    if (!flyoutOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFlyoutOpen(false)
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest('[data-slot="sidebar-container"], [data-slot="sidebar-trigger"]')) {
        return
      }
      setFlyoutOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [flyoutOpen])

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isNarrow,
      isOverlay,
      flyoutOpen,
      toggleSidebar,
      width,
      setWidth,
      minWidth,
      maxWidth,
      isResizing,
      setIsResizing
    }),
    [
      state,
      open,
      setOpen,
      isNarrow,
      isOverlay,
      flyoutOpen,
      toggleSidebar,
      width,
      setWidth,
      minWidth,
      maxWidth,
      isResizing
    ]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        data-resizing={isResizing}
        style={
          {
            '--sidebar-width': `${width}px`,
            ...style
          } as React.CSSProperties
        }
        className={cn(
          'group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

function Sidebar({
  side = 'left',
  variant = 'sidebar',
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  side?: 'left' | 'right'
  variant?: 'sidebar' | 'floating' | 'inset'
}) {
  const { state, isNarrow, isOverlay, flyoutOpen, toggleSidebar } = useSidebar()

  // The sidebar floats over the content as a flyout in narrow and overlay
  // modes, or when a collapsed wide-window sidebar is click-revealed.
  const flyout = flyoutOpen && (state !== 'expanded' || isNarrow || isOverlay)

  return (
    <div
      className="group peer text-sidebar-foreground"
      data-state={state}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      {/* Gap that reserves space beside the sidebar. It collapses to zero when
          the sidebar is hidden (collapsed or flyout-only narrow/overlay modes)
          so the sidebar never shifts the layout as an icon rail. */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          'relative w-(--sidebar-width) bg-transparent transition-[width] duration-350 ease-out',
          'group-data-[side=right]:rotate-180',
          state === 'collapsed' && !flyout && 'w-0',
          (isNarrow || isOverlay) && 'w-0'
        )}
      />
      {flyout ? (
        <button
          type="button"
          data-slot="sidebar-backdrop"
          className="fixed inset-0 z-[60] cursor-default bg-foreground/10 backdrop-blur-[1px] [-webkit-app-region:no-drag] motion-reduce:backdrop-blur-none"
          aria-label="Close sidebar"
          onClick={toggleSidebar}
        />
      ) : null}
      <div
        data-slot="sidebar-container"
        data-side={side}
        className={cn(
          'fixed inset-y-0 z-10 flex h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-out data-[side=left]:left-0 data-[side=right]:right-0',
          // Hidden offcanvas when collapsed (but not while the flyout is open).
          state === 'collapsed' &&
            !flyout &&
            'data-[side=left]:left-[calc(var(--sidebar-width)*-1)] data-[side=right]:right-[calc(var(--sidebar-width)*-1)]',
          // Narrow and overlay modes stay off-canvas until toggled; both
          // reveal the full sidebar as an overlay flyout instead of a rail.
          (isNarrow || isOverlay) &&
            !flyout &&
            'data-[side=left]:left-[calc(var(--sidebar-width)*-1)] data-[side=right]:right-[calc(var(--sidebar-width)*-1)]',
          flyout &&
            'z-[70] w-(--sidebar-width) shadow-[0_24px_64px_-20px_rgb(0_0_0/0.45),0_0_0_1px_color-mix(in_oklch,var(--sidebar-border)_80%,transparent)]',
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="flex size-full flex-col overflow-hidden bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      className={cn('text-muted-foreground', className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <IconLayoutSidebar />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
}

function SidebarRail({ className, ...props }: React.ComponentProps<'div'>) {
  const { width, setWidth, minWidth, maxWidth, isResizing, setIsResizing } = useSidebar()
  const dragState = React.useRef<{
    pointerId: number
    startX: number
    startWidth: number
    side: 'left' | 'right'
  } | null>(null)

  const resizeBy = React.useCallback((delta: number) => setWidth(width + delta), [setWidth, width])

  return (
    <div
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      aria-valuemax={maxWidth}
      aria-valuemin={minWidth}
      aria-valuenow={Math.round(width)}
      aria-valuetext={`${Math.round(width)} pixels`}
      role="separator"
      tabIndex={0}
      title="Drag to resize sidebar"
      onKeyDown={(event) => {
        const side = event.currentTarget.closest('[data-side="right"]') ? 'right' : 'left'
        const direction = side === 'right' ? -1 : 1
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          resizeBy(-16 * direction)
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          resizeBy(16 * direction)
        } else if (event.key === 'Home') {
          event.preventDefault()
          setWidth(minWidth)
        } else if (event.key === 'End') {
          event.preventDefault()
          setWidth(maxWidth)
        }
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        const side = event.currentTarget.closest('[data-side="right"]') ? 'right' : 'left'
        dragState.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth: width,
          side
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        setIsResizing(true)
        event.preventDefault()
      }}
      onPointerMove={(event) => {
        const drag = dragState.current
        if (!drag || drag.pointerId !== event.pointerId) return
        const direction = drag.side === 'right' ? -1 : 1
        setWidth(drag.startWidth + (event.clientX - drag.startX) * direction)
      }}
      onPointerUp={(event) => {
        if (dragState.current?.pointerId !== event.pointerId) return
        dragState.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
        setIsResizing(false)
      }}
      onPointerCancel={() => {
        dragState.current = null
        setIsResizing(false)
      }}
      className={cn(
        'absolute inset-y-0 z-20 hidden w-4 touch-none cursor-col-resize outline-none [-webkit-app-region:no-drag] group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:start-1/2 after:w-[2px] after:bg-sidebar-ring after:opacity-0 hover:after:opacity-60 focus-visible:after:opacity-100 sm:flex ltr:-translate-x-1/2 rtl:-translate-x-1/2',
        isResizing && 'after:opacity-100',
        'group-data-[state=narrow]:hidden',
        className
      )}
      {...props}
    />
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<'main'>) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        'relative flex w-full flex-1 flex-col bg-background md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2',
        className
      )}
      {...props}
    />
  )
}

function SidebarInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn('h-8 w-full bg-background shadow-none', className)}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  )
}

function SidebarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn('mx-2 w-auto bg-sidebar-border', className)}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        'no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[state=narrow]:overflow-hidden',
        className
      )}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn('relative flex w-full min-w-0 flex-col p-2', className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({
  className,
  render,
  ...props
}: useRender.ComponentProps<'div'> & React.ComponentProps<'div'>) {
  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(
      {
        className: cn(
          'flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-200 ease-linear group-data-[state=narrow]:-mt-8 group-data-[state=narrow]:opacity-0 focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
          className
        )
      },
      props
    ),
    render,
    state: {
      slot: 'sidebar-group-label',
      sidebar: 'group-label'
    }
  })
}

function SidebarGroupAction({
  className,
  render,
  ...props
}: useRender.ComponentProps<'button'> & React.ComponentProps<'button'>) {
  return useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(
      {
        className: cn(
          'absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform group-data-[state=narrow]:hidden after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0',
          className
        )
      },
      props
    ),
    render,
    state: {
      slot: 'sidebar-group-action',
      sidebar: 'group-action'
    }
  })
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn('w-full text-sm', className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn('flex w-full min-w-0 flex-col gap-1', className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn('group/menu-item relative', className)}
      {...props}
    />
  )
}

const sidebarMenuButtonVariants = cva(
  'peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding,background-color,color,box-shadow] group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[state=narrow]:size-10! group-data-[state=narrow]:p-3! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-open:hover:bg-sidebar-accent data-open:hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate',
  {
    variants: {
      variant: {
        default: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        outline:
          'bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]'
      },
      size: {
        default: 'h-8 text-sm',
        sm: 'h-7 text-xs',
        lg: 'h-12 text-sm group-data-[state=narrow]:p-0!'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

function SidebarMenuButton({
  render,
  isActive = false,
  variant = 'default',
  size = 'default',
  tooltip,
  className,
  ...props
}: useRender.ComponentProps<'button'> &
  React.ComponentProps<'button'> & {
    isActive?: boolean
    tooltip?: string | React.ComponentProps<typeof TooltipContent>
  } & VariantProps<typeof sidebarMenuButtonVariants>) {
  const { state } = useSidebar()
  const comp = useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(
      {
        className: cn(sidebarMenuButtonVariants({ variant, size }), className)
      },
      props
    ),
    render: !tooltip ? render : <TooltipTrigger render={render} />,
    state: {
      slot: 'sidebar-menu-button',
      sidebar: 'menu-button',
      size,
      active: isActive
    }
  })

  if (!tooltip) {
    return comp
  }

  if (typeof tooltip === 'string') {
    tooltip = {
      children: tooltip
    }
  }

  return (
    <Tooltip>
      {comp}
      <TooltipContent side="right" align="center" hidden={state !== 'narrow'} {...tooltip} />
    </Tooltip>
  )
}

function SidebarMenuAction({
  className,
  render,
  showOnHover = false,
  ...props
}: useRender.ComponentProps<'button'> &
  React.ComponentProps<'button'> & {
    showOnHover?: boolean
  }) {
  return useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(
      {
        className: cn(
          'absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform group-data-[state=narrow]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0',
          showOnHover &&
            'group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-active/menu-button:text-sidebar-accent-foreground aria-expanded:opacity-100 md:opacity-0',
          className
        )
      },
      props
    ),
    render,
    state: {
      slot: 'sidebar-menu-action',
      sidebar: 'menu-action'
    }
  })
}

function SidebarMenuBadge({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        'pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium text-sidebar-foreground tabular-nums select-none group-data-[state=narrow]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 peer-data-active/menu-button:text-sidebar-accent-foreground',
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<'div'> & {
  showIcon?: boolean
}) {
  // Random width between 50 to 90%.
  const [width] = React.useState(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  })

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn('flex h-8 items-center gap-2 rounded-md px-2', className)}
      {...props}
    >
      {showIcon && <Skeleton className="size-4 rounded-md" data-sidebar="menu-skeleton-icon" />}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            '--skeleton-width': width
          } as React.CSSProperties
        }
      />
    </div>
  )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        'mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5 group-data-[state=narrow]:hidden',
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn('group/menu-sub-item relative', className)}
      {...props}
    />
  )
}

function SidebarMenuSubButton({
  render,
  size = 'md',
  isActive = false,
  className,
  ...props
}: useRender.ComponentProps<'a'> &
  React.ComponentProps<'a'> & {
    size?: 'sm' | 'md'
    isActive?: boolean
  }) {
  return useRender({
    defaultTagName: 'a',
    props: mergeProps<'a'>(
      {
        className: cn(
          'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground ring-sidebar-ring outline-hidden group-data-[state=narrow]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[size=md]:text-sm data-[size=sm]:text-xs data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground',
          className
        )
      },
      props
    ),
    render,
    state: {
      slot: 'sidebar-menu-sub-button',
      sidebar: 'menu-sub-button',
      size,
      active: isActive
    }
  })
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar
}
