import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'group/badge inline-flex w-fit shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-transparent font-medium whitespace-nowrap transition-[color,background-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a]:hover:bg-primary/80',
        secondary: 'bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80',
        destructive:
          'bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20',
        outline: 'border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground',
        ghost: 'hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50',
        link: 'text-primary underline-offset-4 hover:underline',
        note: 'bg-item-note/12 text-item-note shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--item-note)_18%,transparent)]',
        linkType:
          'bg-item-link/12 text-item-link shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--item-link)_18%,transparent)]',
        image:
          'bg-item-image/12 text-item-image shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--item-image)_18%,transparent)]',
        file: 'bg-item-file/12 text-item-file shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--item-file)_18%,transparent)]'
      },
      size: {
        default:
          'h-5 gap-1 px-2 py-0.5 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5',
        sm: 'h-4 gap-0.5 px-1.5 pt-px pb-0 text-[0.625rem] leading-none'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

function Badge({
  className,
  variant = 'default',
  size = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant, size }), className)
      },
      props
    ),
    render,
    state: {
      slot: 'badge',
      variant,
      size
    }
  })
}

export { Badge, badgeVariants }
