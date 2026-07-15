import { Spinner } from '@/components/ui/spinner'

export function LoadingScreen(): React.JSX.Element {
  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Spinner aria-label="Opening Kuskus" />
        Opening Kuskus…
      </div>
    </div>
  )
}
