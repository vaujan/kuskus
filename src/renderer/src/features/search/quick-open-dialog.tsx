import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconNote, IconPlus } from '@tabler/icons-react'

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut
} from '@/components/ui/command'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import {
  resolveQuickOpenItems,
  resolveRecentSearchItems
} from '@/features/search/global-search-state'
import type { LibraryDto } from '../../../../shared/library-contract'

export function QuickOpenDialog({
  open,
  onOpenChange,
  library,
  recentItemIds,
  onOpenItem,
  onCreateNote,
  onNewNote,
  onAddItem
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  library: LibraryDto
  recentItemIds: readonly string[]
  onOpenItem: (itemId: string) => void
  onCreateNote: (title: string) => void
  onNewNote: () => void
  onAddItem: () => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim()
  const displayedItems = useMemo(
    () =>
      normalizedQuery
        ? resolveQuickOpenItems(library.items, normalizedQuery)
        : resolveRecentSearchItems(library.items, recentItemIds),
    [library.items, normalizedQuery, recentItemIds]
  )

  const changeOpen = useCallback(
    (nextOpen: boolean): void => {
      if (!nextOpen) setQuery('')
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
        event.key.toLocaleLowerCase() !== 'o'
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

  const openItem = (itemId: string): void => {
    changeOpen(false)
    onOpenItem(itemId)
  }

  const createNote = (): void => {
    if (!normalizedQuery) return
    changeOpen(false)
    onCreateNote(normalizedQuery)
  }

  const runAction = (action: () => void): void => {
    changeOpen(false)
    action()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={changeOpen}
      title="Quick Open"
      description="Open an item by title or filename, or create a note."
      className="max-h-[min(28rem,calc(100vh-2rem))] max-w-[calc(100%-2rem)] sm:max-w-xl"
    >
      <Command shouldFilter={false} className="rounded-4xl bg-popover/90">
        <CommandInput
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Open an item or create a note…"
          aria-label="Quick Open"
          aria-keyshortcuts="Control+O Meta+O"
        />
        <CommandList className="max-h-[min(22rem,calc(100vh-8rem))] p-1.5">
          {displayedItems.length === 0 && !normalizedQuery ? (
            <CommandEmpty>Open an item to see it here later</CommandEmpty>
          ) : null}
          {displayedItems.length > 0 ? (
            <CommandGroup heading={normalizedQuery ? 'Open' : 'Recently opened'}>
              {displayedItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => openItem(item.id)}
                  className="min-h-12 rounded-xl! px-3 py-2"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate">{item.title}</span>
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {item.relativePath}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {!normalizedQuery ? (
            <CommandGroup heading="Create">
              <CommandItem value="new-note" onSelect={() => runAction(onNewNote)}>
                <IconNote aria-hidden="true" />
                <span>New note</span>
                <CommandShortcut>Ctrl+N</CommandShortcut>
              </CommandItem>
              <CommandItem value="add-item" onSelect={() => runAction(onAddItem)}>
                <IconPlus aria-hidden="true" />
                <span>Add item</span>
                <CommandShortcut>Ctrl+Shift+N</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          ) : null}
          {normalizedQuery ? (
            <CommandGroup heading="Create">
              <CommandItem
                value={`create-note:${normalizedQuery.toLocaleLowerCase()}`}
                onSelect={createNote}
                className="min-h-12 rounded-xl! px-3 py-2"
              >
                <IconNote aria-hidden="true" />
                <span className="truncate">Create note “{normalizedQuery}”</span>
              </CommandItem>
            </CommandGroup>
          ) : null}
        </CommandList>
        <footer className="flex h-10 shrink-0 items-center justify-end gap-3 border-t border-border/60 px-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <KbdGroup role="group" aria-label="Up and down arrow keys">
              <Kbd aria-hidden="true">↑</Kbd>
              <Kbd aria-hidden="true">↓</Kbd>
            </KbdGroup>{' '}
            navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Enter</Kbd> open or create
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd> close
          </span>
        </footer>
      </Command>
    </CommandDialog>
  )
}
