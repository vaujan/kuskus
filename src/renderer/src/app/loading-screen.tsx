import bubuntuLine from '@/assets/bubuntu-line.svg'

export function LoadingScreen(): React.JSX.Element {
  return (
    <div className="window-canvas flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <img
          src={bubuntuLine}
          alt=""
          draggable={false}
          className="pointer-events-none h-[min(50vh,24rem)] w-auto max-w-[70vw] select-none opacity-40 dark:invert"
        />
        <div
          role="progressbar"
          aria-label="Opening Kuskus"
          className="h-1 w-40 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  )
}
