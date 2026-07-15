import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { FileImage, Inbox, Search, X } from 'lucide-react'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AddItemComposer, type ImportRequest } from '@/features/capture/add-item-composer'
import { SavedItemCard } from '@/features/items/saved-item-card'
import { AppToolbar } from '@/features/shell/app-toolbar'
import { LibrarySidebar } from '@/features/shell/library-sidebar'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import type { LibraryDto, LibraryItemDto } from '../../../../shared/library-contract'

export function Workspace({ initialLibrary }: { initialLibrary: LibraryDto }): React.JSX.Element {
  const [library, setLibrary] = useState(initialLibrary)
  const [sidebarHidden, setSidebarHidden] = useState(
    () => localStorage.getItem('kuskus-sidebar-hidden') === 'true'
  )
  const [composerExpanded, setComposerExpanded] = useState(false)
  const [importRequest, setImportRequest] = useState<ImportRequest | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [theme, toggleTheme] = useTheme()
  const deferredSearch = useDeferredValue(search)
  const importRequestId = useRef(0)
  const dragDepth = useRef(0)
  const draftStorageKey = `kuskus-note-draft:${initialLibrary.path}`

  const announceStatus = useCallback((message: string): void => {
    setStatusMessage('')
    window.requestAnimationFrame(() => setStatusMessage(message))
  }, [])

  useEffect(() => {
    localStorage.setItem('kuskus-sidebar-hidden', String(sidebarHidden))
  }, [sidebarHidden])

  const visibleItems = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase()
    return query
      ? library.items.filter(
          (item) =>
            item.title.toLocaleLowerCase().includes(query) ||
            (item.type === 'note' && item.body.toLocaleLowerCase().includes(query))
        )
      : library.items
  }, [deferredSearch, library.items])

  const addCreatedItem = (item: LibraryItemDto): void => {
    setLibrary((current) => ({ ...current, items: [item, ...current.items] }))
    setMessage('')
  }

  const requestImageImport = useCallback((file: File): void => {
    if (!file.type.startsWith('image/')) {
      setMessage('Only image files can be imported here right now.')
      return
    }
    importRequestId.current += 1
    setImportRequest({ id: importRequestId.current, file })
    setComposerExpanded(true)
  }, [])

  useEffect(() => {
    const capturePastedImage = (event: ClipboardEvent): void => {
      if (event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
        entry.type.startsWith('image/')
      )
      const file = item?.getAsFile()
      if (!file) return
      event.preventDefault()
      requestImageImport(file)
    }
    window.addEventListener('paste', capturePastedImage)
    return () => window.removeEventListener('paste', capturePastedImage)
  }, [requestImageImport])

  const captureDroppedImage = (event: React.DragEvent<HTMLElement>): void => {
    const files = Array.from(event.dataTransfer.files)
    event.preventDefault()
    dragDepth.current = 0
    setIsDragging(false)
    const image = files.find((file) => file.type.startsWith('image/'))
    if (image) requestImageImport(image)
    else if (files.length > 0) setMessage('Only image files can be imported here right now.')
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
        <AppToolbar sidebarHidden={sidebarHidden} search={search} onSearchChange={setSearch} />
        <main
          className="relative min-w-0 flex-1 overflow-auto"
          onDragEnter={(event) => {
            if (!Array.from(event.dataTransfer.types).includes('Files')) return
            event.preventDefault()
            dragDepth.current += 1
            setIsDragging(true)
          }}
          onDragOver={(event) => {
            if (Array.from(event.dataTransfer.types).includes('Files')) event.preventDefault()
          }}
          onDragLeave={() => {
            dragDepth.current = Math.max(0, dragDepth.current - 1)
            if (dragDepth.current === 0) setIsDragging(false)
          }}
          onDrop={captureDroppedImage}
        >
          <div className="mx-auto min-h-full max-w-(--content-max-width) p-5 lg:p-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-balance text-xl font-medium tracking-tight">Inbox</h1>
                  <Badge className="tabular-nums" variant="outline">
                    {search ? visibleItems.length : library.items.length}
                  </Badge>
                </div>
                <p
                  className="mt-1 max-w-2xl truncate text-xs text-muted-foreground"
                  title={library.path}
                >
                  {library.path}
                </p>
              </div>
              <Badge variant="secondary">Newest first</Badge>
            </div>
            {message && (
              <Alert className="mb-4" variant="destructive">
                <AlertTitle>Unable to Complete Action</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
                <AlertAction>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label="Dismiss error"
                          onClick={() => setMessage('')}
                        >
                          <X aria-hidden="true" />
                        </Button>
                      }
                    />
                    <TooltipContent>Dismiss error</TooltipContent>
                  </Tooltip>
                </AlertAction>
              </Alert>
            )}
            {isDragging ? (
              <Empty className="drop-target min-h-72 border border-dashed border-primary bg-muted/30">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileImage aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>Drop image to add it to Inbox</EmptyTitle>
                  <EmptyDescription>The original file stays untouched.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className={cn('visual-canvas', composerExpanded && 'visual-canvas-composing')}>
                <div className="visual-entry visual-entry-composer">
                  <AddItemComposer
                    expanded={composerExpanded}
                    draftStorageKey={draftStorageKey}
                    importRequest={importRequest}
                    onExpandedChange={setComposerExpanded}
                    onImportRequestHandled={(id) =>
                      setImportRequest((current) => (current?.id === id ? null : current))
                    }
                    onCreated={addCreatedItem}
                    onStatus={announceStatus}
                  />
                </div>
                {visibleItems.map((item) => (
                  <div className="visual-entry" key={item.id}>
                    <SavedItemCard item={item} onError={setMessage} />
                  </div>
                ))}
              </div>
            )}
            {!isDragging && !composerExpanded && visibleItems.length === 0 && search && (
              <Empty className="mt-8 border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Search aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>No matching items</EmptyTitle>
                  <EmptyDescription>Try another term or clear the Inbox search.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            {!isDragging && !composerExpanded && library.items.length === 0 && !search && (
              <Empty className="mt-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>Your Inbox is ready</EmptyTitle>
                  <EmptyDescription>
                    Add a note, paste an image, or drop one anywhere in this window.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {statusMessage}
          </p>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
