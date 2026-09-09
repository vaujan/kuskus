import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  IconArchive,
  IconFile,
  IconFolder,
  IconInbox,
  IconLink,
  IconNote,
  IconPhoto,
  IconSearch,
  IconTrash
} from '@tabler/icons-react'

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Kbd } from '@/components/ui/kbd'
import { ScrollArea } from '@/components/ui/scroll-area'
import { focusIndexSupportingText } from '@/features/items/focus-index-row-text'
import { resolveRecentSearchItems } from '@/features/search/global-search-state'
import { GlobalSearchPreview } from '@/features/search/global-search-preview'
import type { CollectionDto, LibraryDto, LibraryItemDto } from '../../../../shared/library-contract'

const SEARCH_DEBOUNCE_MS = 150
const MAX_SEARCH_RESULTS = 50

function itemTypeLabel(item: LibraryItemDto): string {
  if (item.type === 'note') return 'Note'
  if (item.type === 'url') return 'Link'
  if (item.type === 'image') return 'Image'
  return 'File'
}

function ItemTypeIcon({ item }: { item: LibraryItemDto }): React.JSX.Element {
  const Icon =
    item.type === 'note'
      ? IconNote
      : item.type === 'url'
        ? IconLink
        : item.type === 'image'
          ? IconPhoto
          : IconFile
  return <Icon aria-hidden="true" />
}

function itemLocationLabel(item: LibraryItemDto, collections: readonly CollectionDto[]): string {
  const location = item.location
  if (location.type === 'inbox') return 'Inbox'
  if (location.type === 'archive') return 'Archive'
  if (location.type === 'trash') return 'Trash'
  return (
    collections.find((collection) => collection.id === location.collectionId)?.relativePath ??
    'Folder'
  )
}

function ItemLocationIcon({ item }: { item: LibraryItemDto }): React.JSX.Element {
  const Icon =
    item.location.type === 'inbox'
      ? IconInbox
      : item.location.type === 'archive'
        ? IconArchive
        : item.location.type === 'trash'
          ? IconTrash
          : IconFolder
  return <Icon aria-hidden="true" />
}

function resultSupportingText(item: LibraryItemDto): string {
  return focusIndexSupportingText(item) || 'No preview available'
}

