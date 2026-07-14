import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  BookOpen,
  Check,
  Copy,
  FileText,
  Filter,
  FolderOpen,
  Inbox,
  LayoutGrid,
  Library,
  Minus,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Square,
  Sun,
  X
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { LibraryDto, LibraryState, NoteItemDto } from '../../shared/kuskus'

type Theme = 'dark' | 'light'

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem('kuskus-theme') === 'light' ? 'light' : 'dark'
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('kuskus-theme', theme)
  }, [theme])

  return [theme, () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))]
}

function WindowControls(): React.JSX.Element | null {
  const isMac = window.electron.window.platform === 'darwin'
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (isMac) return

    let mounted = true
    void window.electron.window.isMaximized().then((value) => {
      if (mounted) setIsMaximized(value)
    })
    const unsubscribe = window.electron.window.onMaximizedChange(setIsMaximized)
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [isMac])

  if (isMac) return null

  return (
    <div className="window-no-drag -mr-3 flex h-full self-stretch">
      <button
        className="titlebar-control"
        type="button"
        aria-label="Minimize window"
        onClick={window.electron.window.minimize}
      >
        <Minus aria-hidden="true" />
      </button>
      <button
        className="titlebar-control"
        type="button"
        aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
        onClick={window.electron.window.toggleMaximize}
      >
        {isMaximized ? (
          <Copy className="rotate-180" aria-hidden="true" />
        ) : (
          <Square aria-hidden="true" />
        )}
      </button>
      <button
        className="titlebar-control titlebar-close"
        type="button"
        aria-label="Close window"
        onClick={window.electron.window.close}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  )
}

function LoadingScreen(): React.JSX.Element {
  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="size-2 animate-pulse rounded-full bg-primary" />
        Opening Kuskus
      </div>
    </div>
  )
}

function SetupScreen({ initialState }: { initialState: LibraryState }): React.JSX.Element {
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
        <Card className="w-full max-w-lg overflow-hidden">
          <CardHeader className="gap-3 border-b">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Library className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-xl">Create your local library</CardTitle>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Kuskus stores readable notes and metadata in a folder you control. Choose a parent
                folder and Kuskus will create the named library inside it.
              </p>
            </div>
          </CardHeader>
          <form onSubmit={createLibrary}>
            <CardContent className="space-y-4 py-5">
              {initialState.status === 'unavailable' && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  <p className="font-medium">Previous library unavailable</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {initialState.path}
                  </p>
                </div>
              )}
              <label className="grid gap-2 text-sm font-medium" htmlFor="library-name">
                Library name
                <input
                  id="library-name"
                  className="h-10 rounded-lg border bg-background px-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring"
                  value={name}
                  maxLength={80}
                  onChange={(event) => setName(event.target.value)}
                  disabled={busy}
                />
              </label>
              {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </p>
              )}
            </CardContent>
            <CardFooter className="justify-between gap-3 border-t">
              <Button type="button" variant="ghost" disabled={busy} onClick={openLibrary}>
                <FolderOpen aria-hidden="true" />
                Open existing
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                <Plus aria-hidden="true" />
                {busy ? 'Working...' : 'Create library'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  )
}

