import type { ComponentProps } from 'react'

import { Card, CardFooter } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function ItemCard({
  className,
  presentation = 'preview',
  ...props
}: ComponentProps<typeof Card> & {
  presentation?: 'preview' | 'list'
}): React.JSX.Element {
  return (
    <Card
      size="sm"
      className={cn(
        'group/item-card relative min-h-0 gap-0 py-0',
        presentation === 'preview' &&
          'overflow-visible rounded-none bg-transparent shadow-none ring-0',
        presentation === 'list' &&
          'overflow-hidden rounded-2xl bg-card shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04)] ring-0 transition-[box-shadow,background-color] duration-150 ease-out hover:bg-card/95 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.08),0_8px_20px_-8px_rgba(0,0,0,0.14)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.14)]',
        className
      )}
      {...props}
    />
  )
}

export function ItemCardPrimaryAction({
  className,
  focusSurface = false,
  ...props
}: ComponentProps<'button'> & {
  focusSurface?: boolean
}): React.JSX.Element {
  return (
    <button
      className={cn(
        'peer absolute inset-0 z-20 cursor-pointer rounded-[inherit] outline-none disabled:cursor-default',
        focusSurface
          ? 'focus-visible:ring-0'
          : 'transition-transform duration-150 ease-out active:scale-[0.96] focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/60 disabled:active:scale-100',
        className
      )}
      type="button"
      {...props}
    />
  )
}

export function ItemCardSurface({ className, ...props }: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      data-slot="item-card-surface"
      className={cn(
        'relative overflow-hidden rounded-lg bg-card shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04)] ring-inset transition-[scale,box-shadow,background-color] duration-150 ease-out group-hover/item-card:bg-card/95 group-hover/item-card:shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.08),0_8px_20px_-8px_rgba(0,0,0,0.14)] peer-focus-visible:ring-3 peer-focus-visible:ring-ring/60 peer-active:scale-[0.96] peer-disabled:scale-100 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] dark:group-hover/item-card:shadow-[0_0_0_1px_rgba(255,255,255,0.14)]',
        className
      )}
      {...props}
    />
  )
}

export function ItemCardCaption({
  className,
  ...props
}: ComponentProps<typeof CardFooter>): React.JSX.Element {
  return (
    <CardFooter
      data-slot="item-card-caption"
      className={cn(
        'pointer-events-none min-h-10 gap-2 px-1 pt-2 pb-0 text-xs text-muted-foreground',
        className
      )}
      {...props}
    />
  )
}

export function ItemCardFooter({
  className,
  ...props
}: ComponentProps<typeof CardFooter>): React.JSX.Element {
  return (
    <CardFooter
      className={cn('relative z-10 min-h-10 gap-2 px-3 py-2.5 text-xs', className)}
      {...props}
    />
  )
}
