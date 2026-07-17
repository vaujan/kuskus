import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  IconInbox as Inbox,
  IconPhoto as FileImage,
  IconSearch as Search,
  IconX as X
} from '@tabler/icons-react'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AddItemComposer, type ImportRequest } from '@/features/capture/add-item-composer'
import { SavedItemCard } from '@/features/items/saved-item-card'
import { ItemDetailDialog } from '@/features/items/item-detail-dialog'
import { type ItemTypeFilter, type LibraryView } from '@/features/items/item-view'
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
  const [composerHasTransientWork, setComposerHasTransientWork] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilters, setTypeFilters] = useState<ItemTypeFilter[]>([])
  const [view, setView] = useState<LibraryView>(() => {
    const stored = localStorage.getItem('kuskus-library-view')
    return stored === 'grid' || stored === 'list' ? stored : 'visual'
  })
  const [message, setMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
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

  useEffect(() => {
    localStorage.setItem('kuskus-library-view', view)
  }, [view])

  const visibleItems = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase()
    return library.items.filter((item) => {
      if (typeFilters.length > 0 && !typeFilters.includes(item.type)) return false
      if (!query) return true

      const searchableText = [
        item.title,
        item.type === 'note' ? item.body : '',
        item.type === 'image' ? (item.sourceFilename ?? item.contentFilename) : '',
        item.type === 'url' ? `${item.domain} ${item.sourceUrl} ${item.description ?? ''}` : ''
      ]
        .join(' ')
        .toLocaleLowerCase()

      return searchableText.includes(query)
    })
  }, [deferredSearch, library.items, typeFilters])

  const selectedItem = useMemo(
    () => library.items.find((item) => item.id === selectedItemId) ?? null,
    [library.items, selectedItemId]
  )
  const selectedVisibleIndex = useMemo(
    () => visibleItems.findIndex((item) => item.id === selectedItemId),
    [selectedItemId, visibleItems]
  )
  const hasPreviousItem = selectedVisibleIndex > 0
  const hasNextItem = selectedVisibleIndex >= 0 && selectedVisibleIndex < visibleItems.length - 1

  const selectPreviousItem = useCallback((): void => {
    if (selectedVisibleIndex <= 0) return
    setSelectedItemId(visibleItems[selectedVisibleIndex - 1].id)
  }, [selectedVisibleIndex, visibleItems])

  const selectNextItem = useCallback((): void => {
    if (selectedVisibleIndex < 0 || selectedVisibleIndex >= visibleItems.length - 1) return
    setSelectedItemId(visibleItems[selectedVisibleIndex + 1].id)
  }, [selectedVisibleIndex, visibleItems])

  const hasActiveRetrieval = search.trim().length > 0 || typeFilters.length > 0

  const changeTypeFilter = useCallback((type: ItemTypeFilter, selected: boolean): void => {
    setTypeFilters((current) =>
      selected
        ? current.includes(type)
          ? current
          : [...current, type]
        : current.filter((entry) => entry !== type)
    )
  }, [])

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
        onStatus={announceStatus}
        librarySwitchBlocked={importRequest !== null || composerHasTransientWork}
      />
      <SidebarInset>
        <AppToolbar
          search={search}
          onSearchChange={setSearch}
          searchPending={search !== deferredSearch}
          resultCount={visibleItems.length}
          totalCount={library.items.length}
          view={view}
          onViewChange={setView}
          typeFilters={typeFilters}
          onTypeFilterChange={changeTypeFilter}
          onClearFilters={() => setTypeFilters([])}
        />
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
                <div
                  className={cn(
                    view === 'visual' && 'columns-[16rem] gap-4',
                    view === 'grid' && 'grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4',
                    view === 'list' && 'flex flex-col gap-2'
                  )}
                >
                  <div
                    className={cn(
                      'min-w-0',
                      view === 'visual' && 'mb-4 break-inside-avoid',
                      view === 'list' && 'mb-3'
                    )}
                  >
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
                      onTransientWorkChange={setComposerHasTransientWork}
                    />
                  </div>
                  {visibleItems.map((item) => (
                    <div
                      className={cn('min-w-0', view === 'visual' && 'mb-4 break-inside-avoid')}
                      key={item.id}
                    >
                      <SavedItemCard
                        item={item}
                        view={view}
                        onError={setMessage}
                        onOpen={() => setSelectedItemId(item.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
              {!isDragging && visibleItems.length === 0 && hasActiveRetrieval && (
                <Empty className="mt-8 border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Search aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>No matching items</EmptyTitle>
                    <EmptyDescription>
                      Try another search or clear the active item filters.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch('')
                        setTypeFilters([])
                      }}
                    >
                      Clear search and filters
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
              {!isDragging && library.items.length === 0 && !hasActiveRetrieval && (
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
          hasPrevious={hasPreviousItem}
          hasNext={hasNextItem}
          onPrevious={selectPreviousItem}
          onNext={selectNextItem}
          onOpenChange={(open) => {
            if (!open) setSelectedItemId(null)
          }}
          onError={setMessage}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
