import {
  Activity,
  startTransition,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  IconAlertTriangle,
  IconInbox as Inbox,
  IconLayoutDashboard,
  IconLibrary,
  IconSearch as Search
} from '@tabler/icons-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Kbd } from '@/components/ui/kbd'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { SidebarInset, SidebarProvider } from '@/features/shell/app-sidebar'
import type { ImportRequest } from '@/features/capture/add-item-composer'
import { shouldYieldMainComposer } from '@/features/capture/capture-draft-tracker'
import { ExternalDropShadow } from '@/features/capture/external-drop-shadow'
import { CaptureRecoveryDialog } from '@/features/capture/capture-recovery-dialog'
import { SavedItemCard } from '@/features/items/saved-item-card'
import { FocusItemList } from '@/features/items/focus-item-list'
import { FocusListHeader } from '@/features/items/focus-list-header'
import {
  FOCUS_RAIL_DENSITY_STORAGE_KEY,
  parseFocusRailDensity,
  parseFocusListWidth,
  resolveFocusAfterRemoval,
  resolveInitialFocusItemId,
  type FocusRailDensity
} from '@/features/items/focus-view-state'
import { KUSKUS_ITEM_DRAG_TYPE, setKuskusItemDragPreview } from '@/features/items/item-drag'
import type { DetailTitleRenameResult, ItemDetailHandle } from '@/features/items/item-detail-dialog'
import { openExternalUrlWithFeedback } from '@/features/items/open-external-url'
import {
  hasBulkItemSelection,
  resolveItemMenuTargets,
  resolveItemShortcutTargets,
  resolveRenameShortcutTarget
} from '@/features/items/item-shortcuts'
import { BulkActionToolbar } from '@/features/library/bulk-action-toolbar'
import { FocusWorkspace } from '@/features/library/focus-workspace'
import { OrderedMasonry } from '@/features/library/ordered-masonry'
import { readAppSession, writeAppSession } from '@/features/library/session-restore'
import { expandLibraryOverview } from '@/features/library/library-overview'
import { useLibraryRetrieval } from '@/features/library/use-library-retrieval'
import { useLibrarySelection } from '@/features/library/use-library-selection'
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
import { parseLibraryView, type ItemTypeFilter, type LibraryView } from '@/features/items/item-view'
import type { NoteMode } from '@/features/items/note-view-mode'
import { AppToolbar } from '@/features/shell/app-toolbar'
import { LibrarySidebar, type LibraryDestination } from '@/features/shell/library-sidebar'
import { useTheme } from '@/hooks/use-theme'
import type { TranslucentBackgroundPreference } from '@/hooks/use-translucent-background'
import { cn } from '@/lib/utils'
import type {
  ActiveItemLocation,
  ApiResult,
  ItemDeletionInspectionDto,
  LibraryDto,
  LibraryItemDto,
  UrlItemDto
} from '../../../../shared/library-contract'
import type { GlobalCaptureShortcutStatus } from '../../../../shared/window-contract'
import type { CaptureSurface } from '../../../../shared/capture-contract'
import {
  notifyActionError,
  notifyArchived,
  notifyEmptyNoteTrashed,
  notifyGlobalCapturePrepared,
  notifyGlobalCaptureUnavailable,
  notifyPermanentlyDeleted,
  notifyReferenceAwareMove,
  notifyRenamed,
  notifyRestored,
  notifyTrashed,
  notifyUnarchived
} from '@/lib/notify'

const ItemDetailDialog = lazy(() =>
  import('@/features/items/item-detail-dialog').then((module) => ({
    default: module.ItemDetailDialog
  }))
)

const AddItemComposer = lazy(() =>
  import('@/features/capture/add-item-composer').then((module) => ({
    default: module.AddItemComposer
  }))
)

const DEFAULT_SIDEBAR_WIDTH = 256
const MIN_SIDEBAR_WIDTH = 208
const MAX_SIDEBAR_WIDTH = 384
const ITEM_PAGE_SIZE = 50

function destinationLabel(destination: LibraryDestination, library: LibraryDto): string {
  if (destination.type === 'inbox') return 'Inbox'
  if (destination.type === 'all') return 'All Items'
  if (destination.type === 'pinned') return 'Pinned'
  if (destination.type === 'archive') return 'Archive'
  if (destination.type === 'trash') return 'Trash'
  return (
    library.collections.find((collection) => collection.id === destination.collectionId)?.name ??
    'Folder'
  )
}

function hasFileDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes('Files')
}

function hasSupportedImageDrag(dataTransfer: DataTransfer): boolean {
  return (
    Array.from(dataTransfer.items).some(
      (item) => item.kind === 'file' && item.type.startsWith('image/')
    ) || Array.from(dataTransfer.files).some((file) => file.type.startsWith('image/'))
  )
}

