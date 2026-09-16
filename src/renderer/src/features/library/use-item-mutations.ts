import { useCallback, useEffect, useState } from 'react'

import { countReferencedImageChanges } from '@/features/library/reference-image-move'
import type { ItemActionHandlers } from '@/features/items/item-action-menu'
import type { DetailTitleRenameResult } from '@/features/items/item-detail-dialog'
import { resolveItemMenuTargets } from '@/features/items/item-shortcuts'
import type {
  ActiveItemLocation,
  ApiResult,
  ItemDeletionInspectionDto,
  LibraryDto,
  LibraryItemDto
} from '../../../../shared/library-contract'

export interface ItemMutationDependencies {
  library: LibraryDto
  selectedIds: ReadonlySet<string>
  visibleItemIds: ReadonlySet<string>
  visibleItemIdList: readonly string[]
  anchorId: string | null
  focusItemId: string | null
  composerHasTransientWork: boolean
  applyLibraryResult: (result: ApiResult<LibraryDto>) => LibraryDto | null
  guardFocusTargets: (itemIds: readonly string[], action: () => void) => void
  openDetail: (itemId: string, edit?: boolean) => void
  announceStatus: (message: string) => void
  notifyActionError: (message: string) => void
  notifyReferenceAwareMove: (counts: {
    movedImages: number
    retainedImages: number
    updatedNotes: number
  }) => void
  notifyArchived: (count: number, undo: () => void, detail?: string) => void
  notifyUnarchived: (count: number, detail?: string) => void
  notifyTrashed: (count: number, undo: () => void) => void
  notifyRestored: (count: number, detail?: string) => void
  notifyEmptyNoteTrashed: (undo: () => void) => void
  notifyRenamed: () => void
  notifyPermanentlyDeleted: (count: number) => void
  onOpenInNewWindow: (itemId: string) => void
  openSource: (item: LibraryItemDto) => Promise<void>
  revealItem: (itemId: string) => Promise<void>
  prepareItemMenu: (itemId: string) => void
  selectItem: (
    itemId: string,
    visibleIds: readonly string[],
    modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }
  ) => void
  clearSelectionSilently: () => void
}

export interface ItemMutations {
  itemOperationBusy: boolean
  renameTarget: LibraryItemDto | null
  renameTitle: string
  deleteTargets: string[]
  deleteInspection: ItemDeletionInspectionDto | null
  cleanupUnusedImages: boolean
  trashReview: { itemIds: string[]; inspection: ItemDeletionInspectionDto } | null
  deleteReviewNoteTitles: string[]
  deleteReviewReferenceCount: number
  trashReviewNoteTitles: string[]
  trashReviewReferenceCount: number
  requestPermanentDelete: (itemIds: string[]) => void
  closePermanentDelete: () => void
  setCleanupUnusedImages: (value: boolean) => void
  setRenameTarget: (item: LibraryItemDto | null) => void
  setRenameTitle: (title: string) => void
  setTrashReview: (
    review: { itemIds: string[]; inspection: ItemDeletionInspectionDto } | null
  ) => void
  moveItemIds: (itemIds: string[], nextDestination: ActiveItemLocation) => Promise<void>
  archiveItemIds: (itemIds: string[], showUndo?: boolean) => Promise<void>
  unarchiveItemIds: (itemIds: string[], notify?: boolean) => Promise<void>
  trashItemIds: (itemIds: string[], showUndo?: boolean) => Promise<boolean>
  trashEmptyNote: (itemId: string) => Promise<boolean>
  restoreItemIds: (itemIds: string[], notify?: boolean) => Promise<void>
  renameItemTitle: (item: LibraryItemDto, title: string) => Promise<DetailTitleRenameResult>
  submitRename: (event: { preventDefault: () => void }) => Promise<void>
  confirmPermanentDelete: () => Promise<void>
  confirmReferencedTrash: () => Promise<void>
  itemActions: (item: LibraryItemDto, targetIds: string[]) => ItemActionHandlers
  getItemMenuProps: (item: LibraryItemDto) => ItemActionHandlers & {
    targetCount: number
    targetLocations: LibraryItemDto['location'][]
    pinned: boolean
    onMenuOpen?: () => void
  }
  setItemsPinned: (itemIds: string[], pinned: boolean) => Promise<void>
  activateItem: (
    itemId: string,
    event: Pick<React.MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>
  ) => void
}

