import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { FileImage, Inbox, Search, X } from 'lucide-react'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AddItemComposer, type ImportRequest } from '@/features/capture/add-item-composer'
import { SavedItemCard } from '@/features/items/saved-item-card'
import { ItemDetailDialog } from '@/features/items/item-detail-dialog'
import { AppToolbar } from '@/features/shell/app-toolbar'
import { LibrarySidebar } from '@/features/shell/library-sidebar'
import { useTheme } from '@/hooks/use-theme'
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
  const [selectedItem, setSelectedItem] = useState<LibraryItemDto | null>(null)
  const [theme, toggleTheme] = useTheme()
  const deferredSearch = useDeferredValue(search)
  const importRequestId = useRef(0)
  const dragDepth = useRef(0)
  const enrichingUrlIds = useRef(new Set<string>())
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

  const addCreatedItem = useCallback((item: LibraryItemDto): void => {
    setLibrary((current) => ({ ...current, items: [item, ...current.items] }))
    setMessage('')
  }, [])

  useEffect(() => {
    const pending = library.items.filter(
      (item) => item.type === 'url' && item.metadataStatus === 'pending'
    )
    pending.forEach((item) => {
      if (enrichingUrlIds.current.has(item.id)) return
      enrichingUrlIds.current.add(item.id)
      void window.kuskus.enrichUrl(item.id).then((result) => {
        enrichingUrlIds.current.delete(item.id)
        if (!result.ok) return
        setLibrary((current) => ({
          ...current,
          items: current.items.map((entry) => (entry.id === item.id ? result.data : entry))
        }))
        setSelectedItem((current) => (current?.id === item.id ? result.data : current))
      })
    })
  }, [library.items])

  const requestImageImport = useCallback((file: File): void => {
    if (!file.type.startsWith('image/')) {
      setMessage('Only image files can be imported here right now.')
      return
    }
    importRequestId.current += 1
    setImportRequest({ id: importRequestId.current, file })
    setComposerExpanded(true)
  }, [])

  const requestUrlCapture = useCallback((url: string): void => {
    importRequestId.current += 1
    setImportRequest({ id: importRequestId.current, url })
    setComposerExpanded(true)
  }, [])

  useEffect(() => {
    const capturePastedContent = (event: ClipboardEvent): void => {
      if (event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
        entry.type.startsWith('image/')
      )
      const file = item?.getAsFile()
      if (file) {
        event.preventDefault()
        requestImageImport(file)
        return
      }
      const text = event.clipboardData?.getData('text/plain').trim() ?? ''
      try {
        const url = new URL(text)
        if (['http:', 'https:'].includes(url.protocol) && url.toString() === text) {
          event.preventDefault()
          requestUrlCapture(text)
        }
      } catch {
        /* ordinary text belongs to the composer */
      }
    }
    window.addEventListener('paste', capturePastedContent)
    return () => window.removeEventListener('paste', capturePastedContent)
  }, [requestImageImport, requestUrlCapture])

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
        onToggleTheme={toggleTheme}
        onLibraryChange={setLibrary}
        onError={setMessage}
      />
      <SidebarInset>
        <AppToolbar search={search} onSearchChange={setSearch} />
        <ScrollArea className="min-h-0 min-w-0 flex-1">
          <main
            className="relative min-h-full"
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
            <div className="min-h-full p-5 lg:p-7">
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
              <div className="columns-[15rem] gap-4">
                <div className="mb-4 min-w-0 break-inside-avoid">
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
                  <div
                    className="mb-4 break-inside-avoid"
                    key={item.id}
                  >
                    <SavedItemCard
                      item={item}
                      onError={setMessage}
                      onOpen={() => setSelectedItem(item)}
                    />
                  </div>
                ))}
              </div>
            )}
            {!isDragging && visibleItems.length === 0 && search && (
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
            {!isDragging && library.items.length === 0 && !search && (
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
          </main>
        </ScrollArea>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {statusMessage}
        </p>
        <ItemDetailDialog
          item={selectedItem}
          onOpenChange={(open) => {
            if (!open) setSelectedItem(null)
          }}
          onError={setMessage}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
