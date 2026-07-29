import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  IconInbox as Inbox,
  IconPhoto as FileImage,
  IconSearch as Search,
  IconX as X
} from '@tabler/icons-react'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
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
import { getFolderSubtreeIds } from '@/features/collections/folder-tree'
import { SavedItemCard } from '@/features/items/saved-item-card'
import { SavedItemsTable } from '@/features/items/saved-items-table'
import { KUSKUS_ITEM_DRAG_TYPE } from '@/features/items/item-drag'
import { ItemDetailDialog } from '@/features/items/item-detail-dialog'
import { openExternalUrlWithFeedback } from '@/features/items/open-external-url'
import {
  resolveItemShortcutTargets,
  resolveRenameShortcutTarget
} from '@/features/items/item-shortcuts'
import { BulkActionToolbar } from '@/features/library/bulk-action-toolbar'
import { OrderedMasonry } from '@/features/library/ordered-masonry'
import {
  ItemActionMenu,
  ItemContextMenu,
  type ItemActionHandlers
} from '@/features/items/item-action-menu'
import {
  ITEM_SORT_STORAGE_KEY,
  parseItemSort,
  sortItems,
  type ItemSort
} from '@/features/items/item-sort'
import { type ItemTypeFilter, type LibraryView } from '@/features/items/item-view'
import { AppToolbar } from '@/features/shell/app-toolbar'
import { LibrarySidebar, type LibraryDestination } from '@/features/shell/library-sidebar'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import type {
  ActiveItemLocation,
  ApiResult,
  LibraryDto,
  LibraryItemDto,
  UrlItemDto
} from '../../../../shared/library-contract'
import type { GlobalCaptureShortcutStatus } from '../../../../shared/window-contract'
import {
  notifyArchived,
  notifyGlobalCapturePrepared,
  notifyGlobalCaptureUnavailable,
  notifyPermanentlyDeleted,
  notifyRenamed,
  notifyRestored,
  notifyTrashed,
  notifyUnarchived
} from '@/lib/notify'

const DEFAULT_SIDEBAR_WIDTH = 256
const MIN_SIDEBAR_WIDTH = 208
const MAX_SIDEBAR_WIDTH = 384

function itemMatchesRetrieval(
  item: LibraryItemDto,
  query: string,
  typeFilters: ItemTypeFilter[]
): boolean {
  if (typeFilters.length > 0 && !typeFilters.includes(item.type)) return false
  if (!query) return true
  const searchableText = [
    item.title,
    item.type === 'note' ? item.body : '',
    item.type === 'image' ? (item.sourceFilename ?? item.contentFilename) : '',
    item.type === 'file' ? `${item.sourceFilename} ${item.contentFilename}` : '',
    item.type === 'url' ? `${item.domain} ${item.sourceUrl} ${item.description ?? ''}` : ''
  ]
    .join(' ')
    .toLocaleLowerCase()
  return searchableText.includes(query)
}

function itemMatchesDestination(
  item: LibraryItemDto,
  destination: LibraryDestination,
  collectionSubtreeIds?: ReadonlySet<string> | null
): boolean {
  if (destination.type === 'all') {
    return item.location.type === 'inbox' || item.location.type === 'collection'
  }
  if (destination.type === 'collection') {
    if (item.location.type !== 'collection') return false
    return collectionSubtreeIds
      ? collectionSubtreeIds.has(item.location.collectionId)
      : item.location.collectionId === destination.collectionId
  }
  return item.location.type === destination.type
}

function destinationLabel(destination: LibraryDestination, library: LibraryDto): string {
  if (destination.type === 'inbox') return 'Inbox'
  if (destination.type === 'all') return 'All Items'
  if (destination.type === 'archive') return 'Archive'
  if (destination.type === 'trash') return 'Trash'
  return (
    library.collections.find((collection) => collection.id === destination.collectionId)?.name ??
    'Folder'
  )
}