function AddItemComposer({
  expanded,
  onExpandedChange,
  onCreated,
  onError
}: {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onCreated: (item: NoteItemDto) => void
  onError: (message: string) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (expanded) editorRef.current?.focus()
  }, [expanded])

  const save = async (): Promise<void> => {
    if (!draft.trim() || saving) return
    setSaving(true)
    onError('')
    const result = await window.kuskus.createNote(draft)
    setSaving(false)

    if (!result.ok) {
      onError(result.error)
      return
    }

    setDraft('')
    onCreated(result.data)
    onExpandedChange(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault()
      void save()
    }
    if (event.key === 'Escape' && !draft.trim() && !saving) onExpandedChange(false)
  }

  if (!expanded) {
    return (
      <button
        className="group flex min-h-56 flex-col rounded-xl border border-dashed bg-card p-5 text-left text-card-foreground transition-colors hover:border-primary/60 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="button"
        onClick={() => onExpandedChange(true)}
      >
        <span className="flex size-9 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
          <Plus className="size-4" aria-hidden="true" />
        </span>
        <span className="mt-auto">
          <span className="block text-sm font-medium">Add item</span>
          <span className="mt-1 block text-xs text-muted-foreground">Paste or start typing...</span>
        </span>
      </button>
    )
  }

  return (
    <Card className="relative z-20 min-h-[360px] overflow-hidden md:col-span-2">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b py-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">New quick note</Badge>
          <span className="text-xs text-muted-foreground">Markdown</span>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          type="button"
          aria-label="Close composer"
          disabled={saving}
          onClick={() => {
            if (!draft.trim()) onExpandedChange(false)
          }}
        >
          <X aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 p-0">
        <textarea
          ref={editorRef}
          className="min-h-[250px] w-full resize-none bg-transparent p-5 text-[15px] leading-7 outline-none placeholder:text-muted-foreground"
          aria-label="New note content"
          placeholder="Paste or start typing..."
          value={draft}
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </CardContent>
      <CardFooter className="justify-between border-t py-3">
        <span className="text-xs text-muted-foreground">Ctrl+Enter to save</span>
        <Button size="sm" disabled={!draft.trim() || saving} onClick={() => void save()}>
          <Check aria-hidden="true" />
          {saving ? 'Saving...' : 'Save note'}
        </Button>
      </CardFooter>
    </Card>
  )
}