export function Workspace({
  initialLibrary,
  translucentBackground
}: {
  initialLibrary: LibraryDto
  translucentBackground: TranslucentBackgroundPreference
}): React.JSX.Element {
  const [library, setLibrary] = useState(initialLibrary)
  const [initialSession] = useState(() => readAppSession(initialLibrary))
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
  const [captureRecoveryOpen, setCaptureRecoveryOpen] = useState(false)
  const [newItemFocusRequest, setNewItemFocusRequest] = useState(0)
  const [importRequest, setImportRequest] = useState<ImportRequest | null>(null)
  const [composerHasTransientWork, setComposerHasTransientWork] = useState(false)
  const [composerOwnedItemId, setComposerOwnedItemId] = useState<string | null>(null)
  const [globalCaptureShortcutStatus, setGlobalCaptureShortcutStatus] =
    useState<GlobalCaptureShortcutStatus | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggedItemIds, setDraggedItemIds] = useState<ReadonlySet<string>>(() => new Set())
  const [search, setSearch] = useState(() => initialSession?.search ?? '')
  const [typeFilters, setTypeFilters] = useState<ItemTypeFilter[]>(
    () => initialSession?.typeFilters ?? []
  )
  const [sort, setSort] = useState<ItemSort>(() =>
    parseItemSort(localStorage.getItem(ITEM_SORT_STORAGE_KEY))
  )
  const [view, setView] = useState<LibraryView>(() => {
    return parseLibraryView(localStorage.getItem('kuskus-library-view'))
  })
  const [focusListWidth, setFocusListWidth] = useState(() =>
    parseFocusListWidth(localStorage.getItem('kuskus-focus-list-width'))
  )
  const [focusRailDensity, setFocusRailDensity] = useState<FocusRailDensity>(() =>
    parseFocusRailDensity(localStorage.getItem(FOCUS_RAIL_DENSITY_STORAGE_KEY))
  )
  const [focusWorkspaceOpen, setFocusWorkspaceOpen] = useState(
    () => initialSession !== null && initialSession.focusItemId !== null
  )
  const [focusItemId, setFocusItemId] = useState<string | null>(
    () => initialSession?.focusItemId ?? null
  )
  const [focusItemEditOnOpenId, setFocusItemEditOnOpenId] = useState<string | null>(null)
  const [focusDetailOpen, setFocusDetailOpen] = useState(
    () => initialSession?.focusDetailOpen ?? false
  )
  const [focusNoteExpanded, setFocusNoteExpanded] = useState(
    () => initialSession?.focusNoteExpanded ?? false
  )
  const [focusNoteMode, setFocusNoteMode] = useState<NoteMode | null>(
    () => initialSession?.focusNoteMode ?? null
  )
  const [showReferencedAttachments, setShowReferencedAttachments] = useState(
    () => localStorage.getItem('kuskus-show-referenced-attachments') === 'true'
  )
  const [statusMessage, setStatusMessage] = useState('')
  const [itemDetails, setItemDetails] = useState<Map<string, LibraryItemDto>>(() => new Map())
  const [destination, setDestination] = useState<LibraryDestination>(
    () => initialSession?.destination ?? { type: 'inbox' }
  )
  const [renameTarget, setRenameTarget] = useState<LibraryItemDto | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [deleteTargets, setDeleteTargets] = useState<string[]>([])
  const [deleteInspection, setDeleteInspection] = useState<ItemDeletionInspectionDto | null>(null)
  const [cleanupUnusedImages, setCleanupUnusedImages] = useState(false)
  const [trashReview, setTrashReview] = useState<{
    itemIds: string[]
    inspection: ItemDeletionInspectionDto
  } | null>(null)

  const requestPermanentDelete = useCallback((itemIds: string[]): void => {
    setDeleteInspection(null)
    setCleanupUnusedImages(false)
    setDeleteTargets(itemIds)
  }, [])

  const closePermanentDelete = useCallback((): void => {
    setDeleteTargets([])
    setDeleteInspection(null)
    setCleanupUnusedImages(false)
  }, [])
  const [itemOperationBusy, setItemOperationBusy] = useState(false)
  const [theme, setTheme] = useTheme()
  const importRequestId = useRef(0)
  const dragDepth = useRef(0)
  const enrichingUrlIds = useRef(new Set<string>())
  const pendingRevealItemId = useRef<string | null>(null)
  const loadMoreItemsRef = useRef<HTMLDivElement>(null)
  const firstCardPaintMeasured = useRef(false)
  const shortcutFailureNotified = useRef(false)
  const captureOwner = useRef<CaptureSurface | null>(null)
  const mainComposerOwnershipRequested = useRef(false)
  const focusDetailRef = useRef<ItemDetailHandle>(null)
  const previousVisibleItemIdsRef = useRef<string[]>([])
  const draftStorageKey = `kuskus-note-draft:${library.path}`

  const announceStatus = useCallback((message: string): void => {
    setStatusMessage('')
    window.requestAnimationFrame(() => setStatusMessage(message))
  }, [])

  const {
    selectedIds,
    anchorId,
    clearSelection,
    clearSelectionSilently,
    prepareItem: prepareItemMenu,
    pruneSelection: pruneSelectionToItemIds,
    selectAll: selectAllVisibleItems,
    selectItem
  } = useLibrarySelection(announceStatus)

  const requestFocusTransition = useCallback((action: () => void): void => {
    const detail = focusDetailRef.current
    if (detail) detail.requestTransition(action)
    else action()
  }, [])

  const changeFocusItemId = useCallback(
    (itemId: string | null): void => {
      const item = library.items.find((candidate) => candidate.id === itemId)
      setFocusNoteExpanded((current) => (item?.type === 'note' ? current : false))
      setFocusItemEditOnOpenId(null)
      setFocusNoteMode(null)
      setFocusItemId(itemId)
    },
    [library.items]
  )

  const openDetail = useCallback(
    (itemId: string, edit = false): void => {
      const apply = (): void => {
        setComposerOpen(false)
        setFocusNoteExpanded(false)
        setFocusNoteMode(null)
        setFocusWorkspaceOpen(true)
        setFocusItemId(itemId)
        setFocusItemEditOnOpenId(edit ? itemId : null)
        setFocusDetailOpen(true)
      }
      if (focusItemId) requestFocusTransition(apply)
      else apply()
    },
    [focusItemId, requestFocusTransition]
  )

  const guardFocusTargets = useCallback(
    (itemIds: readonly string[], action: () => void): void => {
      if (focusItemId && itemIds.includes(focusItemId)) {
        requestFocusTransition(action)
      } else action()
    },
    [focusItemId, requestFocusTransition]
  )

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
    localStorage.setItem('kuskus-focus-list-width', String(Math.round(focusListWidth)))
  }, [focusListWidth])

  useEffect(() => {
    localStorage.setItem(FOCUS_RAIL_DENSITY_STORAGE_KEY, focusRailDensity)
  }, [focusRailDensity])

  useEffect(() => {
    localStorage.setItem(ITEM_SORT_STORAGE_KEY, sort)
  }, [sort])

  useEffect(() => {
    localStorage.setItem('kuskus-show-referenced-attachments', String(showReferencedAttachments))
  }, [showReferencedAttachments])

  useEffect(() => {
    writeAppSession(library.path, {
      destination,
      search,
      typeFilters,
      focusItemId,
      focusDetailOpen: focusDetailOpen && focusItemId !== null,
      focusNoteExpanded: focusNoteExpanded && focusItemId !== null,
      focusNoteMode: focusItemId !== null ? focusNoteMode : null
    })
  }, [
    destination,
    search,
    typeFilters,
    focusItemId,
    focusDetailOpen,
    focusNoteExpanded,
    focusNoteMode,
    library.path
  ])

  const refreshVault = useCallback(async (reconcile = false): Promise<void> => {
    const result = reconcile
      ? await window.kuskus.reconcileOverview()
      : await window.kuskus.getOverview()
    if (!result.ok) return
    const state = expandLibraryOverview(result.data)
    if (state.status !== 'ready') return
    const refreshedLibrary = state.library
    startTransition(() => setLibrary(refreshedLibrary))
  }, [])

  useEffect(() => {
    const unsubscribe = window.kuskus.onVaultChanged(() => void refreshVault())
    const onFocus = (): void => void refreshVault(true)
    window.addEventListener('focus', onFocus)
    return () => {
      unsubscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshVault])

  const { deferredSearch, destinationItems, matchesCurrentRetrieval, searchPending, visibleItems } =
    useLibraryRetrieval({
      library,
      destination,
      search,
      typeFilters,
      sort,
      showReferencedAttachments,
      excludedItemId: composerOwnedItemId,
      onSearchResolved: pruneSelectionToItemIds
    })
  const visibleItemIds = useMemo(() => new Set(visibleItems.map((item) => item.id)), [visibleItems])
  const visibleItemIdList = useMemo(() => visibleItems.map((item) => item.id), [visibleItems])
  const retrievalPageKey = `${destination.type}:${destination.type === 'collection' ? destination.collectionId : ''}:${deferredSearch}:${typeFilters.join(',')}:${sort}:${showReferencedAttachments}`
  const [renderPage, setRenderPage] = useState({ key: retrievalPageKey, limit: ITEM_PAGE_SIZE })
  const renderLimit = renderPage.key === retrievalPageKey ? renderPage.limit : ITEM_PAGE_SIZE
  const renderedItems = useMemo(
    () => visibleItems.slice(0, renderLimit),
    [renderLimit, visibleItems]
  )
  useEffect(() => {
    if (firstCardPaintMeasured.current || renderedItems.length === 0) return
    const frame = window.requestAnimationFrame(() => {
      firstCardPaintMeasured.current = true
      performance.mark('kuskus:first-card-paint')
      performance.measure(
        'kuskus:renderer-entry-to-first-card',
        'kuskus:renderer-entry',
        'kuskus:first-card-paint'
      )
    })
    return () => window.cancelAnimationFrame(frame)
  }, [renderedItems.length])
  useEffect(() => {
    if (focusItemId || renderedItems.length >= visibleItems.length) return
    const target = loadMoreItemsRef.current
    if (!target) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        startTransition(() =>
          setRenderPage((current) => ({
            key: retrievalPageKey,
            limit:
              (current.key === retrievalPageKey ? current.limit : ITEM_PAGE_SIZE) + ITEM_PAGE_SIZE
          }))
        )
      },
      { rootMargin: '600px 0px' }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [focusItemId, renderedItems.length, retrievalPageKey, visibleItems.length])
  const openVaultLink = useCallback(
    (target: string): void => {
      const normalized = target.replace(/\\/g, '/').replace(/\.md$/i, '').toLocaleLowerCase()
      const matches = library.items.filter((item) => {
        if (item.type === 'image') return false
        const path = item.relativePath.replace(/\.md$/i, '').toLocaleLowerCase()
        return path === normalized || item.title.toLocaleLowerCase() === normalized
      })
      if (matches.length !== 1) {
        notifyActionError(
          matches.length === 0
            ? `The linked note “${target}” could not be found.`
            : `The linked note “${target}” is ambiguous.`
        )
        return
      }
      openDetail(matches[0].id)
    },
    [library.items, openDetail]
  )
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

  useEffect(() => {
    const summaries = [focusItemId]
      .map((id) => library.items.find((item) => item.id === id))
      .filter(
        (item): item is Extract<LibraryItemDto, { type: 'note' }> =>
          item?.type === 'note' && item.bodyTruncated === true
      )
      .filter((item) => itemDetails.get(item.id)?.updatedAt !== item.updatedAt)
    if (summaries.length === 0) return
    let active = true
    void Promise.all(
      summaries.map(async (summary) => {
        const result = await window.kuskus.getItemDetail(summary.id)
        return result.ok ? result.data : null
      })
    ).then((details) => {
      if (!active) return
      setItemDetails((current) => {
        const next = new Map(current)
        for (const detail of details) {
          if (!detail) continue
          next.delete(detail.id)
          next.set(detail.id, detail)
        }
        while (next.size > 20) next.delete(next.keys().next().value!)
        return next
      })
    })
    return () => {
      active = false
    }
  }, [focusItemId, itemDetails, library.items])

  const focusItemSummary = useMemo(
    () => library.items.find((item) => item.id === focusItemId) ?? null,
    [focusItemId, library.items]
  )
  const focusNoteExpansionActive =
    focusNoteExpanded && !composerOpen && focusItemSummary?.type === 'note'

  const focusItemDetail =
    focusItemSummary?.type === 'note' ? itemDetails.get(focusItemSummary.id) : undefined
  const focusItem =
    focusItemSummary?.type === 'note' &&
    focusItemSummary.bodyTruncated &&
    focusItemDetail?.type === 'note'
      ? {
          ...focusItemDetail,
          ...focusItemSummary,
          body: focusItemDetail.body,
          bodyTruncated: false as const
        }
      : focusItemSummary?.type === 'note' && focusItemSummary.bodyTruncated
        ? null
        : focusItemSummary
  const focusVisibleIndex = useMemo(
    () => visibleItems.findIndex((item) => item.id === focusItemId),
    [focusItemId, visibleItems]
  )

  useEffect(() => {
    if (!focusItemId) return
    setFocusItemId((current) => {
      if (current && library.items.some((item) => item.id === current)) return current
      return resolveFocusAfterRemoval(
        previousVisibleItemIdsRef.current,
        visibleItemIdList,
        resolveInitialFocusItemId(visibleItemIdList, current)
      )
    })
    if (!library.items.some((item) => item.id === focusItemId)) setFocusNoteMode(null)
    previousVisibleItemIdsRef.current = [...visibleItemIdList]
  }, [focusItemId, library.items, visibleItemIdList])
  const selectPreviousFocusItem = useCallback((): void => {
    if (focusVisibleIndex <= 0) return
    requestFocusTransition(() => changeFocusItemId(visibleItems[focusVisibleIndex - 1].id))
  }, [changeFocusItemId, focusVisibleIndex, requestFocusTransition, visibleItems])

  const selectNextFocusItem = useCallback((): void => {
    if (focusVisibleIndex < 0 || focusVisibleIndex >= visibleItems.length - 1) return
    requestFocusTransition(() => changeFocusItemId(visibleItems[focusVisibleIndex + 1].id))
  }, [changeFocusItemId, focusVisibleIndex, requestFocusTransition, visibleItems])

  const hasActiveRetrieval = search.trim().length > 0 || typeFilters.length > 0

  const changeDestination = useCallback(
    (next: LibraryDestination): void => {
      const apply = (): void => {
        setDestination(next)
        clearSelectionSilently()
        setFocusWorkspaceOpen(false)
        setFocusNoteExpanded(false)
        setFocusItemId(null)
        setFocusDetailOpen(false)
        setComposerOpen(false)
      }
      if (focusItemId) requestFocusTransition(apply)
      else apply()
    },
    [clearSelectionSilently, focusItemId, requestFocusTransition]
  )

  const changeView = useCallback((next: LibraryView): void => setView(next), [])

  const returnToMasonry = useCallback((): void => {
    setView('visual')
    setFocusWorkspaceOpen(false)
    setFocusItemId(null)
    setFocusDetailOpen(false)
    setFocusNoteExpanded(false)
  }, [])

  const handleFocusSplitChange = useCallback((split: boolean): void => {
    if (split) setFocusDetailOpen(true)
  }, [])

  const changeFocusNoteExpanded = useCallback(
    (expanded: boolean): void => {
      setFocusNoteExpanded(expanded)
      announceStatus(expanded ? 'Zen mode on' : 'Zen mode off')
    },
    [announceStatus]
  )

  const changeSearch = useCallback((next: string): void => setSearch(next), [])

  const changeTypeFilter = useCallback(
    (type: ItemTypeFilter, selected: boolean): void => {
      const next = selected
        ? typeFilters.includes(type)
          ? typeFilters
          : [...typeFilters, type]
        : typeFilters.filter((entry) => entry !== type)
      setTypeFilters(next)
      pruneSelectionToItemIds(
        new Set(
          library.items
            .filter((item) => next.length === 0 || next.includes(item.type))
            .map((item) => item.id)
        )
      )
    },
    [library.items, pruneSelectionToItemIds, typeFilters]
  )

  const addCreatedItem = useCallback(
    async (item: LibraryItemDto, openInEditor = false): Promise<boolean> => {
      const refreshed = await window.kuskus.getState()
      const nextLibrary =
        refreshed.ok && refreshed.data.status === 'ready' ? refreshed.data.library : null
      const nextItem = nextLibrary?.items.find((entry) => entry.id === item.id) ?? item
      if (nextLibrary) setLibrary(nextLibrary)
      else setLibrary((current) => ({ ...current, items: [item, ...current.items] }))
      const remainsVisible = matchesCurrentRetrieval(nextItem)
      if (remainsVisible) pendingRevealItemId.current = nextItem.id
      if (openInEditor && nextItem.type === 'note') openDetail(nextItem.id, true)
      return remainsVisible
    },
    [matchesCurrentRetrieval, openDetail]
  )

  const commitLinkItem = useCallback(
    async (item: UrlItemDto): Promise<{ item: UrlItemDto; remainsVisible: boolean }> => {
      setComposerOwnedItemId(item.id)
      const refreshed = await window.kuskus.getState()
      const nextLibrary =
        refreshed.ok && refreshed.data.status === 'ready' ? refreshed.data.library : null
      const candidate = nextLibrary?.items.find((entry) => entry.id === item.id)
      const nextItem = candidate?.type === 'url' ? candidate : item
      if (nextLibrary) setLibrary(nextLibrary)
      else setLibrary((current) => ({ ...current, items: [item, ...current.items] }))
      return {
        item: nextItem,
        remainsVisible: matchesCurrentRetrieval(nextItem)
      }
    },
    [matchesCurrentRetrieval]
  )

  const updateItem = useCallback((item: LibraryItemDto): void => {
    setLibrary((current) => ({
      ...current,
      items: current.items.map((entry) => (entry.id === item.id ? item : entry))
    }))
    if (item.type === 'note' && item.bodyTruncated !== true) {
      setItemDetails((current) => {
        if (!current.has(item.id)) return current
        const next = new Map(current)
        next.delete(item.id)
        next.set(item.id, item)
        return next
      })
    }
  }, [])

  const applyLibraryResult = useCallback(
    (result: ApiResult<LibraryDto>): LibraryDto | null => {
      if (!result.ok) {
        notifyActionError(result.error)
        return null
      }
      setLibrary(result.data)
      setFocusNoteExpanded(false)
      setFocusItemId((current) => {
        if (!current) return current
        const nextVisibleIds = sortItems(
          result.data.items.filter(matchesCurrentRetrieval),
          sort
        ).map((item) => item.id)
        return resolveFocusAfterRemoval(visibleItemIdList, nextVisibleIds, current)
      })
      clearSelectionSilently()
      return result.data
    },
    [clearSelectionSilently, matchesCurrentRetrieval, sort, visibleItemIdList]
  )

  const moveItemIds = useCallback(
    async (itemIds: string[], nextDestination: ActiveItemLocation): Promise<void> => {
      const requested = new Set(itemIds)
      const selectedNotes = library.items.filter(
        (item): item is Extract<LibraryItemDto, { type: 'note' }> =>
          requested.has(item.id) && item.type === 'note'
      )
      const referencedImageIds = new Set(
        selectedNotes.flatMap((note) => note.attachments.map((attachment) => attachment.id))
      )
      const explicitlyMovedReferencedImages = library.items.filter(
        (item) =>
          requested.has(item.id) &&
          item.type === 'image' &&
          library.items.some(
            (candidate) =>
              candidate.type === 'note' &&
              candidate.attachments.some((attachment) => attachment.id === item.id)
          )
      )
      setItemOperationBusy(true)
      try {
        const result = await window.kuskus.moveItems({ itemIds, destination: nextDestination })
        const nextLibrary = applyLibraryResult(result)
        if (!nextLibrary) return
        const movedImages = [...referencedImageIds].filter((imageId) => {
          if (requested.has(imageId)) return false
          const before = library.items.find((item) => item.id === imageId)
          const after = nextLibrary.items.find((item) => item.id === imageId)
          return before?.relativePath !== after?.relativePath
        }).length
        const retainedImages = [...referencedImageIds].filter((imageId) => {
          if (requested.has(imageId)) return false
          const before = library.items.find((item) => item.id === imageId)
          const after = nextLibrary.items.find((item) => item.id === imageId)
          return before && after && before.relativePath === after.relativePath
        }).length
        const updatedNotes = new Set(
          explicitlyMovedReferencedImages.flatMap((image) =>
            library.items.flatMap((candidate) =>
              candidate.type === 'note' &&
              candidate.attachments.some((attachment) => attachment.id === image.id)
                ? [candidate.id]
                : []
            )
          )
        ).size
        if (movedImages + retainedImages + updatedNotes > 0) {
          notifyReferenceAwareMove({ movedImages, retainedImages, updatedNotes })
        }
      } finally {
        setItemOperationBusy(false)
      }
    },
    [applyLibraryResult, library.items]
  )

  const beginItemDrag = useCallback(
    (itemId: string, event: React.DragEvent<HTMLElement>): void => {
      const itemIds = selectedIds.has(itemId) ? [...selectedIds] : [itemId]
      if (!selectedIds.has(itemId)) prepareItemMenu(itemId)
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData(KUSKUS_ITEM_DRAG_TYPE, JSON.stringify(itemIds))
      event.dataTransfer.setData(
        'text/plain',
        `${itemIds.length} Kuskus ${itemIds.length === 1 ? 'item' : 'items'}`
      )
      setKuskusItemDragPreview({
        dataTransfer: event.dataTransfer,
        source: event.currentTarget,
        clientX: event.clientX,
        clientY: event.clientY,
        itemCount: itemIds.length
      })
      setDraggedItemIds(new Set(itemIds))
    },
    [prepareItemMenu, selectedIds]
  )

  const endItemDrag = useCallback((): void => {
    setDraggedItemIds(new Set())
  }, [])

  useEffect(() => {
    window.addEventListener('dragend', endItemDrag)
    window.addEventListener('drop', endItemDrag)
    return () => {
      window.removeEventListener('dragend', endItemDrag)
      window.removeEventListener('drop', endItemDrag)
    }
  }, [endItemDrag])

  const archiveItemIds = useCallback(
    async (itemIds: string[], showUndo = true): Promise<void> => {
      const requested = new Set(itemIds)
      const referencedImageIds = new Set(
        library.items.flatMap((item) =>
          requested.has(item.id) && item.type === 'note'
            ? item.attachments.map((attachment) => attachment.id)
            : []
        )
      )
      const explicitlyMovedImageIds = new Set(
        library.items.flatMap((item) =>
          requested.has(item.id) && item.type === 'image' ? [item.id] : []
        )
      )
      setItemOperationBusy(true)
      try {
        const result = await window.kuskus.archiveItems({ itemIds })
        const nextLibrary = applyLibraryResult(result)
        if (!nextLibrary) return
        const movedImages = [...referencedImageIds].filter((imageId) => {
          if (requested.has(imageId)) return false
          const before = library.items.find((item) => item.id === imageId)
          const after = nextLibrary.items.find((item) => item.id === imageId)
          return before?.relativePath !== after?.relativePath
        }).length
        const updatedNotes = library.items.filter(
          (item) =>
            item.type === 'note' &&
            item.attachments.some((attachment) => explicitlyMovedImageIds.has(attachment.id))
        ).length
        if (showUndo) {
          notifyArchived(
            itemIds.length,
            () => {
              void window.kuskus
                .unarchiveItems({ itemIds })
                .then((undoResult) => applyLibraryResult(undoResult))
            },
            [
              movedImages > 0
                ? `${movedImages} ${movedImages === 1 ? 'image was' : 'images were'} archived with the note.`
                : '',
              updatedNotes > 0
                ? `${updatedNotes} ${updatedNotes === 1 ? 'note reference was' : 'note references were'} updated.`
                : ''
            ]
              .filter(Boolean)
              .join(' ') || undefined
          )
        }
      } finally {
        setItemOperationBusy(false)
      }
    },
    [applyLibraryResult, library.items]
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
        const nextLibrary = applyLibraryResult(result)
        if (!nextLibrary) return
        const requested = new Set(itemIds)
        const referencedImageIds = new Set(
          library.items.flatMap((item) =>
            requested.has(item.id) && item.type === 'note'
              ? item.attachments.map((attachment) => attachment.id)
              : []
          )
        )
        const movedImages = [...referencedImageIds].filter((imageId) => {
          if (requested.has(imageId)) return false
          const before = library.items.find((item) => item.id === imageId)
          const after = nextLibrary.items.find((item) => item.id === imageId)
          return before?.relativePath !== after?.relativePath
        }).length
        if (notify) {
          notifyUnarchived(
            itemIds.length,
            [
              missingPreviousFolder
                ? 'A previous folder was unavailable, so the item was returned to Inbox.'
                : '',
              movedImages > 0
                ? `${movedImages} ${movedImages === 1 ? 'image was' : 'images were'} restored with the note.`
                : ''
            ]
              .filter(Boolean)
              .join(' ') || undefined
          )
        }
      } finally {
        setItemOperationBusy(false)
      }
    },
    [applyLibraryResult, library.collections, library.items]
  )

  const setItemsPinned = useCallback(
    async (itemIds: string[], pinned: boolean): Promise<void> => {
      setItemOperationBusy(true)
      try {
        const result = await window.kuskus.setItemsPinned({ itemIds, pinned })
        if (!result.ok) {
          notifyActionError(result.error)
          return
        }
        setLibrary(result.data)
        announceStatus(
          `${itemIds.length} ${itemIds.length === 1 ? 'item' : 'items'} ${
            pinned ? 'pinned' : 'unpinned'
          }`
        )
      } finally {
        setItemOperationBusy(false)
      }
    },
    [announceStatus]
  )

  const trashItemIds = useCallback(
    async (itemIds: string[], showUndo = true): Promise<boolean> => {
      setItemOperationBusy(true)
      try {
        const inspected = await window.kuskus.inspectItemDeletion({ itemIds, mode: 'trash' })
        if (!inspected.ok) {
          notifyActionError(inspected.error)
          return false
        }
        if (inspected.data.referencedItems.length > 0) {
          setTrashReview({ itemIds, inspection: inspected.data })
          return false
        }
        const result = await window.kuskus.trashItems({
          itemIds,
          referenceRevision: inspected.data.revision
        })
        if (!applyLibraryResult(result)) return false
        if (showUndo) {
          notifyTrashed(itemIds.length, () => {
            void window.kuskus
              .restoreItems({ itemIds })
              .then((undoResult) => applyLibraryResult(undoResult))
          })
        }
        return true
      } finally {
        setItemOperationBusy(false)
      }
    },
    [applyLibraryResult]
  )

  const trashEmptyNote = useCallback(
    async (itemId: string): Promise<boolean> => {
      const trashed = await trashItemIds([itemId], false)
      if (!trashed) return false
      notifyEmptyNoteTrashed(() => {
        void window.kuskus
          .restoreItems({ itemIds: [itemId] })
          .then((result) => applyLibraryResult(result))
      })
      return true
    },
    [applyLibraryResult, trashItemIds]
  )

  const confirmReferencedTrash = async (): Promise<void> => {
    if (!trashReview || itemOperationBusy) return
    setItemOperationBusy(true)
    try {
      const result = await window.kuskus.trashItems({
        itemIds: trashReview.itemIds,
        referenceRevision: trashReview.inspection.revision,
        confirmedReferencedItemIds: trashReview.inspection.referencedItems.map(
          (item) => item.itemId
        )
      })
      if (!applyLibraryResult(result)) return
      const count = trashReview.itemIds.length
      setTrashReview(null)
      notifyTrashed(count, () => {
        void window.kuskus
          .restoreItems({ itemIds: trashReview.itemIds })
          .then((undoResult) => applyLibraryResult(undoResult))
      })
    } finally {
      setItemOperationBusy(false)
    }
  }

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
    if (!result.ok) notifyActionError(result.error)
  }, [])

  const openSource = useCallback(async (item: LibraryItemDto): Promise<void> => {
    if (item.type !== 'url') return
    await openExternalUrlWithFeedback(item.sourceUrl)
  }, [])

  const activateItem = useCallback(
    (itemId: string, event: Pick<React.MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>): void => {
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        if (event.shiftKey && !anchorId && focusItemId && focusItemId !== itemId) {
          prepareItemMenu(focusItemId)
        }
        selectItem(itemId, visibleItemIdList, event)
        return
      }

      clearSelectionSilently()
      if (composerHasTransientWork) {
        announceStatus('Finish the current capture before opening another item.')
        return
      }
      openDetail(itemId)
    },
    [
      anchorId,
      announceStatus,
      clearSelectionSilently,
      composerHasTransientWork,
      focusItemId,
      openDetail,
      prepareItemMenu,
      selectItem,
      visibleItemIdList
    ]
  )

  const itemActions = useCallback(
    (item: LibraryItemDto, targetIds: string[]): ItemActionHandlers => ({
      onOpen: () => openDetail(item.id),
      onOpenInNewWindow: () => {
        if (item.type !== 'note') return
        void window.electron.window.openNoteWindow(item.id).catch((error: unknown) => {
          notifyActionError(
            error instanceof Error ? error.message : 'The note could not be opened.'
          )
        })
      },
      onRename: () => {
        guardFocusTargets([item.id], () => {
          setRenameTarget(item)
          setRenameTitle(item.title)
        })
      },
      onPin: () => guardFocusTargets(targetIds, () => void setItemsPinned(targetIds, true)),
      onUnpin: () => guardFocusTargets(targetIds, () => void setItemsPinned(targetIds, false)),
      onMove: (nextDestination) =>
        guardFocusTargets(targetIds, () => void moveItemIds(targetIds, nextDestination)),
      onReveal: () => void revealItem(item.id),
      onArchive: () => guardFocusTargets(targetIds, () => void archiveItemIds(targetIds)),
      onUnarchive: () => guardFocusTargets(targetIds, () => void unarchiveItemIds(targetIds)),
      onTrash: () => guardFocusTargets(targetIds, () => void trashItemIds(targetIds)),
      onRestore: () => guardFocusTargets(targetIds, () => void restoreItemIds(targetIds)),
      onDeletePermanently: () =>
        guardFocusTargets(targetIds, () => requestPermanentDelete(targetIds)),
      onOpenSource: () => void openSource(item)
    }),
    [
      archiveItemIds,
      guardFocusTargets,
      moveItemIds,
      openSource,
      requestPermanentDelete,
      restoreItemIds,
      revealItem,
      setItemsPinned,
      trashItemIds,
      unarchiveItemIds,
      openDetail
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
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="menu"], [role="dialog"], [role="listbox"], [data-detail-surface]'
        )
      ) {
        return
      }

      const focusedItemId =
        target instanceof Element
          ? target.closest<HTMLElement>('[data-item-id]')?.dataset.itemId
          : null
      const targetIds = resolveItemShortcutTargets(
        selectedIds,
        focusedItemId ?? focusItemId,
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
        guardFocusTargets([item.id], () => {
          setRenameTarget(item)
          setRenameTitle(item.title)
        })
        return
      }

      event.preventDefault()
      if (destination.type === 'trash') {
        guardFocusTargets(targetIds, () => requestPermanentDelete(targetIds))
      } else guardFocusTargets(targetIds, () => void trashItemIds(targetIds))
    }
    window.addEventListener('keydown', handleItemShortcut)
    return () => window.removeEventListener('keydown', handleItemShortcut)
  }, [
    deleteTargets.length,
    destination.type,
    itemOperationBusy,
    renameTarget,
    requestPermanentDelete,
    selectedIds,
    trashItemIds,
    visibleItemIds,
    visibleItems,
    focusItemId,
    guardFocusTargets
  ])

  useEffect(() => {
    const clearSelectionOnEscape = (event: KeyboardEvent): void => {
      if (
        event.defaultPrevented ||
        event.key !== 'Escape' ||
        renameTarget !== null ||
        deleteTargets.length > 0 ||
        selectedIds.size === 0
      ) {
        return
      }
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"], [data-detail-surface]'))
        return
      event.preventDefault()
      clearSelection()
    }
    window.addEventListener('keydown', clearSelectionOnEscape)
    return () => window.removeEventListener('keydown', clearSelectionOnEscape)
  }, [clearSelection, deleteTargets.length, renameTarget, selectedIds.size])

  useEffect(() => {
    const selectAllItems = (event: KeyboardEvent): void => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        (!event.ctrlKey && !event.metaKey) ||
        event.key.toLocaleLowerCase() !== 'a' ||
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
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="menu"], [role="dialog"], [role="listbox"], [data-detail-surface]'
        )
      ) {
        return
      }
      event.preventDefault()
      selectAllVisibleItems(visibleItemIdList)
    }
    window.addEventListener('keydown', selectAllItems)
    return () => window.removeEventListener('keydown', selectAllItems)
  }, [
    deleteTargets.length,
    renameTarget,
    selectAllVisibleItems,
    visibleItemIdList,
    visibleItems.length
  ])

  const openComposer = useCallback((): void => {
    const open = (): void => {
      mainComposerOwnershipRequested.current = captureOwner.current !== 'main'
      setComposerOpen(true)
      setFocusDetailOpen(false)
      setFocusNoteExpanded(false)
      setComposerFocusRequest((request) => request + 1)
    }
    if (focusItemId) requestFocusTransition(open)
    else open()
  }, [focusItemId, requestFocusTransition])

  useEffect(() => {
    const handleNewItemShortcut = (event: KeyboardEvent): void => {
      if (
        event.defaultPrevented ||
        !event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLocaleLowerCase() !== 'n' ||
        document.querySelector('[role="dialog"]') !== null
      ) {
        return
      }
      event.preventDefault()
      openComposer()
    }
    window.addEventListener('keydown', handleNewItemShortcut)
    return () => window.removeEventListener('keydown', handleNewItemShortcut)
  }, [openComposer])

  const prepareGlobalCapture = useCallback((): void => {
    const modalOpen = document.querySelector('[role="dialog"]') !== null
    mainComposerOwnershipRequested.current = captureOwner.current !== 'main'
    setDestination({ type: 'inbox' })
    setSearch('')
    setTypeFilters([])
    clearSelectionSilently()
    setComposerOpen(true)
    setFocusNoteExpanded(false)
    if (!modalOpen) setComposerFocusRequest((request) => request + 1)
    announceStatus('Global capture ready in Inbox.')
    if (modalOpen) notifyGlobalCapturePrepared()
  }, [announceStatus, clearSelectionSilently])

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

  useEffect(
    () =>
      window.capture.onSessionChanged((session) => {
        if (session.libraryId !== library.id) return
        captureOwner.current = session.owner
        if (session.owner === 'main') mainComposerOwnershipRequested.current = false
        if (shouldYieldMainComposer(session.owner, mainComposerOwnershipRequested.current)) {
          setComposerOpen(false)
        }
      }),
    [library.id]
  )

  useEffect(
    () =>
      window.capture.onRecoveryRequested(() => {
        setCaptureRecoveryOpen(true)
      }),
    []
  )

  useEffect(
    () =>
      window.capture.onMainItemRequested((itemId) => {
        void window.kuskus.getState().then((result) => {
          if (!result.ok || result.data.status !== 'ready') {
            notifyActionError('The saved note could not be opened.')
            return
          }
          const nextLibrary = result.data.library
          const item = nextLibrary.items.find((candidate) => candidate.id === itemId)
          if (!item) {
            notifyActionError('The saved note could not be found.')
            return
          }
          const open = (): void => {
            setLibrary(nextLibrary)
            clearSelectionSilently()
            openDetail(item.id, item.type === 'note')
          }
          open()
        })
      }),
    [clearSelectionSilently, openDetail]
  )

  const changeComposerOpen = useCallback((open: boolean, returnFocus = true): void => {
    if (!open) mainComposerOwnershipRequested.current = false
    setComposerOpen(open)
    if (open) setFocusNoteExpanded(false)
    if (!open && returnFocus) setNewItemFocusRequest((request) => request + 1)
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
    (file: File, origin: 'clipboard' | 'file' = 'file'): void => {
      if (!file.type.startsWith('image/')) {
        notifyActionError('Only image files can be imported here right now.')
        return
      }
      importRequestId.current += 1
      setImportRequest({ id: importRequestId.current, file, origin })
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
        requestImageImport(file, 'clipboard')
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
    else if (files.length > 0) notifyActionError('Only image files can be imported here right now.')
  }

  const renameItemTitle = useCallback(
    async (item: LibraryItemDto, title: string): Promise<DetailTitleRenameResult> => {
      if (itemOperationBusy) {
        return { ok: false, error: 'Another item action is still finishing.' }
      }
      const updatedNotes =
        item.type === 'image'
          ? library.items.filter(
              (candidate) =>
                candidate.type === 'note' &&
                candidate.attachments.some((attachment) => attachment.id === item.id)
            ).length
          : 0
      setItemOperationBusy(true)
      try {
        const result = await window.kuskus.renameItem({ itemId: item.id, title })
        if (!result.ok) {
          applyLibraryResult(result)
          return { ok: false, error: result.error }
        }
        applyLibraryResult(result)
        if (updatedNotes > 0) {
          notifyReferenceAwareMove({ movedImages: 0, retainedImages: 0, updatedNotes })
        } else {
          notifyRenamed()
        }
        return { ok: true }
      } finally {
        setItemOperationBusy(false)
      }
    },
    [applyLibraryResult, itemOperationBusy, library.items]
  )

  const submitRename = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!renameTarget || !renameTitle.trim() || itemOperationBusy) return
    const result = await renameItemTitle(renameTarget, renameTitle)
    if (!result.ok) return
    setRenameTarget(null)
    setRenameTitle('')
  }

  const confirmPermanentDelete = async (): Promise<void> => {
    if (deleteTargets.length === 0 || !deleteInspection || itemOperationBusy) return
    setItemOperationBusy(true)
    try {
      const result = await window.kuskus.permanentlyDeleteItems({
        itemIds: deleteTargets,
        referenceRevision: deleteInspection.revision,
        confirmedReferencedItemIds: deleteInspection.referencedItems.map((item) => item.itemId),
        cleanupImageIds: cleanupUnusedImages
          ? deleteInspection.cleanupCandidates.map((item) => item.itemId)
          : []
      })
      if (!applyLibraryResult(result)) return
      const count = deleteTargets.length
      closePermanentDelete()
      notifyPermanentlyDeleted(count)
    } finally {
      setItemOperationBusy(false)
    }
  }

  useEffect(() => {
    if (deleteTargets.length === 0) return
    let active = true
    void window.kuskus
      .inspectItemDeletion({ itemIds: deleteTargets, mode: 'permanent' })
      .then((result) => {
        if (!active) return
        if (result.ok) setDeleteInspection(result.data)
        else notifyActionError(result.error)
      })
    return () => {
      active = false
    }
  }, [deleteTargets])

  const selectedItemIds = [...selectedIds]
  const deleteReviewNoteTitles = deleteInspection
    ? deleteInspection.referencedItems.flatMap((item) => item.noteTitles).slice(0, 5)
    : []
  const deleteReviewReferenceCount =
    deleteInspection?.referencedItems.reduce((count, item) => count + item.referenceCount, 0) ?? 0
  const trashReviewNoteTitles = trashReview
    ? trashReview.inspection.referencedItems.flatMap((item) => item.noteTitles).slice(0, 5)
    : []
  const trashReviewReferenceCount =
    trashReview?.inspection.referencedItems.reduce(
      (count, item) => count + item.referenceCount,
      0
    ) ?? 0
  const selectedItemLocations = library.items
    .filter((item) => selectedIds.has(item.id))
    .map((item) => item.location)
  const getItemMenuProps = (
    item: LibraryItemDto
  ): ItemActionHandlers & {
    targetCount: number
    targetLocations: LibraryItemDto['location'][]
    pinned: boolean
    onMenuOpen?: () => void
  } => {
    const targetIds = resolveItemMenuTargets(selectedIds, item.id, visibleItemIds)
    const targetIdSet = new Set(targetIds)
    return {
      targetCount: targetIds.length,
      targetLocations: library.items
        .filter((candidate) => targetIdSet.has(candidate.id))
        .map((candidate) => candidate.location),
      pinned: library.pinnedItemIds.includes(item.id),
      onMenuOpen: () => prepareItemMenu(item.id),
      ...itemActions(item, targetIds)
    }
  }

  const addItemComposer = (
    <AddItemComposer
      key={draftStorageKey}
      open={composerOpen}
      focusRequest={composerFocusRequest}
      discardRequest={composerDiscardRequest}
      libraryId={library.id}
      destination={
        destination.type === 'collection'
          ? { type: 'collection', collectionId: destination.collectionId }
          : { type: 'inbox' }
      }
      surface="main"
      draftStorageKey={draftStorageKey}
      importRequest={importRequest}
      view={view}
      presentation="card"
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
        if (released && matchesCurrentRetrieval(released)) {
          pendingRevealItemId.current = itemId
        }
      }}
      onStatus={announceStatus}
      onDraftStateChange={setComposerHasDraft}
      onTransientWorkChange={setComposerHasTransientWork}
    />
  )

  const externalImageImportPending =
    importRequest !== null &&
    'file' in importRequest &&
    importRequest.file.type.startsWith('image/')
  const showExternalDropShadow = isDragging || externalImageImportPending
  const captureSlot = (
    <div className={cn('relative min-w-0', !composerOpen && !showExternalDropShadow && 'hidden')}>
      <div
        inert={showExternalDropShadow ? true : undefined}
        className={cn(
          'transition-opacity [transition-duration:var(--motion-duration-press)] [transition-timing-function:var(--motion-ease-out)]',
          showExternalDropShadow && 'opacity-0'
        )}
      >
        <Suspense fallback={null}>{addItemComposer}</Suspense>
      </div>
      <ExternalDropShadow
        active={showExternalDropShadow}
        label={
          isDragging ? 'Release the image to add it to New Item' : 'Preparing image in New Item'
        }
        overlay={composerOpen}
      />
    </div>
  )

  const cardLayoutContent = (
    <>
      {captureSlot}
      {renderedItems.map((item) => (
        <ItemContextMenu
          item={item}
          collections={library.collections}
          {...getItemMenuProps(item)}
          key={item.id}
        >
          <div
            className="min-w-0 transition-opacity [transition-duration:var(--motion-duration-press)] [transition-timing-function:var(--motion-ease-out)] data-[dragging=true]:opacity-40"
            data-dragging={draggedItemIds.has(item.id)}
            data-item-id={item.id}
            draggable
            onDragStart={(event) => beginItemDrag(item.id, event)}
            onDragEnd={endItemDrag}
          >
            <div
              className={cn(
                'group/saved-item relative',
                view === 'visual' &&
                  'min-w-0 rounded-sm p-1 transition-[background-color] [transition-duration:var(--motion-duration-ui)] [transition-timing-function:var(--motion-ease-out)] hover:bg-muted/45 data-[selected=true]:bg-primary/10'
              )}
              data-selected={selectedIds.has(item.id) || undefined}
            >
              <SavedItemCard
                item={item}
                view={view === 'visual' ? 'visual' : 'grid'}
                selected={selectedIds.has(item.id)}
                showSelectionVisual={view !== 'visual'}
                onActivate={(event) => activateItem(item.id, event)}
                onOpen={() => openDetail(item.id)}
              />
              <div
                data-drag-preview-hidden
                className={cn(
                  'absolute z-30',
                  view === 'visual' ? 'top-3 right-3' : 'top-2 right-2'
                )}
                onClick={(event) => event.stopPropagation()}
              >
                <ItemActionMenu
                  item={item}
                  collections={library.collections}
                  showQuickSourceAction
                  {...getItemMenuProps(item)}
                />
              </div>
            </div>
          </div>
        </ItemContextMenu>
      ))}
    </>
  )

  const focusList = (
    <div className="flex size-full min-h-0 flex-col">
      <FocusListHeader
        keyboardShortcutsEnabled
        destinationLabel={destinationLabel(destination, library)}
        composerOpen={composerOpen}
        hasDraft={composerHasDraft}
        newItemFocusRequest={newItemFocusRequest}
        onNewItem={openComposer}
        search={search}
        onSearchChange={changeSearch}
        searchPending={searchPending}
        resultCount={visibleItems.length}
        totalCount={destinationItems.length}
        typeFilters={typeFilters}
        onTypeFilterChange={changeTypeFilter}
        showReferencedAttachments={showReferencedAttachments}
        onShowReferencedAttachmentsChange={setShowReferencedAttachments}
        onClearFilters={() => {
          setTypeFilters([])
          setShowReferencedAttachments(false)
        }}
        sort={sort}
        onSortChange={setSort}
        density={focusRailDensity}
        onDensityChange={setFocusRailDensity}
      />
      <FocusItemList
        items={visibleItems}
        density={focusRailDensity}
        activeItemId={focusItemId}
        selectedIds={selectedIds}
        draggedIds={draggedItemIds}
        composer={composerOpen || showExternalDropShadow ? captureSlot : null}
        onActivate={activateItem}
        onDragStart={beginItemDrag}
        onDragEnd={endItemDrag}
        renderActions={(item) => (
          <ItemActionMenu
            item={item}
            collections={library.collections}
            showQuickSourceAction={focusRailDensity === 'visual'}
            {...getItemMenuProps(item)}
          />
        )}
        wrapRow={(item, row) => (
          <ItemContextMenu
            key={item.id}
            item={item}
            collections={library.collections}
            {...getItemMenuProps(item)}
          >
            {row}
          </ItemContextMenu>
        )}
      />
    </div>
  )

  const focusDetail = focusItem ? (
    <Suspense fallback={<div className="size-full animate-pulse bg-muted/20" />}>
      <ItemDetailDialog
        ref={focusDetailRef}
        key={`focus-${focusItem.id}`}
        presentation="focus"
        item={focusItem}
        initialNoteMode={
          focusNoteMode ?? (focusItemEditOnOpenId === focusItem.id ? 'live' : undefined)
        }
        onNoteModeChange={setFocusNoteMode}
        expanded={focusNoteExpansionActive}
        onExpandedChange={changeFocusNoteExpanded}
        collections={library.collections}
        hasPrevious={focusVisibleIndex > 0}
        hasNext={focusVisibleIndex >= 0 && focusVisibleIndex < visibleItems.length - 1}
        onPrevious={selectPreviousFocusItem}
        onNext={selectNextFocusItem}
        onOpenChange={(open) => {
          if (open) return
          setFocusNoteExpanded(false)
          setFocusItemEditOnOpenId(null)
          setFocusItemId(null)
        }}
        onItemUpdated={updateItem}
        onRenameItem={renameItemTitle}
        libraryItems={library.items}
        onRenameAttachment={(itemId) => {
          const image = library.items.find((item) => item.id === itemId)
          if (!image || image.type !== 'image') return
          setRenameTarget(image)
          setRenameTitle(image.title)
        }}
        onMoveItem={(destination) => itemActions(focusItem, [focusItem.id]).onMove(destination)}
        onOpenVaultLink={openVaultLink}
        onMoveToTrash={(itemId) => {
          const target = library.items.find((item) => item.id === itemId)
          if (target) itemActions(target, [itemId]).onTrash()
        }}
        onEmptyNote={trashEmptyNote}
        renderActions={(guard, detailOptions) => {
          const actions = itemActions(focusItem, [focusItem.id])
          return (
            <ItemActionMenu
              item={focusItem}
              collections={library.collections}
              targetCount={1}
              targetLocations={[focusItem.location]}
              pinned={library.pinnedItemIds.includes(focusItem.id)}
              alwaysVisible
              triggerSurface="caption"
              hideOpenAction
              detailOptions={detailOptions}
              {...actions}
              onOpenInNewWindow={() => guard(actions.onOpenInNewWindow)}
              onRename={() => guard(actions.onRename)}
              onPin={() => guard(actions.onPin)}
              onUnpin={() => guard(actions.onUnpin)}
              onMove={(nextDestination) => guard(() => actions.onMove(nextDestination))}
              onArchive={() => guard(actions.onArchive)}
              onUnarchive={() => guard(actions.onUnarchive)}
              onTrash={() => guard(actions.onTrash)}
              onRestore={() => guard(actions.onRestore)}
              onDeletePermanently={() => guard(actions.onDeletePermanently)}
            />
          )
        }}
        onError={notifyActionError}
      />
    </Suspense>
  ) : (
    <Empty className="size-full gap-5">
      <EmptyHeader className="max-w-sm">
        <EmptyMedia
          variant="icon"
          className="size-12 rounded-2xl shadow-sm ring-1 ring-foreground/6"
        >
          <IconLibrary aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle className="font-heading text-xl text-balance">
          {visibleItems.length === 0 ? 'Nothing here yet' : 'Choose your next item'}
        </EmptyTitle>
        <EmptyDescription className="text-pretty leading-5">
          {visibleItems.length === 0
            ? 'Capture something new or adjust the current search and filters.'
            : 'Open another item from the list, or return to your visual overview.'}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" onClick={returnToMasonry}>
          <IconLayoutDashboard aria-hidden="true" />
          Masonry overview
        </Button>
      </EmptyContent>
    </Empty>
  )

  return (
    <SidebarProvider
      keyboardShortcutEnabled={!focusWorkspaceOpen}
      open={!sidebarHidden && !focusNoteExpansionActive}
      onOpenChange={(open) => setSidebarHidden(!open)}
      width={sidebarWidth}
      onWidthChange={setSidebarWidth}
      minWidth={MIN_SIDEBAR_WIDTH}
      maxWidth={MAX_SIDEBAR_WIDTH}
      className="window-root h-screen min-h-0 overflow-hidden text-foreground"
    >
      <LibrarySidebar
        key={library.id}
        library={library}
        theme={theme}
        onThemeChange={setTheme}
        view={view}
        onViewChange={changeView}
        destination={destination}
        onDestinationChange={changeDestination}
        onLibraryChange={(nextLibrary) => {
          const apply = (): void => setLibrary(nextLibrary)
          if (focusItemId) requestFocusTransition(apply)
          else apply()
        }}
        onError={notifyActionError}
        onStatus={announceStatus}
        onMoveItems={(itemIds, nextDestination) =>
          guardFocusTargets(itemIds, () => void moveItemIds(itemIds, nextDestination))
        }
        librarySwitchBlocked={importRequest !== null || composerHasTransientWork}
        globalCaptureShortcutStatus={globalCaptureShortcutStatus}
        translucentBackgroundEnabled={translucentBackground.enabled}
        translucentBackgroundSupported={translucentBackground.supported}
        translucentBackgroundReduced={translucentBackground.reducedTransparency}
        onTranslucentBackgroundChange={translucentBackground.setEnabled}
      />
      <SidebarInset>
        {focusWorkspaceOpen ? null : (
          <AppToolbar
            keyboardShortcutsEnabled
            newItemOpen={composerOpen}
            hasDraft={composerHasDraft}
            newItemFocusRequest={newItemFocusRequest}
            onNewItem={openComposer}
            onDiscardDraft={() => setComposerDiscardRequest((request) => request + 1)}
            search={search}
            searchScope={destinationLabel(destination, library)}
            onSearchChange={changeSearch}
            searchPending={searchPending}
            resultCount={visibleItems.length}
            totalCount={destinationItems.length}
            typeFilters={typeFilters}
            onTypeFilterChange={changeTypeFilter}
            showReferencedAttachments={showReferencedAttachments}
            onShowReferencedAttachmentsChange={setShowReferencedAttachments}
            onClearFilters={() => {
              setTypeFilters([])
              setShowReferencedAttachments(false)
            }}
            sort={sort}
            onSortChange={setSort}
            onWindowClose={window.electron.window.close}
          />
        )}
        {focusWorkspaceOpen ? (
          <main
            className="window-canvas flex min-h-0 min-w-0 flex-1 flex-col"
            onDragEnter={(event) => {
              if (!hasFileDrag(event.dataTransfer)) return
              event.preventDefault()
              dragDepth.current += 1
              setIsDragging(hasSupportedImageDrag(event.dataTransfer))
            }}
            onDragOver={(event) => {
              if (!hasFileDrag(event.dataTransfer)) return
              event.preventDefault()
              const supported = hasSupportedImageDrag(event.dataTransfer)
              event.dataTransfer.dropEffect = supported ? 'copy' : 'none'
              setIsDragging(supported)
            }}
            onDragLeave={() => {
              dragDepth.current = Math.max(0, dragDepth.current - 1)
              if (dragDepth.current === 0) setIsDragging(false)
            }}
            onDrop={captureDroppedImage}
          >
            {library.repairConflicts.length > 0 ? (
              <Alert className="m-3 mb-0 shrink-0">
                <AlertTitle>Some legacy metadata needs review</AlertTitle>
                <AlertDescription>
                  {library.repairConflicts.length} Markdown{' '}
                  {library.repairConflicts.length === 1 ? 'file was' : 'files were'} left unchanged.
                </AlertDescription>
              </Alert>
            ) : null}
            <FocusWorkspace
              listWidth={focusListWidth}
              onListWidthChange={setFocusListWidth}
              expanded={focusNoteExpansionActive}
              detailOpen={focusDetailOpen}
              onSplitChange={handleFocusSplitChange}
              onWindowClose={() => requestFocusTransition(window.electron.window.close)}
              list={focusList}
              detail={focusDetail}
            />
          </main>
        ) : null}
        <Activity mode={focusWorkspaceOpen ? 'hidden' : 'visible'}>
          <ScrollArea className="library-scroll-container window-canvas min-h-0 min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]]:focus-visible:ring-0 [&_[data-slot=scroll-area-viewport]]:focus-visible:outline-none">
            <main
              className="relative min-h-full"
              onDragEnter={(event) => {
                if (!hasFileDrag(event.dataTransfer)) return
                event.preventDefault()
                dragDepth.current += 1
                setIsDragging(hasSupportedImageDrag(event.dataTransfer))
              }}
              onDragOver={(event) => {
                if (!hasFileDrag(event.dataTransfer)) return
                event.preventDefault()
                const supported = hasSupportedImageDrag(event.dataTransfer)
                event.dataTransfer.dropEffect = supported ? 'copy' : 'none'
                setIsDragging(supported)
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
                  hasBulkItemSelection(selectedItemIds.length) && 'pb-24 lg:pb-24'
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
                {view === 'visual' ? (
                  <>
                    <OrderedMasonry>{cardLayoutContent}</OrderedMasonry>
                    {renderedItems.length < visibleItems.length ? (
                      <div ref={loadMoreItemsRef} className="h-px" aria-hidden="true" />
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
                      {cardLayoutContent}
                    </div>
                    {renderedItems.length < visibleItems.length ? (
                      <div ref={loadMoreItemsRef} className="h-px" aria-hidden="true" />
                    ) : null}
                  </>
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
                      {search.trim().length > 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            changeSearch('')
                            clearSelectionSilently()
                          }}
                        >
                          Clear search
                        </Button>
                      ) : null}
                      {typeFilters.length > 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTypeFilters([])
                            clearSelectionSilently()
                          }}
                        >
                          Remove type filters
                        </Button>
                      ) : null}
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
                            : destination.type === 'all'
                              ? 'A private, local library for links, images, notes, and files.'
                              : destination.type === 'collection'
                                ? 'Capture a link, image, note, or file right into this folder.'
                                : 'Everything you capture lands here until you organize it.'}
                      </EmptyDescription>
                    </EmptyHeader>
                    {destination.type !== 'archive' && destination.type !== 'trash' ? (
                      <EmptyContent>
                        <Button size="sm" aria-keyshortcuts="Control+N" onClick={openComposer}>
                          New item
                          <Kbd className="ml-1 bg-primary-foreground/15 text-primary-foreground">
                            Ctrl+N
                          </Kbd>
                        </Button>
                        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>Paste or drop anywhere in this window</span>
                          {globalCaptureShortcutStatus?.registered ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                Capture from any app with{' '}
                                <Kbd>{globalCaptureShortcutStatus.accelerator}</Kbd>
                              </span>
                            </>
                          ) : null}
                        </div>
                      </EmptyContent>
                    ) : null}
                  </Empty>
                )}
              </div>
            </main>
          </ScrollArea>
        </Activity>
        <BulkActionToolbar
          selectedItemIds={selectedItemIds}
          selectedItemLocations={selectedItemLocations}
          destination={destination}
          collections={library.collections}
          onMove={(itemIds, nextDestination) =>
            guardFocusTargets(itemIds, () => void moveItemIds(itemIds, nextDestination))
          }
          onArchive={(itemIds) => guardFocusTargets(itemIds, () => void archiveItemIds(itemIds))}
          onUnarchive={(itemIds) =>
            guardFocusTargets(itemIds, () => void unarchiveItemIds(itemIds))
          }
          onPinChange={(itemIds, pinned) =>
            guardFocusTargets(itemIds, () => void setItemsPinned(itemIds, pinned))
          }
          allPinned={
            selectedItemIds.length > 0 &&
            selectedItemIds.every((itemId) => library.pinnedItemIds.includes(itemId))
          }
          onTrash={(itemIds) => guardFocusTargets(itemIds, () => void trashItemIds(itemIds))}
          onRestore={(itemIds) => guardFocusTargets(itemIds, () => void restoreItemIds(itemIds))}
          onDeletePermanently={(itemIds) =>
            guardFocusTargets(itemIds, () => requestPermanentDelete(itemIds))
          }
          onClearSelection={clearSelection}
        />
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {statusMessage}
        </p>
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
                  This renames the visible vault file. Kuskus keeps its stable identity, updates
                  inbound references, and moves a legacy companion assets folder when present.
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
            if (!open && !itemOperationBusy) closePermanentDelete()
          }}
        >
          <AlertDialogContent size="sm" className="max-w-sm!">
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
            {deleteInspection && deleteInspection.referencedItems.length > 0 ? (
              <div className="space-y-4">
                <Alert variant="destructive" className="border-destructive/25 bg-destructive/10">
                  <IconAlertTriangle aria-hidden="true" />
                  <AlertTitle className="text-foreground">
                    {deleteReviewReferenceCount}{' '}
                    {deleteReviewReferenceCount === 1 ? 'place' : 'places'} in your notes will keep
                    showing a missing image
                  </AlertTitle>
                  <AlertDescription>
                    You cannot restore{' '}
                    {deleteInspection.referencedItems.length === 1 ? 'this image' : 'these images'}{' '}
                    from Trash after this action.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2 text-left">
                  <p className="text-xs font-medium text-muted-foreground">Affected notes</p>
                  <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-xl bg-muted/55 px-3 py-2.5 text-sm ring-1 ring-foreground/6">
                    {deleteReviewNoteTitles.map((title, index) => (
                      <li key={`${title}:${index}`} className="truncate text-foreground">
                        {title}
                      </li>
                    ))}
                    {deleteReviewReferenceCount > deleteReviewNoteTitles.length ? (
                      <li className="text-muted-foreground">
                        {deleteReviewReferenceCount - deleteReviewNoteTitles.length} more
                      </li>
                    ) : null}
                  </ul>
                </div>
              </div>
            ) : null}
            {deleteInspection && deleteInspection.cleanupCandidates.length > 0 ? (
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Also move unused images to Trash</p>
                  <p className="text-xs text-muted-foreground">
                    {deleteInspection.cleanupCandidates.length}{' '}
                    {deleteInspection.cleanupCandidates.length === 1 ? 'image is' : 'images are'} no
                    longer referenced by another note.
                  </p>
                </div>
                <Switch
                  aria-label="Also move unused images to Trash"
                  checked={cleanupUnusedImages}
                  onCheckedChange={setCleanupUnusedImages}
                />
              </div>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={itemOperationBusy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={itemOperationBusy || deleteInspection === null}
                onClick={() => void confirmPermanentDelete()}
              >
                Delete permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={trashReview !== null}
          onOpenChange={(open) => {
            if (!open && !itemOperationBusy) setTrashReview(null)
          }}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {trashReview?.inspection.referencedItems.length === 1
                  ? 'This image is still in use'
                  : 'These images are still in use'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Moving {trashReview?.inspection.referencedItems.length === 1 ? 'it' : 'them'} to
                Trash hides {trashReview?.inspection.referencedItems.length === 1 ? 'it' : 'them'}
                from every note that uses{' '}
                {trashReview?.inspection.referencedItems.length === 1 ? 'it' : 'them'}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {trashReview ? (
              <div className="space-y-4">
                <Alert variant="destructive" className="border-destructive/25 bg-destructive/10">
                  <IconAlertTriangle aria-hidden="true" />
                  <AlertTitle className="text-foreground">
                    {trashReviewReferenceCount}{' '}
                    {trashReviewReferenceCount === 1 ? 'place' : 'places'} in your notes will show a
                    missing image
                  </AlertTitle>
                  <AlertDescription>
                    Restore{' '}
                    {trashReview.inspection.referencedItems.length === 1
                      ? 'the image'
                      : 'the images'}{' '}
                    from Trash to make{' '}
                    {trashReview.inspection.referencedItems.length === 1 ? 'it' : 'them'} appear
                    again.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2 text-left">
                  <p className="text-xs font-medium text-muted-foreground">Affected notes</p>
                  <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-xl bg-muted/55 px-3 py-2.5 text-sm ring-1 ring-foreground/6">
                    {trashReviewNoteTitles.map((title, index) => (
                      <li key={`${title}:${index}`} className="truncate text-foreground">
                        {title}
                      </li>
                    ))}
                    {trashReviewReferenceCount > trashReviewNoteTitles.length ? (
                      <li className="text-muted-foreground">
                        {trashReviewReferenceCount - trashReviewNoteTitles.length} more
                      </li>
                    ) : null}
                  </ul>
                </div>
              </div>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={itemOperationBusy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={itemOperationBusy}
                onClick={() => void confirmReferencedTrash()}
              >
                Move to Trash
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <CaptureRecoveryDialog
          libraryId={library.id}
          open={captureRecoveryOpen}
          onOpenChange={setCaptureRecoveryOpen}
          onRestored={() => {
            setComposerOpen(true)
            setFocusNoteExpanded(false)
            setComposerFocusRequest((request) => request + 1)
          }}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