export function Workspace({ initialLibrary }: { initialLibrary: LibraryDto }): React.JSX.Element {
  const [library, setLibrary] = useState(initialLibrary)
  const [sidebarHidden, setSidebarHidden] = useState(
    () => localStorage.getItem('kuskus-sidebar-hidden') === 'true'
  )
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const storedValue = localStorage.getItem('kuskus-sidebar-width')
    if (storedValue === null) return DEFAULT_SIDEBAR_WIDTH
    const storedWidth = Number(storedValue)
    if (!Number.isFinite(storedWidth)) return DEFAULT_SIDEBAR_WIDTH
    return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, storedWidth))
  })
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerHasDraft, setComposerHasDraft] = useState(false)
  const [composerFocusRequest, setComposerFocusRequest] = useState(0)
  const [composerDiscardRequest, setComposerDiscardRequest] = useState(0)
  const [newItemFocusRequest, setNewItemFocusRequest] = useState(0)
  const [importRequest, setImportRequest] = useState<ImportRequest | null>(null)
  const [composerHasTransientWork, setComposerHasTransientWork] = useState(false)
  const [composerOwnedItemId, setComposerOwnedItemId] = useState<string | null>(null)
  const [globalCaptureShortcutStatus, setGlobalCaptureShortcutStatus] =
    useState<GlobalCaptureShortcutStatus | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilters, setTypeFilters] = useState<ItemTypeFilter[]>([])
  const [sort, setSort] = useState<ItemSort>(() =>
    parseItemSort(localStorage.getItem(ITEM_SORT_STORAGE_KEY))
  )
  const [view, setView] = useState<LibraryView>(() => {
    const stored = localStorage.getItem('kuskus-library-view')
    if (stored === 'list') return 'table'
    return stored === 'grid' || stored === 'table' ? stored : 'visual'
  })
  const [showReferencedAttachments, setShowReferencedAttachments] = useState(
    () => localStorage.getItem('kuskus-show-referenced-attachments') === 'true'
  )
  const [message, setMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [destination, setDestination] = useState<LibraryDestination>({ type: 'inbox' })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<LibraryItemDto | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [deleteTargets, setDeleteTargets] = useState<string[]>([])
  const [itemOperationBusy, setItemOperationBusy] = useState(false)
  const [theme, setTheme] = useTheme()
  const deferredSearch = useDeferredValue(search)
  const importRequestId = useRef(0)
  const dragDepth = useRef(0)
  const enrichingUrlIds = useRef(new Set<string>())
  const pendingRevealItemId = useRef<string | null>(null)
  const shortcutFailureNotified = useRef(false)
  const draftStorageKey = `kuskus-note-draft:${library.path}`

  const announceStatus = useCallback((message: string): void => {
    setStatusMessage('')
    window.requestAnimationFrame(() => setStatusMessage(message))
  }, [])

  const clearSelection = useCallback((): void => {
    setSelectedIds(new Set())
    setSelectionAnchorId(null)
    announceStatus('Selection cleared')
  }, [announceStatus])

  useEffect(() => {
    localStorage.setItem('kuskus-sidebar-hidden', String(sidebarHidden))
  }, [sidebarHidden])

  useEffect(() => {
    localStorage.setItem('kuskus-sidebar-width', String(sidebarWidth))
  }, [sidebarWidth])

  useEffect(() => {
    localStorage.setItem('kuskus-library-view', view)
  }, [view])

  useEffect(() => {
    localStorage.setItem(ITEM_SORT_STORAGE_KEY, sort)
  }, [sort])

  useEffect(() => {
    localStorage.setItem('kuskus-show-referenced-attachments', String(showReferencedAttachments))
  }, [showReferencedAttachments])

  const refreshVault = useCallback(async (): Promise<void> => {
    const result = await window.kuskus.getState()
    if (!result.ok || result.data.status !== 'ready') return
    const refreshedLibrary = result.data.library
    startTransition(() => setLibrary(refreshedLibrary))
  }, [])

  useEffect(() => {
    const unsubscribe = window.kuskus.onVaultChanged(() => void refreshVault())
    const onFocus = (): void => void refreshVault()
    window.addEventListener('focus', onFocus)
    return () => {
      unsubscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshVault])

  const collectionSubtreeIds = useMemo(
    () =>
      destination.type === 'collection'
        ? getFolderSubtreeIds(library.collections, destination.collectionId)
        : null,
    [destination, library.collections]
  )
  const visibleItems = useMemo(() => {
    const query = deferredSearch.trim().toLocaleLowerCase()
    const filtered = library.items.filter(
      (item) =>
        item.id !== composerOwnedItemId &&
        (showReferencedAttachments || !item.referencedAttachment) &&
        itemMatchesDestination(item, destination, collectionSubtreeIds) &&
        itemMatchesRetrieval(item, query, typeFilters)
    )
    return sortItems(filtered, sort)
  }, [
    collectionSubtreeIds,
    composerOwnedItemId,
    deferredSearch,
    destination,
    library.items,
    showReferencedAttachments,
    sort,
    typeFilters
  ])
  const destinationItems = useMemo(
    () =>
      library.items.filter((item) =>
        itemMatchesDestination(item, destination, collectionSubtreeIds)
      ),
    [collectionSubtreeIds, destination, library.items]
  )
  const openVaultLink = useCallback(
    (target: string): void => {
      const normalized = target.replace(/\\/g, '/').replace(/\.md$/i, '').toLocaleLowerCase()
      const matches = library.items.filter((item) => {
        if (item.type === 'image') return false
        const path = item.relativePath.replace(/\.md$/i, '').toLocaleLowerCase()
        return path === normalized || item.title.toLocaleLowerCase() === normalized
      })
      if (matches.length !== 1) {
        setMessage(
          matches.length === 0
            ? `The linked note “${target}” could not be found.`
            : `The linked note “${target}” is ambiguous.`
        )
        return
      }
      setSelectedItemId(matches[0].id)
    },
    [library.items]
  )
  const selectAllVisibleItems = useCallback((): void => {
    setSelectedIds(new Set(visibleItems.map((item) => item.id)))
    setSelectionAnchorId(null)
    announceStatus(
      `${visibleItems.length} ${visibleItems.length === 1 ? 'item' : 'items'} selected`
    )
  }, [announceStatus, visibleItems])

  // A newly saved item joins the active sorted position rather than always landing first;
  // once it renders, scroll it into view and announce the save.
  useEffect(() => {
    const itemId = pendingRevealItemId.current
    if (!itemId) return
    const revealed = visibleItems.find((item) => item.id === itemId)
    if (!revealed) {
      pendingRevealItemId.current = null
      return
    }
    pendingRevealItemId.current = null
    const element = document.querySelector(`[data-item-id="${CSS.escape(itemId)}"]`)
    if (element instanceof HTMLElement) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' })
    }
    const kindLabel =
      revealed.type === 'note' ? 'note' : revealed.type === 'image' ? 'image' : 'link'
    announceStatus(`Saved ${kindLabel}.`)
  }, [announceStatus, visibleItems])

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

  const changeDestination = useCallback((next: LibraryDestination): void => {
    setDestination(next)
    setSelectedIds(new Set())
    setSelectionAnchorId(null)
    setSelectedItemId(null)
    setComposerOpen(false)
  }, [])

  const pruneSelectionForRetrieval = useCallback(
    (query: string, filters: ItemTypeFilter[]): void => {
      const matchingIds = new Set(
        library.items
          .filter(
            (item) =>
              itemMatchesDestination(item, destination, collectionSubtreeIds) &&
              itemMatchesRetrieval(item, query.trim().toLocaleLowerCase(), filters)
          )
          .map((item) => item.id)
      )
      setSelectedIds((current) => {
        const next = new Set([...current].filter((itemId) => matchingIds.has(itemId)))
        return next.size === current.size ? current : next
      })
      setSelectionAnchorId((current) => (current && matchingIds.has(current) ? current : null))
    },
    [collectionSubtreeIds, destination, library.items]
  )

  const changeSearch = useCallback(
    (next: string): void => {
      setSearch(next)
      pruneSelectionForRetrieval(next, typeFilters)
    },
    [pruneSelectionForRetrieval, typeFilters]
  )

  const changeTypeFilter = useCallback(
    (type: ItemTypeFilter, selected: boolean): void => {
      const next = selected
        ? typeFilters.includes(type)
          ? typeFilters
          : [...typeFilters, type]
        : typeFilters.filter((entry) => entry !== type)
      setTypeFilters(next)
      pruneSelectionForRetrieval(search, next)
    },
    [pruneSelectionForRetrieval, search, typeFilters]
  )

  const addCreatedItem = useCallback(
    async (item: LibraryItemDto): Promise<boolean> => {
      let nextItem = item
      if (destination.type === 'collection') {
        const result = await window.kuskus.moveItems({
          itemIds: [item.id],
          destination: { type: 'collection', collectionId: destination.collectionId }
        })
        if (!result.ok) {
          setMessage(result.error)
          return false
        } else {
          setLibrary(result.data)
          nextItem = result.data.items.find((entry) => entry.id === item.id) ?? item
        }
      } else {
        setLibrary((current) => ({ ...current, items: [item, ...current.items] }))
      }
      setMessage('')
      const remainsVisible =
        itemMatchesDestination(nextItem, destination, collectionSubtreeIds) &&
        itemMatchesRetrieval(nextItem, search.trim().toLocaleLowerCase(), typeFilters)
      if (remainsVisible) pendingRevealItemId.current = nextItem.id
      return remainsVisible
    },
    [collectionSubtreeIds, destination, search, typeFilters]
  )

  const commitLinkItem = useCallback(
    async (item: UrlItemDto): Promise<{ item: UrlItemDto; remainsVisible: boolean }> => {
      setComposerOwnedItemId(item.id)
      let nextItem = item
      if (destination.type === 'collection') {
        const result = await window.kuskus.moveItems({
          itemIds: [item.id],
          destination: { type: 'collection', collectionId: destination.collectionId }
        })
        if (result.ok) {
          setLibrary(result.data)
          const moved = result.data.items.find((entry) => entry.id === item.id)
          if (moved?.type === 'url') nextItem = moved
          setMessage('')
        } else {
          setLibrary((current) => ({ ...current, items: [item, ...current.items] }))
          setMessage(`${result.error} The link was kept in Inbox.`)
        }
      } else {
        setLibrary((current) => ({ ...current, items: [item, ...current.items] }))
        setMessage('')
      }
      return {
        item: nextItem,
        remainsVisible:
          itemMatchesDestination(nextItem, destination, collectionSubtreeIds) &&
          itemMatchesRetrieval(nextItem, search.trim().toLocaleLowerCase(), typeFilters)
      }
    },
    [collectionSubtreeIds, destination, search, typeFilters]
  )

  const updateItem = useCallback((item: LibraryItemDto): void => {
    setLibrary((current) => ({
      ...current,
      items: current.items.map((entry) => (entry.id === item.id ? item : entry))
    }))
  }, [])

  const applyLibraryResult = useCallback(
    (result: ApiResult<LibraryDto>): LibraryDto | null => {
      if (!result.ok) {
        setMessage(result.error)
        return null
      }
      setLibrary(result.data)
      setSelectedItemId((current) => {
        if (!current) return current
        const item = result.data.items.find((entry) => entry.id === current)
        return item && itemMatchesDestination(item, destination, collectionSubtreeIds)
          ? current
          : null
      })
      setMessage('')
      setSelectedIds(new Set())
      setSelectionAnchorId(null)
      return result.data
    },
    [collectionSubtreeIds, destination]
  )

  const moveItemIds = useCallback(
    async (itemIds: string[], nextDestination: ActiveItemLocation): Promise<void> => {
      setItemOperationBusy(true)
      try {
        applyLibraryResult(await window.kuskus.moveItems({ itemIds, destination: nextDestination }))
      } finally {
        setItemOperationBusy(false)
      }
    },
    [applyLibraryResult]
  )

  const beginItemDrag = useCallback(
    (itemId: string, event: React.DragEvent<HTMLElement>): void => {
      const itemIds = selectedIds.has(itemId) ? [...selectedIds] : [itemId]
      if (!selectedIds.has(itemId)) {
        setSelectedIds(new Set([itemId]))
        setSelectionAnchorId(itemId)
      }
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData(KUSKUS_ITEM_DRAG_TYPE, JSON.stringify(itemIds))
      event.dataTransfer.setData(
        'text/plain',
        `${itemIds.length} Kuskus ${itemIds.length === 1 ? 'item' : 'items'}`
      )
    },
    [selectedIds]
  )

  const archiveItemIds = useCallback(
    async (itemIds: string[], showUndo = true): Promise<void> => {
      setItemOperationBusy(true)
      try {
        const result = await window.kuskus.archiveItems({ itemIds })
        if (!applyLibraryResult(result)) return
        if (showUndo) {
          notifyArchived(itemIds.length, () => {
            void window.kuskus
              .unarchiveItems({ itemIds })
              .then((undoResult) => applyLibraryResult(undoResult))
          })
        }
      } finally {
        setItemOperationBusy(false)
      }
    },
    [applyLibraryResult]
  )

  const unarchiveItemIds = useCallback(
    async (itemIds: string[], notify = true): Promise<void> => {
      const missingPreviousFolder = itemIds.some((itemId) => {
        const item = library.items.find((entry) => entry.id === itemId)
        const collectionId =
          item?.location.type === 'archive' ? item.location.originalCollectionId : null
        return (
          collectionId !== null &&
          !library.collections.some((collection) => collection.id === collectionId)
        )
      })
      setItemOperationBusy(true)
      try {
        const result = await window.kuskus.unarchiveItems({ itemIds })
        if (!applyLibraryResult(result)) return
        if (notify) {
          notifyUnarchived(
            itemIds.length,
            missingPreviousFolder
              ? 'A previous folder was unavailable, so the item was returned to Inbox.'
              : undefined
          )
        }
      } finally {
        setItemOperationBusy(false)
      }
    },
    [applyLibraryResult, library.collections, library.items]
  )

  const trashItemIds = useCallback(
    async (itemIds: string[], showUndo = true): Promise<void> => {
      setItemOperationBusy(true)
      try {
        const result = await window.kuskus.trashItems({ itemIds })
        if (!applyLibraryResult(result)) return
        if (showUndo) {
          notifyTrashed(itemIds.length, () => {
            void window.kuskus
              .restoreItems({ itemIds })
              .then((undoResult) => applyLibraryResult(undoResult))
          })
        }
      } finally {
        setItemOperationBusy(false)
      }
    },
    [applyLibraryResult]
  )

  const restoreItemIds = useCallback(
    async (itemIds: string[], notify = true): Promise<void> => {
      const missingPreviousFolder = itemIds.some((itemId) => {
        const item = library.items.find((entry) => entry.id === itemId)
        if (item?.location.type !== 'trash' || item.location.trashedFrom !== 'collection') {
          return false
        }
        const collectionId = item.location.originalCollectionId
        return (
          collectionId !== null &&
          !library.collections.some((collection) => collection.id === collectionId)
        )
      })
      setItemOperationBusy(true)
      try {
        const result = await window.kuskus.restoreItems({ itemIds })
        if (!applyLibraryResult(result)) return
        if (notify) {
          notifyRestored(
            itemIds.length,
            missingPreviousFolder
              ? 'A previous folder was unavailable, so the item was restored to Inbox.'
              : undefined
          )
        }
      } finally {
        setItemOperationBusy(false)
      }
    },
    [applyLibraryResult, library.collections, library.items]
  )

  const revealItem = useCallback(async (itemId: string): Promise<void> => {
    const result = await window.kuskus.showItemInExplorer(itemId)
    if (!result.ok) setMessage(result.error)
  }, [])

  const openSource = useCallback(async (item: LibraryItemDto): Promise<void> => {
    if (item.type !== 'url') return
    await openExternalUrlWithFeedback(item.sourceUrl)
  }, [])

  const selectItem = useCallback(
    (itemId: string, event: Pick<React.MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>): void => {
      if (event.shiftKey && selectionAnchorId) {
        const anchorIndex = visibleItems.findIndex((item) => item.id === selectionAnchorId)
        const itemIndex = visibleItems.findIndex((item) => item.id === itemId)
        if (anchorIndex >= 0 && itemIndex >= 0) {
          const start = Math.min(anchorIndex, itemIndex)
          const end = Math.max(anchorIndex, itemIndex)
          setSelectedIds(new Set(visibleItems.slice(start, end + 1).map((item) => item.id)))
          return
        }
      }
      if (event.ctrlKey || event.metaKey) {
        setSelectedIds((current) => {
          const next = new Set(current)
          if (next.has(itemId)) next.delete(itemId)
          else next.add(itemId)
          return next
        })
      } else {
        setSelectedIds(new Set([itemId]))
      }
      setSelectionAnchorId(itemId)
    },
    [selectionAnchorId, visibleItems]
  )

  const activateItem = useCallback(
    (itemId: string, event: Pick<React.MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>): void => {
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        selectItem(itemId, event)
        return
      }

      setSelectedIds(new Set())
      setSelectionAnchorId(null)
      setSelectedItemId(itemId)
    },
    [selectItem]
  )

  const itemActions = useCallback(
    (item: LibraryItemDto): ItemActionHandlers => ({
      onOpen: () => setSelectedItemId(item.id),
      onRename: () => {
        setRenameTarget(item)
        setRenameTitle(item.title)
      },
      onMove: (nextDestination) => void moveItemIds([item.id], nextDestination),
      onReveal: () => void revealItem(item.id),
      onArchive: () => void archiveItemIds([item.id]),
      onUnarchive: () => void unarchiveItemIds([item.id]),
      onTrash: () => void trashItemIds([item.id]),
      onRestore: () => void restoreItemIds([item.id]),
      onDeletePermanently: () => setDeleteTargets([item.id]),
      onOpenSource: () => void openSource(item)
    }),
    [
      archiveItemIds,
      moveItemIds,
      openSource,
      restoreItemIds,
      revealItem,
      trashItemIds,
      unarchiveItemIds
    ]
  )

  useEffect(() => {
    const handleItemShortcut = (event: KeyboardEvent): void => {
      if (
        event.defaultPrevented ||
        (event.key !== 'F2' && event.key !== 'Delete') ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        selectedItemId !== null ||
        renameTarget !== null ||
        deleteTargets.length > 0 ||
        itemOperationBusy
      ) {
        return
      }

      const target = event.target
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="menu"], [role="dialog"], [role="listbox"]'
        )
      ) {
        return
      }

      const focusedItemId =
        target instanceof Element
          ? target.closest<HTMLElement>('[data-item-id]')?.dataset.itemId
          : null
      const visibleItemIds = new Set(visibleItems.map((item) => item.id))
      const targetIds = resolveItemShortcutTargets(
        selectedIds,
        focusedItemId ?? null,
        visibleItemIds
      )
      if (targetIds.length === 0) return

      if (event.key === 'F2') {
        if (destination.type === 'trash') return
        const renameItemId = resolveRenameShortcutTarget(targetIds)
        if (renameItemId === null) return
        const item = visibleItems.find((candidate) => candidate.id === renameItemId)
        if (!item) return

        event.preventDefault()
        setRenameTarget(item)
        setRenameTitle(item.title)
        return
      }

      event.preventDefault()
      if (destination.type === 'trash') setDeleteTargets(targetIds)
      else void trashItemIds(targetIds)
    }
    window.addEventListener('keydown', handleItemShortcut)
    return () => window.removeEventListener('keydown', handleItemShortcut)
  }, [
    deleteTargets.length,
    destination.type,
    itemOperationBusy,
    renameTarget,
    selectedIds,
    selectedItemId,
    trashItemIds,
    visibleItems
  ])

  useEffect(() => {
    const clearSelectionOnEscape = (event: KeyboardEvent): void => {
      if (
        event.defaultPrevented ||
        event.key !== 'Escape' ||
        selectedItemId !== null ||
        renameTarget !== null ||
        deleteTargets.length > 0 ||
        selectedIds.size === 0
      ) {
        return
      }
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      event.preventDefault()
      clearSelection()
    }
    window.addEventListener('keydown', clearSelectionOnEscape)
    return () => window.removeEventListener('keydown', clearSelectionOnEscape)
  }, [clearSelection, deleteTargets.length, renameTarget, selectedIds.size, selectedItemId])

  useEffect(() => {
    const selectAllItems = (event: KeyboardEvent): void => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        (!event.ctrlKey && !event.metaKey) ||
        event.key.toLocaleLowerCase() !== 'a' ||
        selectedItemId !== null ||
        renameTarget !== null ||
        deleteTargets.length > 0 ||
        visibleItems.length === 0
      ) {
        return
      }
      const target = event.target
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="menu"], [role="dialog"], [role="listbox"]'
        )
      ) {
        return
      }
      event.preventDefault()
      selectAllVisibleItems()
    }
    window.addEventListener('keydown', selectAllItems)
    return () => window.removeEventListener('keydown', selectAllItems)
  }, [
    deleteTargets.length,
    renameTarget,
    selectAllVisibleItems,
    selectedItemId,
    visibleItems.length
  ])

  const openComposer = useCallback((): void => {
    setComposerOpen(true)
    setComposerFocusRequest((request) => request + 1)
  }, [])

  const prepareGlobalCapture = useCallback((): void => {
    const modalOpen = document.querySelector('[role="dialog"]') !== null
    setDestination({ type: 'inbox' })
    setSearch('')
    setTypeFilters([])
    setSelectedIds(new Set())
    setSelectionAnchorId(null)
    setComposerOpen(true)
    if (!modalOpen) setComposerFocusRequest((request) => request + 1)
    announceStatus('Global capture ready in Inbox.')
    if (modalOpen) notifyGlobalCapturePrepared()
  }, [announceStatus])

  useEffect(() => {
    let active = true
    void window.electron.window.getGlobalCaptureShortcutStatus().then((status) => {
      if (!active) return
      setGlobalCaptureShortcutStatus(status)
      if (!status.registered && !shortcutFailureNotified.current) {
        shortcutFailureNotified.current = true
        notifyGlobalCaptureUnavailable()
      }
    })
    const unsubscribe = window.electron.window.onGlobalCaptureRequested(prepareGlobalCapture)
    return () => {
      active = false
      unsubscribe()
    }
  }, [prepareGlobalCapture])

  const changeComposerOpen = useCallback((open: boolean): void => {
    setComposerOpen(open)
    if (!open) setNewItemFocusRequest((request) => request + 1)
  }, [])

  useEffect(() => {
    const pending = library.items.filter(
      (item) =>
        item.type === 'url' && (item.metadataStatus === 'pending' || item.metadataVersion < 2)
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

  const requestImageImport = useCallback(
    (file: File): void => {
      if (!file.type.startsWith('image/')) {
        setMessage('Only image files can be imported here right now.')
        return
      }
      importRequestId.current += 1
      setImportRequest({ id: importRequestId.current, file })
      openComposer()
    },
    [openComposer]
  )

  const requestUrlCapture = useCallback(
    (url: string): void => {
      importRequestId.current += 1
      setImportRequest({ id: importRequestId.current, url })
      openComposer()
    },
    [openComposer]
  )

  const requestTextCapture = useCallback(
    (value: string): void => {
      importRequestId.current += 1
      setImportRequest({ id: importRequestId.current, text: value })
      openComposer()
    },
    [openComposer]
  )

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
      if (!text) return
      try {
        const url = new URL(text)
        if (['http:', 'https:'].includes(url.protocol) && url.toString() === text) {
          event.preventDefault()
          requestUrlCapture(text)
          return
        }
      } catch {
        /* Preserve ambiguous text as a note below. */
      }
      event.preventDefault()
      requestTextCapture(text)
    }
    window.addEventListener('paste', capturePastedContent)
    return () => window.removeEventListener('paste', capturePastedContent)
  }, [requestImageImport, requestTextCapture, requestUrlCapture])

  const captureDroppedImage = (event: React.DragEvent<HTMLElement>): void => {
    const files = Array.from(event.dataTransfer.files)
    event.preventDefault()
    dragDepth.current = 0
    setIsDragging(false)
    const image = files.find((file) => file.type.startsWith('image/'))
    if (image) requestImageImport(image)
    else if (files.length > 0) setMessage('Only image files can be imported here right now.')
  }

  const submitRename = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!renameTarget || !renameTitle.trim() || itemOperationBusy) return
    setItemOperationBusy(true)
    try {
      const result = await window.kuskus.renameItem({
        itemId: renameTarget.id,
        title: renameTitle
      })
      if (!applyLibraryResult(result)) return
      setRenameTarget(null)
      setRenameTitle('')
      notifyRenamed()
    } finally {
      setItemOperationBusy(false)
    }
  }

  const confirmPermanentDelete = async (): Promise<void> => {
    if (deleteTargets.length === 0 || itemOperationBusy) return
    setItemOperationBusy(true)
    try {
      const result = await window.kuskus.permanentlyDeleteItems({ itemIds: deleteTargets })
      if (!applyLibraryResult(result)) return
      const count = deleteTargets.length
      setDeleteTargets([])
      setSelectedItemId(null)
      notifyPermanentlyDeleted(count)
    } finally {
      setItemOperationBusy(false)
    }
  }

  const selectedItemIds = [...selectedIds]
  const selectedItemLocations = library.items
    .filter((item) => selectedIds.has(item.id))
    .map((item) => item.location)

  const addItemComposer = (
    <AddItemComposer
      key={draftStorageKey}
      open={composerOpen}
      focusRequest={composerFocusRequest}
      discardRequest={composerDiscardRequest}
      draftStorageKey={draftStorageKey}
      importRequest={importRequest}
      view={view}
      onOpenChange={changeComposerOpen}
      onImportRequestHandled={(id) =>
        setImportRequest((current) => (current?.id === id ? null : current))
      }
      onCreated={addCreatedItem}
      onLinkCommitted={commitLinkItem}
      onLinkUpdated={updateItem}
      onLinkReleased={(itemId) => {
        setComposerOwnedItemId((current) => (current === itemId ? null : current))
        const released = library.items.find((entry) => entry.id === itemId)
        if (
          released &&
          itemMatchesDestination(released, destination, collectionSubtreeIds) &&
          itemMatchesRetrieval(released, search.trim().toLocaleLowerCase(), typeFilters)
        ) {
          pendingRevealItemId.current = itemId
        }
      }}
      onStatus={announceStatus}
      onDraftStateChange={setComposerHasDraft}
      onTransientWorkChange={setComposerHasTransientWork}
    />
  )

  const cardLayoutContent = (
    <>
      <div className={cn('min-w-0', !composerOpen && 'hidden')}>{addItemComposer}</div>
      {visibleItems.map((item) => (
        <ItemContextMenu
          item={item}
          collections={library.collections}
          {...itemActions(item)}
          key={item.id}
        >
          <div
            className="min-w-0"
            data-item-id={item.id}
            draggable
            onDragStart={(event) => beginItemDrag(item.id, event)}
          >
            <div className="group/saved-item relative" data-selected={selectedIds.has(item.id)}>
              <SavedItemCard
                item={item}
                view={view === 'visual' ? 'visual' : 'grid'}
                selected={selectedIds.has(item.id)}
                onActivate={(event) => activateItem(item.id, event)}
                onOpen={() => setSelectedItemId(item.id)}
              />
              <div
                className="absolute top-2 right-2 z-30"
                onClick={(event) => event.stopPropagation()}
              >
                <ItemActionMenu
                  item={item}
                  collections={library.collections}
                  showQuickSourceAction
                  {...itemActions(item)}
                />
              </div>
            </div>
          </div>
        </ItemContextMenu>
      ))}
    </>
  )

  return (
    <SidebarProvider
      keyboardShortcutEnabled={selectedItem === null}
      open={!sidebarHidden}
      onOpenChange={(open) => setSidebarHidden(!open)}
      width={sidebarWidth}
      onWidthChange={setSidebarWidth}
      minWidth={MIN_SIDEBAR_WIDTH}
      maxWidth={MAX_SIDEBAR_WIDTH}
      className="h-screen min-h-0 overflow-hidden bg-background text-foreground"
    >
      <LibrarySidebar
        key={library.id}
        library={library}
        theme={theme}
        onThemeChange={setTheme}
        view={view}
        onViewChange={setView}
        showReferencedAttachments={showReferencedAttachments}
        onShowReferencedAttachmentsChange={setShowReferencedAttachments}
        destination={destination}
        onDestinationChange={changeDestination}
        onLibraryChange={setLibrary}
        onError={setMessage}
        onStatus={announceStatus}
        onMoveItems={(itemIds, nextDestination) => void moveItemIds(itemIds, nextDestination)}
        librarySwitchBlocked={importRequest !== null || composerHasTransientWork}
        globalCaptureShortcutStatus={globalCaptureShortcutStatus}
      />
      <SidebarInset>
        <AppToolbar
          keyboardShortcutsEnabled={selectedItem === null}
          newItemOpen={composerOpen}
          hasDraft={composerHasDraft}
          newItemFocusRequest={newItemFocusRequest}
          onNewItem={openComposer}
          onDiscardDraft={() => setComposerDiscardRequest((request) => request + 1)}
          search={search}
          searchScope={destinationLabel(destination, library)}
          onSearchChange={changeSearch}
          searchPending={search !== deferredSearch}
          resultCount={visibleItems.length}
          totalCount={destinationItems.length}
          typeFilters={typeFilters}
          onTypeFilterChange={changeTypeFilter}
          onClearFilters={() => setTypeFilters([])}
          sort={sort}
          onSortChange={setSort}
        />
        <ScrollArea
          className="min-h-0 min-w-0 flex-1"
          viewportClassName="dark:library-scroll-viewport focus-visible:ring-0 focus-visible:outline-none"
        >
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
            <div
              className={cn(
                'min-h-full px-5 pt-3 pb-5 lg:px-7 lg:pt-4 lg:pb-7',
                selectedItemIds.length > 0 && 'pb-24 lg:pb-24'
              )}
            >
              {library.repairConflicts.length > 0 && (
                <Alert className="mb-4">
                  <AlertTitle>Some legacy metadata needs review</AlertTitle>
                  <AlertDescription>
                    {library.repairConflicts.length} Markdown{' '}
                    {library.repairConflicts.length === 1 ? 'file was' : 'files were'} left
                    unchanged because removing the old bookmark metadata could hide user-authored
                    content. The original files remain authoritative.
                  </AlertDescription>
                </Alert>
              )}
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
              <Empty
                aria-hidden={!isDragging}
                data-active={isDragging}
                className="drop-target pointer-events-none absolute inset-4 z-40 min-h-72 scale-[0.98] border border-dashed border-primary bg-background/94 opacity-0 shadow-xl backdrop-blur-md transition-[opacity,scale] [transition-duration:var(--motion-duration-press)] [transition-timing-function:var(--motion-ease-out)] data-[active=true]:scale-100 data-[active=true]:opacity-100 motion-reduce:transition-opacity motion-reduce:data-[active=false]:scale-100 motion-reduce:data-[active=true]:scale-100"
              >
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileImage aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>Drop image to add it to Inbox</EmptyTitle>
                  <EmptyDescription>The original file stays untouched.</EmptyDescription>
                </EmptyHeader>
              </Empty>
              {view === 'table' ? (
                <div className="flex flex-col gap-4">
                  <div className={cn('min-w-0', !composerOpen && 'hidden')}>{addItemComposer}</div>
                  {visibleItems.length > 0 ? (
                    <SavedItemsTable
                      items={visibleItems}
                      selectedIds={selectedIds}
                      onActivate={activateItem}
                      onOpen={(itemId) => setSelectedItemId(itemId)}
                      onDragStart={beginItemDrag}
                      renderActions={(item) => (
                        <ItemActionMenu
                          item={item}
                          collections={library.collections}
                          {...itemActions(item)}
                        />
                      )}
                      wrapRow={(item, row) => (
                        <ItemContextMenu
                          key={item.id}
                          item={item}
                          collections={library.collections}
                          {...itemActions(item)}
                        >
                          {row}
                        </ItemContextMenu>
                      )}
                    />
                  ) : null}
                </div>
              ) : view === 'visual' ? (
                <OrderedMasonry>{cardLayoutContent}</OrderedMasonry>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
                  {cardLayoutContent}
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
                        changeSearch('')
                        setTypeFilters([])
                        setSelectedIds(new Set())
                        setSelectionAnchorId(null)
                      }}
                    >
                      Clear search and filters
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
              {!isDragging && destinationItems.length === 0 && !hasActiveRetrieval && (
                <Empty className="mt-6">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Inbox aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>
                      {destination.type === 'archive'
                        ? 'Archive is empty'
                        : destination.type === 'trash'
                          ? 'Trash is empty'
                          : destination.type === 'all'
                            ? 'Your library is ready'
                            : destination.type === 'collection'
                              ? 'This folder is empty'
                              : 'Your Inbox is ready'}
                    </EmptyTitle>
                    <EmptyDescription>
                      {destination.type === 'archive'
                        ? 'Archived items stay here until you unarchive or trash them.'
                        : destination.type === 'trash'
                          ? 'Items moved to Trash remain recoverable until permanently deleted.'
                          : 'Add a note, paste an image, or drop one anywhere in this window.'}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </main>
        </ScrollArea>
        <BulkActionToolbar
          selectedItemIds={selectedItemIds}
          selectedItemLocations={selectedItemLocations}
          destination={destination}
          collections={library.collections}
          onMove={(itemIds, nextDestination) => void moveItemIds(itemIds, nextDestination)}
          onArchive={(itemIds) => void archiveItemIds(itemIds)}
          onUnarchive={(itemIds) => void unarchiveItemIds(itemIds)}
          onTrash={(itemIds) => void trashItemIds(itemIds)}
          onRestore={(itemIds) => void restoreItemIds(itemIds)}
          onDeletePermanently={setDeleteTargets}
          onClearSelection={clearSelection}
        />
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {statusMessage}
        </p>
        <ItemDetailDialog
          key={selectedItem?.id ?? 'closed-item-detail'}
          item={selectedItem}
          hasPrevious={hasPreviousItem}
          hasNext={hasNextItem}
          onPrevious={selectPreviousItem}
          onNext={selectNextItem}
          onOpenChange={(open) => {
            if (!open) setSelectedItemId(null)
          }}
          onItemUpdated={updateItem}
          onOpenVaultLink={openVaultLink}
          renderActions={(guard) => {
            if (!selectedItem) return null
            const actions = itemActions(selectedItem)
            return (
              <ItemActionMenu
                item={selectedItem}
                collections={library.collections}
                alwaysVisible
                {...actions}
                onRename={() => guard(actions.onRename)}
                onMove={(nextDestination) => guard(() => actions.onMove(nextDestination))}
                onArchive={() => guard(actions.onArchive)}
                onUnarchive={() => guard(actions.onUnarchive)}
                onTrash={() => guard(actions.onTrash)}
                onRestore={() => guard(actions.onRestore)}
                onDeletePermanently={() => guard(actions.onDeletePermanently)}
              />
            )
          }}
          onError={setMessage}
        />
        <Dialog
          open={renameTarget !== null}
          onOpenChange={(open) => {
            if (!open && !itemOperationBusy) {
              setRenameTarget(null)
              setRenameTitle('')
            }
          }}
        >
          <DialogContent>
            <form onSubmit={(event) => void submitRename(event)}>
              <DialogHeader>
                <DialogTitle>Rename item</DialogTitle>
                <DialogDescription>
                  This renames the visible vault file. Kuskus keeps its stable identity and updates
                  a companion assets folder when present.
                </DialogDescription>
              </DialogHeader>
              <FieldGroup className="py-4">
                <Field>
                  <FieldLabel htmlFor="item-title">Title</FieldLabel>
                  <Input
                    id="item-title"
                    autoFocus
                    maxLength={200}
                    value={renameTitle}
                    disabled={itemOperationBusy}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => setRenameTitle(event.target.value)}
                  />
                </Field>
              </FieldGroup>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={itemOperationBusy}
                  onClick={() => setRenameTarget(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!renameTitle.trim() || itemOperationBusy}>
                  Rename
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <AlertDialog
          open={deleteTargets.length > 0}
          onOpenChange={(open) => {
            if (!open && !itemOperationBusy) setDeleteTargets([])
          }}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Permanently delete {deleteTargets.length === 1 ? 'this item' : 'these items'}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTargets.length === 1
                  ? 'The library copy will be removed and cannot be restored. The original external source is never deleted.'
                  : `${deleteTargets.length} library items will be removed and cannot be restored. Original external sources are never deleted.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={itemOperationBusy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={itemOperationBusy}
                onClick={() => void confirmPermanentDelete()}
              >
                Delete permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
