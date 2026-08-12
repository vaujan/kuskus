import { cn } from '@/lib/utils'

export function ExternalDropShadow({
  active,
  label,
  overlay = false,
  className
}: {
  active: boolean
  label: string
  overlay?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={active ? label : undefined}
      aria-hidden={!active}
      data-active={active}
      className={cn(
        'pointer-events-none z-30 rounded-sm bg-card/70 opacity-0 transition-opacity [transition-duration:var(--motion-duration-press)] [transition-timing-function:var(--motion-ease-out)] data-[active=true]:opacity-100',
        overlay && 'absolute inset-0 h-full',
        'min-h-44',
        overlay && 'min-h-full bg-card',
        className
      )}
    />
  )
}