export function GlobalSearchDialog({
  open,
  onOpenChange,
  library,
  recentItemIds,
  onOpenItem
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  library: LibraryDto
  recentItemIds: readonly string[]
  onOpenItem: (itemId: string) => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [resolvedQuery, setResolvedQuery] = useState('')
  const [resultIds, setResultIds] = useState<readonly string[]>([])
  const [searchError, setSearchError] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState('')
  const requestId = useRef(0)
  const normalizedQuery = query.trim().toLocaleLowerCase()

  const changeOpen = useCallback(
    (nextOpen: boolean): void => {
      if (!nextOpen) {
        requestId.current += 1
        setQuery('')
        setResolvedQuery('')
        setResultIds([])
        setSearchError(false)
        setSelectedItemId('')
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (
        event.defaultPrevented ||
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLocaleLowerCase() !== 'k'
      ) {
        return
      }
      if (!open && document.querySelector('[role="dialog"]') !== null) return
      event.preventDefault()
      changeOpen(true)
    }
    window.addEventListener('keydown', handleShortcut, true)
    return () => window.removeEventListener('keydown', handleShortcut, true)
  }, [changeOpen, open])

  useEffect(() => {
    if (!open || !normalizedQuery) {
      requestId.current += 1
      return
    }
    const currentRequest = requestId.current + 1
    requestId.current = currentRequest
    const timer = window.setTimeout(() => {
      void window.kuskus.queryItems({ query: normalizedQuery }).then((result) => {
        if (currentRequest !== requestId.current) return
        startTransition(() => {
          setResolvedQuery(normalizedQuery)
          setResultIds(result.ok ? result.data.itemIds : [])
          setSearchError(!result.ok)
        })
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [normalizedQuery, open])

  const recentItems = useMemo(
    () => resolveRecentSearchItems(library.items, recentItemIds),
    [library.items, recentItemIds]
  )
  const itemsById = useMemo(
    () => new Map(library.items.map((item) => [item.id, item])),
    [library.items]
  )
  const resultItems = useMemo(() => {
    if (!normalizedQuery || resolvedQuery !== normalizedQuery) return []
    const matches: LibraryItemDto[] = []
    for (const itemId of resultIds) {
      const item = itemsById.get(itemId)
      if (!item || item.referencedAttachment) continue
      matches.push(item)
      if (matches.length === MAX_SEARCH_RESULTS) break
    }
    return matches
  }, [itemsById, normalizedQuery, resolvedQuery, resultIds])
  const displayedItems = normalizedQuery ? resultItems : recentItems
  const selectedItem =
    displayedItems.find((item) => item.id === selectedItemId) ?? displayedItems[0] ?? null
  const searchPending = Boolean(normalizedQuery && resolvedQuery !== normalizedQuery)

  const openItem = (itemId: string): void => {
    changeOpen(false)
    onOpenItem(itemId)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={changeOpen}
      title="Search library"
      description="Find and open an item anywhere in this library."
      className="top-1/2 h-[min(38rem,calc(100vh-2rem))] max-w-[calc(100%-2rem)] -translate-y-1/2 sm:max-w-[min(68rem,calc(100%-2rem))]"
    >
      <Command
        shouldFilter={false}
        value={selectedItem?.id ?? ''}
        onValueChange={setSelectedItemId}
        className="rounded-4xl"
      >
        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] min-[48rem]:grid-cols-[minmax(22rem,0.95fr)_minmax(0,1.05fr)]">
          <div className="min-[48rem]:border-r min-[48rem]:border-border/60">
            <CommandInput
              autoFocus
              value={query}
              onValueChange={(value) => {
                setQuery(value)
                setSearchError(false)
              }}
              placeholder="Search notes, links, images, and files…"
              aria-label="Search the entire library"
              aria-keyshortcuts="Control+K Meta+K"
            />
          </div>
          <ScrollArea className="min-h-0 min-w-0 border-border/60 min-[48rem]:border-r [&_[data-slot=scroll-area-viewport]]:focus-visible:ring-0 [&_[data-slot=scroll-area-viewport]]:focus-visible:outline-none">
            <CommandList className="max-h-none overflow-visible p-1.5">
              {displayedItems.length === 0 && !searchPending ? (
                <CommandEmpty>
                  {searchError
                    ? 'Search is temporarily unavailable'
                    : normalizedQuery
                      ? 'No matching items'
                      : 'Open an item to see it here later'}
                </CommandEmpty>
              ) : null}
              {searchPending ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground" role="status">
                  Searching…
                </p>
              ) : null}
              {displayedItems.length > 0 ? (
                <CommandGroup heading={normalizedQuery ? 'All library' : 'Recently opened'}>
                  {displayedItems.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => openItem(item.id)}
                      className="min-h-16 rounded-xl! px-3 py-2.5"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <ItemTypeIcon item={item} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate font-medium">{item.title}</span>
                        <span className="truncate text-xs font-normal text-muted-foreground">
                          {resultSupportingText(item)}
                        </span>
                        <span className="flex min-w-0 items-center gap-1 text-[0.6875rem] font-normal text-muted-foreground/75">
                          <ItemLocationIcon item={item} />
                          <span className="truncate">
                            {itemLocationLabel(item, library.collections)}
                          </span>
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>
          </ScrollArea>

          <aside
            className="hidden min-h-0 min-w-0 flex-col min-[48rem]:col-start-2 min-[48rem]:row-start-1 min-[48rem]:row-end-3 min-[48rem]:flex"
            aria-label="Preview"
          >
            {selectedItem ? (
              <GlobalSearchPreview
                item={selectedItem}
                locationLabel={itemLocationLabel(selectedItem, library.collections)}
                typeLabel={itemTypeLabel(selectedItem)}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <IconSearch aria-hidden="true" />
                </span>
                <p className="max-w-52 text-pretty text-sm">
                  Search the entire library without leaving your current workspace.
                </p>
              </div>
            )}
          </aside>
        </div>
        <footer className="flex h-10 shrink-0 items-center justify-between border-t border-border/60 px-4 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {searchPending
              ? 'Searching…'
              : `${displayedItems.length}${normalizedQuery && resultIds.length > MAX_SEARCH_RESULTS ? '+' : ''} ${displayedItems.length === 1 ? 'item' : 'items'}`}
          </span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Kbd>↑↓</Kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>Enter</Kbd> open
            </span>
            <span className="flex items-center gap-1">
              <Kbd>Esc</Kbd> close
            </span>
          </span>
        </footer>
      </Command>
    </CommandDialog>
  )
}
