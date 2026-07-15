import { useState } from 'react'
import { FolderOpen, Library, Plus } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { WindowControls } from '@/features/shell/window-controls'
import type { LibraryState } from '../../../../shared/library-contract'

function LibraryAlert({
  title,
  description
}: {
  title: string
  description: string
}): React.JSX.Element {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="break-all">{description}</AlertDescription>
    </Alert>
  )
}

export function SetupScreen({ initialState }: { initialState: LibraryState }): React.JSX.Element {
  const [name, setName] = useState('My Kuskus Library')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(
    initialState.status === 'unavailable' ? initialState.message : ''
  )

  const createLibrary = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!name.trim() || busy) return

    setBusy(true)
    setError('')
    const result = await window.kuskus.create(name)
    setBusy(false)
    if (!result.ok && result.code !== 'cancelled') setError(result.error)
    if (result.ok) window.location.reload()
  }

  const openLibrary = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError('')
    const result = await window.kuskus.open()
    setBusy(false)
    if (!result.ok && result.code !== 'cancelled') setError(result.error)
    if (result.ok) window.location.reload()
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="window-drag flex h-11 shrink-0 items-center border-b px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Library className="size-4 text-primary" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground">Kuskus</span>
        </div>
        <WindowControls />
      </header>
      <main className="flex flex-1 items-center justify-center overflow-auto p-6">
        <Card className="w-full max-w-lg">
          <CardHeader className="gap-3 border-b">
            <Library
              className="size-10 rounded-xl bg-primary p-2 text-primary-foreground"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1">
              <CardTitle>Create Your Local Library</CardTitle>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Kuskus stores readable notes and metadata in a folder you control.
              </p>
            </div>
          </CardHeader>
          <form onSubmit={createLibrary}>
            <CardContent className="py-5">
              <FieldGroup>
                {initialState.status === 'unavailable' && (
                  <LibraryAlert
                    title="Previous Library Unavailable"
                    description={initialState.path}
                  />
                )}
                <Field data-disabled={busy}>
                  <FieldLabel htmlFor="library-name">Library Name</FieldLabel>
                  <Input
                    id="library-name"
                    name="libraryName"
                    autoComplete="off"
                    value={name}
                    maxLength={80}
                    disabled={busy}
                    onChange={(event) => setName(event.target.value)}
                  />
                </Field>
                {error && <LibraryAlert title="Unable to Continue" description={error} />}
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-between gap-3 border-t">
              <Button type="button" variant="ghost" disabled={busy} onClick={openLibrary}>
                <FolderOpen data-icon="inline-start" aria-hidden="true" />
                Open Existing
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Plus data-icon="inline-start" aria-hidden="true" />
                )}
                {busy ? 'Working…' : 'Create Library'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  )
}
