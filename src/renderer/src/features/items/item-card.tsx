import type { ComponentProps } from 'react'

import { Card, CardFooter } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function ItemCard({ className, ...props }: ComponentProps<typeof Card>): React.JSX.Element {
  return (
    <Card className={cn('item-card relative min-h-0 overflow-hidden py-0', className)} {...props} />
  )
}

export function ItemCardPrimaryAction({
  className,
  ...props
}: ComponentProps<'button'>): React.JSX.Element {
  return (
    <button
      className={cn('item-card-primary absolute inset-0 rounded-[inherit] outline-none', className)}
      type="button"
      {...props}
    />
  )
}

export function ItemCardFooter({
  className,
  ...props
}: ComponentProps<typeof CardFooter>): React.JSX.Element {
  return <CardFooter className={cn('relative z-10 py-2', className)} {...props} />
}
