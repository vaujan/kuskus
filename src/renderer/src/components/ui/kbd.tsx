import { cn } from '@/lib/utils'

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex min-h-5 min-w-5 items-center justify-center rounded-md border px-1.5 py-0.5 font-sans text-xs leading-none font-medium tracking-wide whitespace-nowrap select-none [&_svg:not([class*='size-'])]:size-3",
        className
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="kbd-group"
      className={cn('inline-flex items-center gap-0.5 whitespace-nowrap', className)}
      {...props}
    />
  )
}

function ShortcutKbd({
  shortcut,
  ...props
}: Omit<React.ComponentProps<typeof KbdGroup>, 'children'> & { shortcut: string }) {
  return (
    <KbdGroup role="group" aria-label={shortcut} {...props}>
      {shortcut.split('+').map((key, index) => (
        <Kbd aria-hidden="true" key={`${key}-${index}`}>
          {key.trim()}
        </Kbd>
      ))}
    </KbdGroup>
  )
}

export { Kbd, KbdGroup, ShortcutKbd }
