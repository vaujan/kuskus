import { Button } from '@/components/ui/button'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { useAppUpdates } from '@/hooks/use-app-updates'

export function AppUpdates(): React.JSX.Element {
  const { status, busy, message, label, act } = useAppUpdates()

  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel>App updates</FieldLabel>
        <FieldDescription role="status" className="tabular-nums">
          {message}
        </FieldDescription>
      </FieldContent>
      <Button
        variant="outline"
        disabled={busy || status.phase === 'unavailable'}
        onClick={() => void act()}
      >
        {label}
      </Button>
    </Field>
  )
}
