import * as React from 'react'
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { IconX } from '@tabler/icons-react'

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-sm',
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  showOverlay = true,
  variant = 'edge',
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: 'top' | 'right' | 'bottom' | 'left'
  showCloseButton?: boolean
  showOverlay?: boolean
  variant?: 'edge' | 'floating'
}) {
  return (
    <SheetPortal>
      {showOverlay ? <SheetOverlay /> : null}
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        data-variant={variant}
        className={cn(
          'fixed z-50 flex flex-col bg-popover bg-clip-padding text-sm text-popover-foreground shadow-xl transition-[translate,opacity] duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[variant=edge]:data-[side=bottom]:inset-x-0 data-[variant=edge]:data-[side=bottom]:bottom-0 data-[variant=edge]:data-[side=bottom]:h-auto data-[variant=edge]:data-[side=bottom]:border-t data-[variant=edge]:data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[variant=edge]:data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[variant=edge]:data-[side=left]:inset-y-0 data-[variant=edge]:data-[side=left]:left-0 data-[variant=edge]:data-[side=left]:h-full data-[variant=edge]:data-[side=left]:w-3/4 data-[variant=edge]:data-[side=left]:border-r data-[variant=edge]:data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[variant=edge]:data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[variant=edge]:data-[side=right]:inset-y-0 data-[variant=edge]:data-[side=right]:right-0 data-[variant=edge]:data-[side=right]:h-full data-[variant=edge]:data-[side=right]:w-3/4 data-[variant=edge]:data-[side=right]:border-l data-[variant=edge]:data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[variant=edge]:data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[variant=edge]:data-[side=top]:inset-x-0 data-[variant=edge]:data-[side=top]:top-0 data-[variant=edge]:data-[side=top]:h-auto data-[variant=edge]:data-[side=top]:border-b data-[variant=edge]:data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[variant=edge]:data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[variant=edge]:data-[side=left]:sm:max-w-sm data-[variant=edge]:data-[side=right]:sm:max-w-sm data-[variant=floating]:inset-y-3 data-[variant=floating]:right-3 data-[variant=floating]:w-[min(25rem,calc(100vw-1.5rem))] data-[variant=floating]:rounded-2xl data-[variant=floating]:ring-1 data-[variant=floating]:ring-foreground/8 data-[variant=floating]:shadow-[0_24px_80px_rgb(0_0_0/0.18),0_4px_16px_rgb(0_0_0/0.08)] data-[variant=floating]:data-ending-style:translate-x-2 data-[variant=floating]:data-starting-style:translate-x-2',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-4 right-4 bg-secondary"
                size="icon-sm"
              />
            }
          >
            <IconX />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 p-6', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 p-6', className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('font-heading text-base font-medium text-foreground', className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription
}
