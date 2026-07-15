import type { ComponentProps } from 'react'

import { Card, CardFooter } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function ItemCard({ className, ...props }: ComponentProps<typeof Card>): React.JSX.Element {
  return (
    <Card size="sm" className={cn('relative min-h-0 max-h-[28rem] py-0', className)} {...props} />
  )
}

export function ItemCardPrimaryAction({
  className,
  ...props
}: ComponentProps<'button'>): React.JSX.Element {
  return (
    <button
      className={cn(
        'absolute inset-0 rounded-[inherit] outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 disabled:cursor-default',
        className
      )}
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