export function useItemMutations(deps: ItemMutationDependencies): ItemMutations {
  const {
    library,
    selectedIds,
    visibleItemIds,
    visibleItemIdList,
    anchorId,
    focusItemId,
    composerHasTransientWork,
    applyLibraryResult,
    guardFocusTargets,
    openDetail,
    announceStatus,
    notifyActionError,
    notifyReferenceAwareMove,
    notifyArchived,
    notifyUnarchived,
    notifyTrashed,
    notifyRestored,
    notifyEmptyNoteTrashed,
    notifyRenamed,
    notifyPermanentlyDeleted,
    onOpenInNewWindow,
    openSource,
    revealItem,
    prepareItemMenu,
    selectItem,
    clearSelectionSilently
  } = deps

  const [renameTarget, setRenameTarget] = useState<LibraryItemDto | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [deleteTargets, setDeleteTargets] = useState<string[]>([])
  const [deleteInspection, setDeleteInspection] = useState<ItemDeletionInspectionDto | null>(null)
  const [cleanupUnusedImages, setCleanupUnusedImages] = useState(false)
  const [trashReview, setTrashReview] = useState<{
    itemIds: string[]
    inspection: ItemDeletionInspectionDto
  } | null>(null)
  const [itemOperationBusy, setItemOperationBusy] = useState(false)

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

  const moveItemIds = useCallback(
    async (itemIds: string[], nextDestination: ActiveItemLocation): Promise<void> => {
      const requested = new Set(itemIds)
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
        const changes = countReferencedImageChanges(requested, library.items, nextLibrary.items)
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
        if (changes.movedImages + changes.retainedImages + updatedNotes > 0) {
          notifyReferenceAwareMove({
            movedImages: changes.movedImages,
            retainedImages: changes.retainedImages,
            updatedNotes
          })
        }
      } finally {
        setItemOperationBusy(false)
      }
    },
    [applyLibraryResult, library.items, notifyReferenceAwareMove]
  )

  const archiveItemIds = useCallback(
    async (itemIds: string[], showUndo = true): Promise<void> => {
      const requested = new Set(itemIds)
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
        const changes = countReferencedImageChanges(requested, library.items, nextLibrary.items)
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
              changes.movedImages > 0
                ? `${changes.movedImages} ${changes.movedImages === 1 ? 'image was' : 'images were'} archived with the note.`
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
    [applyLibraryResult, library.items, notifyArchived]
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
        const changes = countReferencedImageChanges(requested, library.items, nextLibrary.items)
        if (notify) {
          notifyUnarchived(
            itemIds.length,
            [
              missingPreviousFolder
                ? 'A previous folder was unavailable, so the item was returned to Inbox.'
                : '',
              changes.movedImages > 0
                ? `${changes.movedImages} ${changes.movedImages === 1 ? 'image was' : 'images were'} restored with the note.`
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
    [applyLibraryResult, library.collections, library.items, notifyUnarchived]
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
        applyLibraryResult(result)
        announceStatus(
          `${itemIds.length} ${itemIds.length === 1 ? 'item' : 'items'} ${
            pinned ? 'pinned' : 'unpinned'
          }`
        )
      } finally {
        setItemOperationBusy(false)
      }
    },
    [announceStatus, applyLibraryResult, notifyActionError]
  )

  const duplicateNote = useCallback(
    async (item: LibraryItemDto): Promise<void> => {
      if (item.type !== 'note') return
      setItemOperationBusy(true)
      try {
        const result = await window.kuskus.duplicateNote(item.id)
        if (!applyLibraryResult(result)) return
        announceStatus('Note duplicated.')
      } finally {
        setItemOperationBusy(false)
      }
    },
    [announceStatus, applyLibraryResult]
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
    [applyLibraryResult, notifyActionError, notifyTrashed]
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
    [applyLibraryResult, notifyEmptyNoteTrashed, trashItemIds]
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
    [applyLibraryResult, library.collections, library.items, notifyRestored]
  )

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
    [applyLibraryResult, itemOperationBusy, library.items, notifyReferenceAwareMove, notifyRenamed]
  )

  const submitRename = async (event: { preventDefault: () => void }): Promise<void> => {
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
  }, [deleteTargets, notifyActionError])

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
        onOpenInNewWindow(item.id)
      },
      onDuplicate: () => guardFocusTargets([item.id], () => void duplicateNote(item)),
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
      onCopyPath: () => {
        void window.kuskus.copyItemPath(item.id).then((result) => {
          if (result.ok) announceStatus('File path copied.')
          else notifyActionError(result.error)
        })
      },
      onCopyImage: () => {
        if (item.type !== 'image') return
        void window.kuskus.copyImage(item.id).then((result) => {
          if (result.ok) announceStatus('Image copied.')
          else notifyActionError(result.error)
        })
      },
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
      announceStatus,
      duplicateNote,
      guardFocusTargets,
      moveItemIds,
      onOpenInNewWindow,
      openDetail,
      openSource,
      notifyActionError,
      requestPermanentDelete,
      restoreItemIds,
      revealItem,
      setItemsPinned,
      trashItemIds,
      unarchiveItemIds
    ]
  )

  const getItemMenuProps = useCallback(
    (
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
    },
    [
      itemActions,
      library.items,
      library.pinnedItemIds,
      prepareItemMenu,
      selectedIds,
      visibleItemIds
    ]
  )

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

  return {
    itemOperationBusy,
    renameTarget,
    renameTitle,
    deleteTargets,
    deleteInspection,
    cleanupUnusedImages,
    trashReview,
    deleteReviewNoteTitles,
    deleteReviewReferenceCount,
    trashReviewNoteTitles,
    trashReviewReferenceCount,
    requestPermanentDelete,
    closePermanentDelete,
    setCleanupUnusedImages,
    setRenameTarget,
    setRenameTitle,
    setTrashReview,
    moveItemIds,
    archiveItemIds,
    unarchiveItemIds,
    trashItemIds,
    trashEmptyNote,
    restoreItemIds,
    renameItemTitle,
    submitRename,
    confirmPermanentDelete,
    confirmReferencedTrash,
    itemActions,
    getItemMenuProps,
    setItemsPinned,
    activateItem
  }
}
