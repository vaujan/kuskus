import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconCopy,
  IconCopyPlus,
  IconDots,
  IconFolderOpen,
  IconInfoCircle,
  IconRulerMeasure,
  IconTextCaption
} from '@tabler/icons-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Toaster } from '@/features/shell/app-toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  ItemDetailDialog,
  type DetailTitleRenameResult,
  type ItemDetailHandle
} from '@/features/items/item-detail-dialog'
import type { NoteDetailMenuOptions } from '@/features/items/item-action-menu'
import { WindowControls } from '@/features/shell/window-controls'
import { useAppZoom } from '@/hooks/use-app-zoom'
import { useNoteVim } from '@/hooks/use-note-vim'
import { expandLibraryOverview } from '@/features/library/library-overview'
import type { LibraryDto, LibraryItemDto, NoteItemDto } from '../../../../shared/library-contract'

function NoteWindowActions({
  options,
  onDuplicate,
  onCopyPath,
  onShowInExplorer
}: {
  options: NoteDetailMenuOptions
  onDuplicate: () => void
  onCopyPath: () => void
  onShowInExplorer: () => void
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-10"
            aria-label="Note actions"
          />
        }
      >
        <IconDots aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>View</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={options.readableLineLength}
            onCheckedChange={options.onReadableLineLengthChange}
          >
            <IconRulerMeasure aria-hidden="true" />
            Readable line length
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={options.inlineTitle}
            onCheckedChange={options.onInlineTitleChange}
          >
            <IconTextCaption aria-hidden="true" />
            Inline title
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={options.onCopyAsMarkdown}>
          <IconCopy aria-hidden="true" />
          Copy as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <IconCopyPlus aria-hidden="true" />
          Duplicate note
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCopyPath}>
          <IconCopy aria-hidden="true" />
          Copy file path
        </DropdownMenuItem>
        <DropdownMenuItem onClick={options.onShowDetails}>
          <IconInfoCircle aria-hidden="true" />
          Note details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onShowInExplorer}>
          <IconFolderOpen aria-hidden="true" />
          Show in Explorer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function NoteWindowApp({ itemId }: { itemId: string }): React.JSX.Element {
  const detailRef = useRef<ItemDetailHandle>(null)
  const closePendingRef = useRef(false)
  const [library, setLibrary] = useState<LibraryDto | null>(null)
  const [item, setItem] = useState<NoteItemDto | null>(null)
  const [error, setError] = useState('')
  const [vimEnabled] = useNoteVim()
  useAppZoom()

  const refresh = useCallback(async (): Promise<void> => {
    const [overviewResult, itemResult] = await Promise.all([
      window.kuskus.getOverview(),
      window.kuskus.getItemDetail(itemId)
    ])
    if (!overviewResult.ok) {
      setError(overviewResult.error)
      return
    }
    const state = expandLibraryOverview(overviewResult.data)
    if (state.status !== 'ready') {
      setError('The library is unavailable.')
      return
    }
    if (!itemResult.ok || itemResult.data.type !== 'note') {
      setError(itemResult.ok ? 'The selected item is not a note.' : itemResult.error)
      return
    }
    setLibrary(state.library)
    setItem(itemResult.data)
    setError('')
  }, [itemId])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh())
    const unsubscribe = window.kuskus.onVaultChanged(() => void refresh())
    return () => {
      window.clearTimeout(initialLoad)
      unsubscribe()
    }
  }, [refresh])

  useEffect(() => {
    document.title = item?.title ?? 'Kuskus note'
  }, [item?.title])

  useEffect(
    () =>
      window.electron.window.onNoteWindowCloseRequested(() => {
        if (closePendingRef.current) return
        closePendingRef.current = true
        const flush = detailRef.current?.flush() ?? Promise.resolve(true)
        void flush
          .then((approved) => window.electron.window.resolveNoteWindowClose(approved))
          .catch(() => window.electron.window.resolveNoteWindowClose(false))
          .finally(() => {
            closePendingRef.current = false
          })
      }),
    []
  )

  const updateItem = useCallback((updated: LibraryItemDto): void => {
    if (updated.type !== 'note') return
    setItem(updated)
    setLibrary((current) =>
      current
        ? {
            ...current,
            items: current.items.map((entry) => (entry.id === updated.id ? updated : entry))
          }
        : current
    )
  }, [])

  const renameItem = useCallback(
    async (current: LibraryItemDto, title: string): Promise<DetailTitleRenameResult> => {
      const result = await window.kuskus.renameItem({ itemId: current.id, title })
      if (!result.ok) return { ok: false, error: result.error }
      setLibrary(result.data)
      const renamed = result.data.items.find((entry) => entry.id === current.id)
      if (renamed?.type === 'note') setItem(renamed)
      return { ok: true }
    },
    []
  )

  const useFirstLineAsTitle = useCallback(async (current: NoteItemDto): Promise<void> => {
    const result = await window.kuskus.renameItem({ itemId: current.id, titleSource: 'derived' })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setLibrary(result.data)
    const renamed = result.data.items.find((entry) => entry.id === current.id)
    if (renamed?.type === 'note') setItem(renamed)
  }, [])

  const trashNote = useCallback(async (noteId: string): Promise<boolean> => {
    const inspection = await window.kuskus.inspectItemDeletion({ itemIds: [noteId], mode: 'trash' })
    if (!inspection.ok) {
      setError(inspection.error)
      return false
    }
    if (inspection.data.referencedItems.length > 0) {
      setError('Review this note in the main window before moving it to Trash.')
      return false
    }
    const result = await window.kuskus.trashItems({
      itemIds: [noteId],
      referenceRevision: inspection.data.revision
    })
    if (!result.ok) {
      setError(result.error)
      return false
    }
    setLibrary(result.data)
    return true
  }, [])

  const openVaultLink = useCallback(
    (target: string): void => {
      if (!library) return
      const normalized = target.replace(/\\/g, '/').replace(/\.md$/i, '').toLocaleLowerCase()
      const matches = library.items.filter((candidate) => {
        if (candidate.type !== 'note') return false
        const path = candidate.relativePath.replace(/\.md$/i, '').toLocaleLowerCase()
        return path === normalized || candidate.title.toLocaleLowerCase() === normalized
      })
      if (matches.length !== 1) {
        setError(
          matches.length === 0
            ? `The linked note “${target}” could not be found.`
            : `The linked note “${target}” is ambiguous.`
        )
        return
      }
      void window.electron.window.openNoteWindow(matches[0].id).catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'The linked note could not be opened.')
      })
    },
    [library]
  )

  return (
    <TooltipProvider>
      <main className="window-root window-canvas relative flex h-screen min-h-0 overflow-hidden text-foreground">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-30 h-10 [-webkit-app-region:drag]"
          aria-hidden="true"
        />
        <div className="absolute top-0 right-0 z-50 h-10">
          <WindowControls />
        </div>
        {error ? (
          <Alert variant="destructive" className="absolute top-12 right-4 left-4 z-50">
            <AlertTitle>Unable to complete action</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {item && library ? (
          <ItemDetailDialog
            ref={detailRef}
            item={item}
            collections={library.collections}
            libraryItems={library.items}
            presentation="focus"
            vimEnabled={vimEnabled}
            expanded
            expandable={false}
            hasPrevious={false}
            hasNext={false}
            onPrevious={() => undefined}
            onNext={() => undefined}
            onOpenChange={() => undefined}
            onItemUpdated={updateItem}
            onRenameItem={renameItem}
            onUseFirstLineAsTitle={useFirstLineAsTitle}
            onRenameAttachment={() => undefined}
            onMoveItem={() => undefined}
            onOpenVaultLink={openVaultLink}
            onMoveToTrash={(noteId) => {
              void trashNote(noteId).then((trashed) => {
                if (trashed) window.electron.window.close()
              })
            }}
            onEmptyNote={trashNote}
            renderActions={(guard, options) =>
              options ? (
                <NoteWindowActions
                  options={options}
                  onDuplicate={() =>
                    guard(() => {
                      void window.kuskus.duplicateNote(item.id).then((result) => {
                        if (result.ok) setLibrary(result.data)
                        else setError(result.error)
                      })
                    })
                  }
                  onCopyPath={() =>
                    guard(() => {
                      void window.kuskus.copyItemPath(item.id).then((result) => {
                        if (!result.ok) setError(result.error)
                      })
                    })
                  }
                  onShowInExplorer={() =>
                    guard(() => {
                      void window.kuskus.showItemInExplorer(item.id).then((result) => {
                        if (!result.ok) setError(result.error)
                      })
                    })
                  }
                />
              ) : null
            }
            onError={setError}
          />
        ) : error ? null : (
          <div className="grid size-full place-items-center text-sm text-muted-foreground">
            Opening note…
          </div>
        )}
        <Toaster position="bottom-right" />
      </main>
    </TooltipProvider>
  )
}
