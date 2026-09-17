import { Menubar as MenubarPrimitive } from '@base-ui/react/menubar'
import type * as React from 'react'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

function Menubar({ className, ...props }: MenubarPrimitive.Props): React.JSX.Element {
  return (
    <MenubarPrimitive
      data-slot="menubar"
      className={cn('flex h-9 items-center rounded-xl border p-1', className)}
      {...props}
    />
  )
}

function MenubarMenu(props: React.ComponentProps<typeof DropdownMenu>): React.JSX.Element {
  return <DropdownMenu data-slot="menubar-menu" {...props} />
}

function MenubarTrigger({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuTrigger>): React.JSX.Element {
  return (
    <DropdownMenuTrigger
      data-slot="menubar-trigger"
      className={cn(
        'flex items-center rounded-lg px-2 py-1 text-sm font-medium outline-none select-none hover:bg-muted aria-expanded:bg-muted',
        className
      )}
      {...props}
    />
  )
}

function MenubarContent(
  props: React.ComponentProps<typeof DropdownMenuContent>
): React.JSX.Element {
  return <DropdownMenuContent data-slot="menubar-content" {...props} />
}

const MenubarGroup = DropdownMenuGroup
const MenubarItem = DropdownMenuItem
const MenubarCheckboxItem = DropdownMenuCheckboxItem
const MenubarRadioGroup = DropdownMenuRadioGroup
const MenubarRadioItem = DropdownMenuRadioItem
const MenubarSeparator = DropdownMenuSeparator
const MenubarShortcut = DropdownMenuShortcut

export {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger
}