function NoteCard({
  item,
  onError
}: {
  item: NoteItemDto
  onError: (error: string) => void
}): React.JSX.Element {
  const reveal = async (): Promise<void> => {
    const result = await window.kuskus.showItemInExplorer(item.id)
    if (!result.ok) onError(result.error)
  }

  return (
    <Card className="group min-h-56 overflow-hidden transition-colors hover:border-foreground/20">
      <CardHeader className="flex-row items-start justify-between gap-3 border-b py-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <FileText className="size-3.5" aria-hidden="true" />
            Note
          </div>
          <CardTitle className="truncate text-sm">{item.title}</CardTitle>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Show ${item.title} in Explorer`}
              onClick={() => void reveal()}
            >
              <FolderOpen aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Show in Explorer</TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent className="py-4">
        {item.missingContent ? (
          <p className="text-sm text-destructive">The note file is missing from the library.</p>
        ) : (
          <p className="line-clamp-[9] whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {item.body}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function Workspace({ initialLibrary }: { initialLibrary: LibraryDto }): React.JSX.Element {
  const [library, setLibrary] = useState(initialLibrary)
  const [sidebarHidden, setSidebarHidden] = useState(
    () => localStorage.getItem('kuskus-sidebar-hidden') === 'true'
  )
  const [composerExpanded, setComposerExpanded] = useState(false)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [theme, toggleTheme] = useTheme()

  useEffect(() => {
    localStorage.setItem('kuskus-sidebar-hidden', String(sidebarHidden))
  }, [sidebarHidden])

  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return library.items
    return library.items.filter(
      (item) =>
        item.title.toLocaleLowerCase().includes(query) ||
        item.body.toLocaleLowerCase().includes(query)
    )
  }, [library.items, search])

  const addCreatedItem = (item: NoteItemDto): void => {
    setLibrary((current) => ({ ...current, items: [item, ...current.items] }))
    setMessage('')
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="window-drag flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-3">
        <div className="window-no-drag flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={sidebarHidden ? 'Show sidebar' : 'Hide sidebar'}
            onClick={() => setSidebarHidden((current) => !current)}
          >
            {sidebarHidden ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
          </Button>
        </div>

        <div className="window-no-drag relative min-w-40 max-w-xl flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            className="h-8 w-full rounded-lg border bg-muted/50 pl-9 pr-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:bg-background focus:ring-2 focus:ring-ring"
            type="search"
            placeholder="Search Inbox"
            aria-label="Search Inbox"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="window-no-drag ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" disabled>
            <Filter aria-hidden="true" />
            Filter
          </Button>
          <Button size="sm" variant="secondary">
            <LayoutGrid aria-hidden="true" />
            Visual
          </Button>
        </div>
        <WindowControls />
      </header>

      <div className="flex min-h-0 flex-1">
        {!sidebarHidden && (
          <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar/70 p-3 text-sidebar-foreground">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Library className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{library.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">Local library</p>
              </div>
            </div>

            <Separator className="my-3" />
            <nav className="space-y-1" aria-label="Library navigation">
              <Button className="w-full justify-start" variant="secondary">
                <Inbox aria-hidden="true" />
                Inbox
                <Badge className="ml-auto" variant="outline">
                  {library.items.length}
                </Badge>
              </Button>
              <Button className="w-full justify-start" variant="ghost" disabled>
                <BookOpen aria-hidden="true" />
                All Items
              </Button>
            </nav>

            <div className="mt-6 flex items-center justify-between px-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Collections
              </span>
              <Button size="icon-sm" variant="ghost" disabled aria-label="New collection">
                <Plus aria-hidden="true" />
              </Button>
            </div>
            <p className="px-2 py-3 text-xs leading-relaxed text-muted-foreground">
              Collections arrive after the capture workflow is reliable.
            </p>

            <div className="mt-auto space-y-1">
              <Button className="w-full justify-start" variant="ghost" disabled>
                <Archive aria-hidden="true" />
                Trash
              </Button>
              <Button className="w-full justify-start" variant="ghost" disabled>
                <Settings aria-hidden="true" />
                Settings
              </Button>
              <Button className="w-full justify-start" variant="ghost" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
                {theme === 'dark' ? 'Light theme' : 'Dark theme'}
              </Button>
            </div>
          </aside>
        )}

        <main className="relative min-w-0 flex-1 overflow-auto">
          {composerExpanded && (
            <button
              className="absolute inset-0 z-10 cursor-default bg-background/65 backdrop-blur-[2px]"
              type="button"
              aria-label="Composer background"
              onClick={() => undefined}
            />
          )}
          <div className="mx-auto min-h-full max-w-[1500px] p-5 lg:p-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-medium tracking-tight">Inbox</h1>
                  <Badge variant="outline">{library.items.length}</Badge>
                </div>
                <p className="mt-1 max-w-2xl truncate text-xs text-muted-foreground">
                  {library.path}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">Newest first</span>
            </div>

            {message && (
              <div className="relative z-30 mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <span>{message}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Dismiss error"
                  onClick={() => setMessage('')}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            )}

            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] items-start gap-4">
              <AddItemComposer
                expanded={composerExpanded}
                onExpandedChange={setComposerExpanded}
                onCreated={addCreatedItem}
                onError={setMessage}
              />
              {visibleItems.map((item) => (
                <NoteCard key={item.id} item={item} onError={setMessage} />
              ))}
            </div>

            {!composerExpanded && visibleItems.length === 0 && search && (
              <div className="mt-10 text-center text-sm text-muted-foreground">
                No notes match “{search}”.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function App(): React.JSX.Element {
  const [state, setState] = useState<LibraryState | null>(null)

  useEffect(() => {
    let mounted = true
    void window.kuskus.getState().then((result) => {
      if (!mounted) return
      setState(result.ok ? result.data : { status: 'unavailable', path: '', message: result.error })
    })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <TooltipProvider>
      {!state ? (
        <LoadingScreen />
      ) : state.status === 'ready' ? (
        <Workspace initialLibrary={state.library} />
      ) : (
        <SetupScreen initialState={state} />
      )}
    </TooltipProvider>
  )
}

export default App
