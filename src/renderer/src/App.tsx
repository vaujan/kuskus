import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
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

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Sidebar as AppSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger
} from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
    <div className="window-no-drag flex h-full self-stretch">
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
        {isMaximized ? <Copy aria-hidden="true" /> : <Square aria-hidden="true" />}
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
        <Spinner aria-label="Opening Kuskus" />
        Opening Kuskus…
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
    if (!result.ok) return onError(result.error)
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
      <Button
        className="min-h-56 w-full flex-col items-start justify-between border-dashed text-left"
        variant="outline"
        type="button"
        onClick={() => onExpandedChange(true)}
      >
        <Plus data-icon="inline-start" aria-hidden="true" />
        <span className="flex flex-col gap-1">
          <span>Add Item</span>
          <span className="text-xs text-muted-foreground">Paste or Start Typing…</span>
        </span>
      </Button>
    )
  }

  return (
    <Card className="relative z-20 min-h-(--composer-card-height) md:col-span-2">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b py-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">New Quick Note</Badge>
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
        <Textarea
          ref={editorRef}
          className="min-h-(--composer-editor-height) resize-none border-0 p-5 shadow-none"
          aria-label="New note content"
          placeholder="Paste or Start Typing…"
          value={draft}
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </CardContent>
      <CardFooter className="justify-between border-t py-3">
        <span className="text-xs text-muted-foreground">Ctrl+Enter to Save</span>
        <Button size="sm" disabled={!draft.trim() || saving} onClick={() => void save()}>
          {saving ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Check data-icon="inline-start" aria-hidden="true" />
          )}
          {saving ? 'Saving…' : 'Save Note'}
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
    <Card className="min-h-56">
      <CardHeader className="flex-row items-start justify-between gap-3 border-b py-3">
        <div className="min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <FileText aria-hidden="true" />
            Note
          </div>
          <CardTitle className="truncate text-sm">{item.title}</CardTitle>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Show ${item.title} in Explorer`}
                onClick={() => void reveal()}
              >
                <FolderOpen aria-hidden="true" />
              </Button>
            }
          />
          <TooltipContent>Show in Explorer</TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent className="py-4">
        {item.missingContent ? (
          <p className="text-sm text-destructive">The note file is missing from the library.</p>
        ) : (
          <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {item.body}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function LibrarySidebar({
  library,
  theme,
  onHide,
  onToggleTheme
}: {
  library: LibraryDto
  theme: Theme
  onHide: () => void
  onToggleTheme: () => void
}): React.JSX.Element {
  return (
    <AppSidebar collapsible="offcanvas">
      <SidebarHeader className="window-no-drag">
        <div className="flex items-center gap-3 px-2 py-2">
          <Library
            className="size-8 rounded-lg bg-primary p-2 text-primary-foreground"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{library.name}</p>
            <p className="truncate text-xs text-muted-foreground">Local Library</p>
          </div>
          <Button size="icon-sm" variant="ghost" aria-label="Hide sidebar" onClick={onHide}>
            <PanelLeftClose aria-hidden="true" />
          </Button>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu aria-label="Library navigation">
              <SidebarMenuItem>
                <SidebarMenuButton isActive>
                  <Inbox aria-hidden="true" />
                  <span>Inbox</span>
                  <Badge className="ml-auto" variant="outline">
                    {library.items.length}
                  </Badge>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton disabled>
                  <BookOpen aria-hidden="true" />
                  <span>All Items</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Collections</SidebarGroupLabel>
          <SidebarGroupAction disabled aria-label="New collection">
            <Plus aria-hidden="true" />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <p className="px-2 text-xs leading-relaxed text-muted-foreground">
              Collections arrive after the capture workflow is reliable.
            </p>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              <Archive aria-hidden="true" />
              <span>Trash</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              <Settings aria-hidden="true" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onToggleTheme}>
              {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </AppSidebar>
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
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    localStorage.setItem('kuskus-sidebar-hidden', String(sidebarHidden))
  }, [sidebarHidden])

  const visibleItems = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase()
    return query
      ? library.items.filter(
          (item) =>
            item.title.toLocaleLowerCase().includes(query) ||
            item.body.toLocaleLowerCase().includes(query)
        )
      : library.items
  }, [deferredSearch, library.items])
  const addCreatedItem = (item: NoteItemDto): void => {
    setLibrary((current) => ({ ...current, items: [item, ...current.items] }))
    setMessage('')
  }

  return (
    <SidebarProvider
      open={!sidebarHidden}
      onOpenChange={(open) => setSidebarHidden(!open)}
      className="h-screen min-h-0 overflow-hidden bg-background text-foreground"
    >
      <LibrarySidebar
        library={library}
        theme={theme}
        onHide={() => setSidebarHidden(true)}
        onToggleTheme={toggleTheme}
      />
      <SidebarInset>
        <header className="window-drag flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
          {sidebarHidden && (
            <div className="window-no-drag">
              <SidebarTrigger aria-label="Show sidebar">
                <PanelLeftOpen aria-hidden="true" />
              </SidebarTrigger>
            </div>
          )}
          <div className="window-no-drag relative min-w-40 max-w-xl flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              type="search"
              name="search"
              autoComplete="off"
              placeholder="Search Inbox…"
              aria-label="Search Inbox"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="window-no-drag ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" disabled>
              <Filter data-icon="inline-start" aria-hidden="true" />
              Filter
            </Button>
            <ToggleGroup value={['visual']} aria-label="View selection" spacing={0}>
              <ToggleGroupItem value="visual" variant="outline" aria-label="Visual view">
                <LayoutGrid data-icon="inline-start" aria-hidden="true" />
                Visual
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <WindowControls />
        </header>
        <main className="relative min-w-0 flex-1 overflow-auto">
          {composerExpanded && (
            <div
              className="pointer-events-none absolute inset-0 z-10 bg-background/65 backdrop-blur-sm"
              aria-hidden="true"
            />
          )}
          <div className="mx-auto min-h-full max-w-(--content-max-width) p-5 lg:p-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-medium tracking-tight">Inbox</h1>
                  <Badge variant="outline">{library.items.length}</Badge>
                </div>
                <p className="mt-1 max-w-2xl truncate text-xs text-muted-foreground">
                  {library.path}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">Newest First</span>
            </div>
            {message && (
              <Alert className="relative z-30 mb-4" variant="destructive">
                <AlertTitle>Unable to Complete Action</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
                <AlertAction>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Dismiss error"
                    onClick={() => setMessage('')}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </AlertAction>
              </Alert>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(var(--content-card-min-width),1fr))] items-start gap-4">
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
              <Empty className="mt-10 border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Search aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>No Matching Notes</EmptyTitle>
                  <EmptyDescription>Try a different search term.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function App(): React.JSX.Element {
  const [state, setState] = useState<LibraryState | null>(null)
  useEffect(() => {
    let mounted = true
    void window.kuskus.getState().then((result) => {
      if (mounted)
        setState(
          result.ok ? result.data : { status: 'unavailable', path: '', message: result.error }
        )
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
