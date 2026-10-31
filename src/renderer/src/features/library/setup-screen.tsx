import { useState } from 'react'

import kuskusIcon from '../../../../../resources/icon.png'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { WindowControls } from '@/features/shell/window-controls'
import { dismissVaultIndexing, notifyVaultIndexingStarted } from '@/lib/notify'
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

export function SetupScreen({
  initialState,
  onLibraryChange
}: {
  initialState: LibraryState
  onLibraryChange: (state: LibraryState) => void
}): React.JSX.Element {
  const [name, setName] = useState('My Kuskus Library')
  const [step, setStep] = useState<'welcome' | 'create'>('welcome')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const createLibrary = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!name.trim() || busy) return

    setBusy(true)
    setError('')
    try {
      const result = await window.kuskus.create(name)
      if (!result.ok) {
        if (result.code !== 'cancelled') setError(result.error)
        return
      }
      onLibraryChange(result.data)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not create the library.')
    } finally {
      setBusy(false)
    }
  }

  const openLibrary = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await window.kuskus.open()
      if (!result.ok && result.code !== 'cancelled') setError(result.error)
      if (result.ok) onLibraryChange(result.data)
    } finally {
      setBusy(false)
    }
  }

  const prepareSelectedVault = async (): Promise<void> => {
    if (busy || initialState.status !== 'needs-initialization') {
      return
    }
    setBusy(true)
    setError('')
    try {
      notifyVaultIndexingStarted()
      const result = await window.kuskus.initializeVault()
      if (!result.ok) {
        dismissVaultIndexing()
        setError(result.error)
      }
      if (result.ok) onLibraryChange(result.data)
    } finally {
      setBusy(false)
    }
  }

  const needsPreparation = initialState.status === 'needs-initialization'
  const showWelcome = !needsPreparation && step === 'welcome'
  const title = needsPreparation
    ? 'Make this folder a library'
    : step === 'welcome'
      ? 'Kuskus'
      : 'Create a library'
  const description = needsPreparation
    ? initialState.status === 'needs-initialization'
      ? 'Kuskus will index the files in this folder and keep them where they are.'
      : 'Kuskus will build a readable library and keep a backup of the current one.'
    : step === 'welcome'
      ? 'A home for everything worth keeping.'
      : 'Choose a name and a location on your computer.'

  return (
    <div className="window-canvas flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 justify-end [-webkit-app-region:drag]">
          <WindowControls />
        </header>
        <main className="setup-main flex min-h-0 flex-1 justify-center overflow-y-auto px-7 py-8">
          <div className="setup-content my-auto flex w-full max-w-[34rem] flex-col gap-7">
            <div className="setup-intro flex flex-col items-center gap-3 text-center">
              <img
                src={kuskusIcon}
                alt=""
                draggable={false}
                className="setup-logo pointer-events-none mb-2 size-24 select-none object-contain"
              />
              <h1 className="text-balance text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>

            {initialState.status === 'unavailable' && showWelcome && (
              <LibraryAlert
                title="Previous library unavailable"
                description={[initialState.message, initialState.path].filter(Boolean).join(' ')}
              />
            )}

            {showWelcome ? (
              <Card className="setup-welcome-card gap-0 py-0">
                <CardHeader className="sr-only">
                  <CardTitle>Get started</CardTitle>
                  <CardDescription>
                    Create a library or open a folder on your computer.
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-0 py-1">
                  <div className="flex items-center justify-between gap-4 px-(--card-spacing) py-6">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-sm font-medium">Create a new library</p>
                      <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
                        Start with a fresh space for your collection.
                      </p>
                    </div>
                    <Button
                      size="lg"
                      className="w-24"
                      disabled={busy}
                      onClick={() => setStep('create')}
                    >
                      Create
                    </Button>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4 px-(--card-spacing) py-6">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-sm font-medium">Open a folder as a library</p>
                      <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
                        Choose an existing library or a folder of files.
                      </p>
                    </div>
                    <Button
                      className="w-24"
                      size="lg"
                      variant="secondary"
                      disabled={busy}
                      onClick={openLibrary}
                    >
                      {busy ? <Spinner data-icon="inline-start" /> : null}
                      Open
                    </Button>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-1 border-t py-4 text-center text-xs text-muted-foreground">
                  <p>Your files stay on your computer.</p>
                  <p>No account needed. Yours to collect, yours to keep.</p>
                </CardFooter>
              </Card>
            ) : needsPreparation ? (
              <Card>
                <CardHeader>
                  <CardTitle>Selected folder</CardTitle>
                  <CardDescription>
                    {initialState.status === 'needs-initialization' ? initialState.name : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {initialState.status === 'needs-initialization' ? (
                    <Alert>
                      <AlertTitle>Ready to index</AlertTitle>
                      <AlertDescription>
                        {initialState.markdownFiles} Markdown files, {initialState.imageFiles}{' '}
                        images, {initialState.otherFiles} other files, and {initialState.folders}{' '}
                        folders. Existing .obsidian settings are untouched.
                        {initialState.archiveFolderExists
                          ? ' Continuing explicitly adopts the existing Archive folder.'
                          : ''}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {error && <LibraryAlert title="Unable to continue" description={error} />}
                </CardContent>
                <CardFooter className="flex flex-wrap justify-between gap-3">
                  <Button variant="ghost" disabled={busy} onClick={openLibrary}>
                    Open another folder
                  </Button>
                  <Button disabled={busy} onClick={prepareSelectedVault}>
                    {busy && <Spinner data-icon="inline-start" />}
                    {busy
                      ? 'Working…'
                      : initialState.status === 'needs-initialization' &&
                          initialState.archiveFolderExists
                        ? 'Adopt Archive and Initialize'
                        : 'Initialize Library'}
                  </Button>
                </CardFooter>
              </Card>
            ) : (
              <form onSubmit={createLibrary}>
                <Card>
                  <CardHeader>
                    <CardTitle>New library</CardTitle>
                    <CardDescription>
                      Kuskus will create a folder in the location you select.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      <Field data-disabled={busy}>
                        <FieldLabel htmlFor="library-name">Library name</FieldLabel>
                        <Input
                          id="library-name"
                          name="libraryName"
                          autoComplete="off"
                          autoFocus
                          value={name}
                          maxLength={80}
                          disabled={busy}
                          onChange={(event) => setName(event.target.value)}
                        />
                        <FieldDescription>
                          You can add notes, images, and links later.
                        </FieldDescription>
                      </Field>
                      {error && <LibraryAlert title="Unable to continue" description={error} />}
                    </FieldGroup>
                  </CardContent>
                  <CardFooter className="flex justify-between gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setStep('welcome')
                        setError('')
                      }}
                    >
                      Back
                    </Button>
                    <Button type="submit" disabled={busy || !name.trim()}>
                      {busy && <Spinner data-icon="inline-start" />}
                      {busy ? 'Working…' : 'Choose folder'}
                    </Button>
                  </CardFooter>
                </Card>
              </form>
            )}
            {showWelcome && error && (
              <LibraryAlert title="Unable to continue" description={error} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
