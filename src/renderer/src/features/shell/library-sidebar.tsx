import {
  IconArchive,
  IconChevronRight,
  IconCopy,
  IconDeviceDesktop,
  IconDots,
  IconFolder,
  IconFolderOpen,
  IconIcons,
  IconInbox,
  IconLibrary,
  IconKeyboard,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconMoon,
  IconPalette,
  IconPencil,
  IconPlus,
  IconSettings,
  IconSun,
  IconTable,
  IconTrash,
  IconTypography,
  type TablerIcon
} from '@tabler/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import {
  Sidebar as AppSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarRail,
  SidebarSeparator
} from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { CollectionIcon } from '@/features/collections/collection-icons'
import { FolderIconPickerDialog } from '@/features/collections/folder-icon-picker-dialog'
import { FolderMoveDialog } from '@/features/collections/folder-move-dialog'
import { FolderNameDialog } from '@/features/collections/folder-name-dialog'
import {
  hasKuskusFolderDrag,
  KUSKUS_FOLDER_DRAG_TYPE,
  readKuskusFolderDrag
} from '@/features/collections/folder-drag'
import {
  buildFolderSubtreeCounts,
  buildFolderTree,
  getFolderAncestorIds,
  sanitizeCollapsedFolderIds,
  type FolderTreeNode
} from '@/features/collections/folder-tree'
import type { LibraryView } from '@/features/items/item-view'
import { hasKuskusItemDrag, readKuskusItemDrag } from '@/features/items/item-drag'
import type { Theme } from '@/hooks/use-theme'
import type {
  CollectionDto,
  CollectionIconKey,
  ActiveItemLocation,
  LibraryDto
} from '../../../../shared/library-contract'
import type { GlobalCaptureShortcutStatus } from '../../../../shared/window-contract'
import { cn } from '@/lib/utils'
import { notifyCollectionRemoved } from '@/lib/notify'

type FolderDialogState =
  { type: 'create'; parentId: string | null } | { type: 'rename'; id: string } | null
type FolderDropTarget = { type: 'root' } | { type: 'folder'; id: string } | null
export type LibraryDestination =
  | { type: 'inbox' }
  | { type: 'all' }
  | { type: 'collection'; collectionId: string }
  | { type: 'archive' }
  | { type: 'trash' }

const VIEW_OPTIONS: Array<{ value: LibraryView; label: string; icon: TablerIcon }> = [
  { value: 'visual', label: 'Masonry', icon: IconLayoutDashboard },
  { value: 'grid', label: 'Grid', icon: IconLayoutGrid },
  { value: 'table', label: 'Table', icon: IconTable }
]

const FOLDER_TREE_STORAGE_VERSION = 'v1'

function folderTreeStorageKey(libraryId: string): string {
  return `kuskus-folder-tree:${FOLDER_TREE_STORAGE_VERSION}:${libraryId}`
}

function loadCollapsedFolderIds(library: LibraryDto): Set<string> {
  try {
    const stored = localStorage.getItem(folderTreeStorageKey(library.id))
    if (!stored) return new Set()
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === 'string')) {
      return new Set()
    }
    return sanitizeCollapsedFolderIds(library.collections, parsed)
  } catch {
    return new Set()
  }
}

function saveCollapsedFolderIds(libraryId: string, collapsedIds: Set<string>): void {
  try {
    localStorage.setItem(folderTreeStorageKey(libraryId), JSON.stringify([...collapsedIds]))
  } catch {
    // Disclosure preferences are optional UI state; the vault remains authoritative.
  }
}

interface FolderActionHandlers {
  onAddSubfolder: (folderId: string) => void
  onChangeIcon: (folderId: string) => void
  onMove: (folderId: string) => void
  onRename: (folderId: string, name: string) => void
  onRemove: (folderId: string, name: string) => void
}

function FolderDropdownActions({
  folder,
  onAddSubfolder,
  onChangeIcon,
  onMove,
  onRename,
  onRemove
}: { folder: CollectionDto } & FolderActionHandlers): React.JSX.Element {
  return (
    <DropdownMenuGroup>
      <DropdownMenuItem onClick={() => onAddSubfolder(folder.id)}>
        <IconPlus data-icon="inline-start" aria-hidden="true" />
        Add subfolder
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onChangeIcon(folder.id)}>
        <IconIcons data-icon="inline-start" aria-hidden="true" />
        Change icon
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onMove(folder.id)}>
        <IconFolderOpen data-icon="inline-start" aria-hidden="true" />
        Move to…
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onRename(folder.id, folder.name)}>
        <IconPencil data-icon="inline-start" aria-hidden="true" />
        Rename
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onRemove(folder.id, folder.name)}>
        <IconTrash aria-hidden="true" />
        Remove
      </DropdownMenuItem>
    </DropdownMenuGroup>
  )
}

function FolderContextActions({
  folder,
  onAddSubfolder,
  onChangeIcon,
  onMove,
  onRename,
  onRemove
}: { folder: CollectionDto } & FolderActionHandlers): React.JSX.Element {
  return (
    <ContextMenuGroup>
      <ContextMenuItem onClick={() => onAddSubfolder(folder.id)}>
        <IconPlus data-icon="inline-start" aria-hidden="true" />
        Add subfolder
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onChangeIcon(folder.id)}>
        <IconIcons data-icon="inline-start" aria-hidden="true" />
        Change icon
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onMove(folder.id)}>
        <IconFolderOpen data-icon="inline-start" aria-hidden="true" />
        Move to…
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onRename(folder.id, folder.name)}>
        <IconPencil data-icon="inline-start" aria-hidden="true" />
        Rename
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onRemove(folder.id, folder.name)}>
        <IconTrash aria-hidden="true" />
        Remove
      </ContextMenuItem>
    </ContextMenuGroup>
  )
}

function FolderTree({
  nodes,
  depth = 0,
  collapsedIds,
  selectedId,
  activeDropTarget,
  counts,
  onToggle,
  onSelect,
  onDropTargetChange,
  onDropTargetLeave,
  onMoveItems,
  onMoveFolder,
  onRequestMoveFolder,
  onAddSubfolder,
  onChangeIcon,
  onRename,
  onRemove
}: {
  nodes: FolderTreeNode[]
  depth?: number
  collapsedIds: Set<string>
  selectedId: string | null
  activeDropTarget: FolderDropTarget
  counts: ReadonlyMap<string, number>
  onToggle: (folderId: string) => void
  onSelect: (folderId: string) => void
  onDropTargetChange: (target: FolderDropTarget) => void
  onDropTargetLeave: (target: Exclude<FolderDropTarget, null>) => void
  onMoveItems: (itemIds: string[], destination: ActiveItemLocation) => void
  onMoveFolder: (folderId: string, parentId: string | null) => void
  onRequestMoveFolder: (folderId: string) => void
  onAddSubfolder: (folderId: string) => void
  onChangeIcon: (folderId: string) => void
  onRename: (folderId: string, name: string) => void
  onRemove: (folderId: string, name: string) => void
}): React.JSX.Element {
  return (
    <SidebarMenu aria-label="Folders">
      {nodes.map((node) => (
        <FolderTreeItem
          key={node.folder.id}
          node={node}
          depth={depth}
          collapsedIds={collapsedIds}
          selectedId={selectedId}
          activeDropTarget={activeDropTarget}
          counts={counts}
          onToggle={onToggle}
          onSelect={onSelect}
          onDropTargetChange={onDropTargetChange}
          onDropTargetLeave={onDropTargetLeave}
          onMoveItems={onMoveItems}
          onMoveFolder={onMoveFolder}
          onRequestMoveFolder={onRequestMoveFolder}
          onAddSubfolder={onAddSubfolder}
          onChangeIcon={onChangeIcon}
          onRename={onRename}
          onRemove={onRemove}
        />
      ))}
    </SidebarMenu>
  )
}

type FolderTreeItemProps = Omit<React.ComponentProps<typeof FolderTree>, 'nodes'> & {
  node: FolderTreeNode
  depth: number
}

function FolderTreeItem({
  node,
  depth,
  collapsedIds,
  selectedId,
  activeDropTarget,
  counts,
  onToggle,
  onSelect,
  onDropTargetChange,
  onDropTargetLeave,
  onMoveItems,
  onMoveFolder,
  onRequestMoveFolder,
  onAddSubfolder,
  onChangeIcon,
  onRename,
  onRemove
}: FolderTreeItemProps): React.JSX.Element {
  const { folder, children } = node
  const hasChildren = children.length > 0
  const expanded = hasChildren && !collapsedIds.has(folder.id)
  const childListId = `folder-children-${folder.id}`
  const dropTarget = { type: 'folder', id: folder.id } as const
  const dropActive = activeDropTarget?.type === 'folder' && activeDropTarget.id === folder.id
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const actionHandlers: FolderActionHandlers = {
    onAddSubfolder,
    onChangeIcon,
    onMove: onRequestMoveFolder,
    onRename,
    onRemove
  }
  const clearDragState = (): void => {
    onDropTargetLeave(dropTarget)
    if (expandTimer.current !== null) {
      clearTimeout(expandTimer.current)
      expandTimer.current = null
    }
  }
  useEffect(
    () => () => {
      if (expandTimer.current !== null) clearTimeout(expandTimer.current)
    },
    []
  )

  return (
    <SidebarMenuItem>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div
              draggable
              className={cn(
                'group/folder-row relative flex h-8 w-full min-w-0 items-center rounded-xl text-sidebar-foreground/70 ring-sidebar-ring outline-hidden transition-[background-color,color,box-shadow] [transition-duration:var(--motion-duration-tooltip)] [transition-timing-function:var(--motion-ease-out)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground has-[:focus-visible]:ring-3 motion-reduce:transition-none',
                selectedId === folder.id &&
                  'bg-sidebar-accent font-medium text-sidebar-accent-foreground ring-1 ring-sidebar-ring/30',
                dropActive &&
                  'bg-sidebar-accent text-sidebar-accent-foreground ring-2 ring-sidebar-ring'
              )}
              style={{ paddingInlineStart: `${depth * 0.75}rem` }}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData(KUSKUS_FOLDER_DRAG_TYPE, folder.id)
                event.dataTransfer.setData('text/plain', folder.name)
              }}
              onDragEnd={() => {
                clearDragState()
                onDropTargetChange(null)
              }}
              onDragEnter={(event) => {
                if (
                  !hasKuskusItemDrag(event.dataTransfer) &&
                  !hasKuskusFolderDrag(event.dataTransfer)
                )
                  return
                event.preventDefault()
                event.stopPropagation()
                onDropTargetChange(dropTarget)
                if (hasChildren && !expanded && expandTimer.current === null) {
                  expandTimer.current = setTimeout(() => {
                    expandTimer.current = null
                    onToggle(folder.id)
                  }, 600)
                }
              }}
              onDragOver={(event) => {
                if (
                  !hasKuskusItemDrag(event.dataTransfer) &&
                  !hasKuskusFolderDrag(event.dataTransfer)
                )
                  return
                event.preventDefault()
                event.stopPropagation()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                clearDragState()
              }}
              onDrop={(event) => {
                if (
                  !hasKuskusItemDrag(event.dataTransfer) &&
                  !hasKuskusFolderDrag(event.dataTransfer)
                )
                  return
                event.preventDefault()
                event.stopPropagation()
                const itemIds = readKuskusItemDrag(event.dataTransfer)
                clearDragState()
                onDropTargetChange(null)
                if (itemIds.length > 0) {
                  onMoveItems(itemIds, { type: 'collection', collectionId: folder.id })
                  return
                }
                const sourceFolderId = readKuskusFolderDrag(event.dataTransfer)
                if (sourceFolderId && sourceFolderId !== folder.id) {
                  onMoveFolder(sourceFolderId, folder.id)
                }
              }}
            />
          }
        >
          {hasChildren ? (
            <button
              type="button"
              className="ml-1 flex size-6 shrink-0 items-center justify-center text-inherit outline-hidden hover:text-sidebar-accent-foreground [&_svg]:size-4"
              aria-controls={childListId}
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${folder.name}`}
              title={`${expanded ? 'Collapse' : 'Expand'} ${folder.name}`}
              onClick={() => onToggle(folder.id)}
            >
              <span
                className={cn(
                  'flex items-center justify-center transition-transform duration-150 ease-out motion-reduce:transition-none',
                  expanded && 'rotate-90'
                )}
              >
                <IconChevronRight aria-hidden="true" />
              </span>
            </button>
          ) : (
            <span className="ml-1 size-6 shrink-0" aria-hidden="true" />
          )}
          <SidebarMenuButton
            className="h-8 w-auto min-w-0 flex-1 rounded-none bg-transparent px-0 pr-8 text-inherit hover:bg-transparent hover:text-inherit focus-visible:ring-0 active:bg-transparent active:text-inherit has-[>svg:first-child]:pl-0! data-active:bg-transparent data-active:text-inherit"
            isActive={selectedId === folder.id}
            onClick={() => onSelect(folder.id)}
          >
            <CollectionIcon icon={folder.icon} aria-hidden="true" />
            <span>{folder.name}</span>
          </SidebarMenuButton>
          <SidebarMenuBadge className="font-mono font-normal text-sidebar-foreground/60 opacity-100 transition-opacity [transition-duration:var(--motion-duration-tooltip)] [transition-timing-function:var(--motion-ease-out)] group-hover/folder-row:opacity-0 group-has-[:focus-visible]/folder-row:opacity-0 motion-reduce:transition-none">
            {counts.get(folder.id) ?? 0}
          </SidebarMenuBadge>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuAction
                  aria-label={`Manage ${folder.name}`}
                  title={`Manage ${folder.name}`}
                  className="opacity-0 transition-opacity [transition-duration:var(--motion-duration-tooltip)] [transition-timing-function:var(--motion-ease-out)] group-hover/folder-row:opacity-100 group-has-[:focus-visible]/folder-row:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none"
                />
              }
            >
              <IconDots aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44" side="right" sideOffset={6}>
              <FolderDropdownActions folder={folder} {...actionHandlers} />
            </DropdownMenuContent>
          </DropdownMenu>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-44">
          <FolderContextActions folder={folder} {...actionHandlers} />
        </ContextMenuContent>
      </ContextMenu>
      {expanded ? (
        <SidebarMenuSub
          id={childListId}
          className="m-0 w-full translate-x-0 gap-0.5 border-l-0 px-0 py-0"
        >
          {children.map((child) => (
            <FolderTreeItem
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              collapsedIds={collapsedIds}
              selectedId={selectedId}
              activeDropTarget={activeDropTarget}
              counts={counts}
              onToggle={onToggle}
              onSelect={onSelect}
              onDropTargetChange={onDropTargetChange}
              onDropTargetLeave={onDropTargetLeave}
              onMoveItems={onMoveItems}
              onMoveFolder={onMoveFolder}
              onRequestMoveFolder={onRequestMoveFolder}
              onAddSubfolder={onAddSubfolder}
              onChangeIcon={onChangeIcon}
              onRename={onRename}
              onRemove={onRemove}
            />
          ))}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  )
}

export function LibrarySidebar({
  library,
  theme,
  onThemeChange,
  view,
  onViewChange,
  showReferencedAttachments,
  onShowReferencedAttachmentsChange,
  destination,
  onDestinationChange,
  onLibraryChange,
  onMoveItems,
  onError,
  onStatus,
  librarySwitchBlocked,
  globalCaptureShortcutStatus
}: {
  library: LibraryDto
  theme: Theme
  onThemeChange: (theme: Theme) => void
  view: LibraryView
  onViewChange: (view: LibraryView) => void
  showReferencedAttachments: boolean
  onShowReferencedAttachmentsChange: (show: boolean) => void
  destination: LibraryDestination
  onDestinationChange: (destination: LibraryDestination) => void
  onLibraryChange: (library: LibraryDto) => void
  onMoveItems: (itemIds: string[], destination: ActiveItemLocation) => void
  onError: (message: string) => void
  onStatus: (message: string) => void
  librarySwitchBlocked: boolean
  globalCaptureShortcutStatus: GlobalCaptureShortcutStatus | null
}): React.JSX.Element {
  const [folderDialog, setFolderDialog] = useState<FolderDialogState>(null)
  const [folderName, setFolderName] = useState('')
  const [folderOperationBusy, setFolderOperationBusy] = useState(false)
  const [creatingLibrary, setCreatingLibrary] = useState(false)
  const [newLibraryName, setNewLibraryName] = useState('')
  const [libraryOperationBusy, setLibraryOperationBusy] = useState(false)
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null)
  const [iconPickerFolderId, setIconPickerFolderId] = useState<string | null>(null)
  const [folderToMoveId, setFolderToMoveId] = useState<string | null>(null)
  const [inboxDropActive, setInboxDropActive] = useState(false)
  const [activeFolderDropTarget, setActiveFolderDropTarget] = useState<FolderDropTarget>(null)
  const [storedCollapsedFolderIds, setStoredCollapsedFolderIds] = useState(() =>
    loadCollapsedFolderIds(library)
  )
  const folderTree = useMemo(() => buildFolderTree(library.collections), [library.collections])
  const selectedFolderId = destination.type === 'collection' ? destination.collectionId : null
  const collapsedFolderIds = useMemo(() => {
    const collapsedIds = sanitizeCollapsedFolderIds(library.collections, storedCollapsedFolderIds)
    if (selectedFolderId) {
      for (const ancestorId of getFolderAncestorIds(library.collections, selectedFolderId)) {
        collapsedIds.delete(ancestorId)
      }
    }
    return collapsedIds
  }, [library.collections, selectedFolderId, storedCollapsedFolderIds])

  useEffect(() => {
    saveCollapsedFolderIds(library.id, collapsedFolderIds)
  }, [collapsedFolderIds, library.id])

  useEffect(() => {
    const clearDropTargets = (): void => {
      setInboxDropActive(false)
      setActiveFolderDropTarget(null)
    }
    window.addEventListener('dragend', clearDropTargets)
    window.addEventListener('drop', clearDropTargets)
    return () => {
      window.removeEventListener('dragend', clearDropTargets)
      window.removeEventListener('drop', clearDropTargets)
    }
  }, [])

  const leaveFolderDropTarget = (target: Exclude<FolderDropTarget, null>): void => {
    setActiveFolderDropTarget((current) => {
      if (current?.type !== target.type) return current
      if (current.type === 'folder' && target.type === 'folder' && current.id !== target.id) {
        return current
      }
      return null
    })
  }

  const setFolderCollapsed = (folderId: string, collapsed: boolean): void => {
    setStoredCollapsedFolderIds((current) => {
      const collapsedIds = sanitizeCollapsedFolderIds(library.collections, current)
      if (collapsed) collapsedIds.add(folderId)
      else collapsedIds.delete(folderId)
      return collapsedIds
    })
  }

  const selectFolder = (folderId: string): void => {
    const ancestorIds = getFolderAncestorIds(library.collections, folderId)
    setStoredCollapsedFolderIds((current) => {
      const collapsedIds = sanitizeCollapsedFolderIds(library.collections, current)
      for (const ancestorId of ancestorIds) collapsedIds.delete(ancestorId)
      return collapsedIds
    })
    onDestinationChange({ type: 'collection', collectionId: folderId })
  }

  const toggleFolder = (folderId: string): void => {
    const willCollapse = !collapsedFolderIds.has(folderId)
    if (
      willCollapse &&
      selectedFolderId !== null &&
      getFolderAncestorIds(library.collections, selectedFolderId).includes(folderId)
    ) {
      onDestinationChange({ type: 'collection', collectionId: folderId })
    }
    setFolderCollapsed(folderId, willCollapse)
  }

  const createFolder = async (name: string, parentId: string | null): Promise<void> => {
    const result = await window.kuskus.createCollection({
      name,
      parentId
    })
    if (!result.ok) return onError(result.error)
    onLibraryChange({ ...library, collections: [...library.collections, result.data] })
    if (parentId !== null) setFolderCollapsed(parentId, false)
    setFolderName('')
    setFolderDialog(null)
  }
  const renameFolder = async (id: string, name: string): Promise<void> => {
    const result = await window.kuskus.renameCollection(id, name)
    if (!result.ok) return onError(result.error)
    onLibraryChange({
      ...library,
      collections: library.collections.map((folder) => (folder.id === id ? result.data : folder))
    })
    setFolderName('')
    setFolderDialog(null)
  }
  const submitFolderName = async (name: string): Promise<void> => {
    if (!folderDialog || folderOperationBusy) return
    setFolderOperationBusy(true)
    try {
      if (folderDialog.type === 'create') {
        await createFolder(name, folderDialog.parentId)
      } else {
        await renameFolder(folderDialog.id, name)
      }
    } finally {
      setFolderOperationBusy(false)
    }
  }
  const closeFolderDialog = (): void => {
    if (folderOperationBusy) return
    setFolderDialog(null)
    setFolderName('')
  }
  const deleteFolder = (id: string, name: string): void => {
    setFolderToDelete({ id, name })
  }
  const changeFolderIcon = async (id: string, icon: CollectionIconKey): Promise<void> => {
    if (folderOperationBusy) return
    setFolderOperationBusy(true)
    try {
      const result = await window.kuskus.setCollectionIcon(id, icon)
      if (!result.ok) return onError(result.error)
      onLibraryChange({
        ...library,
        collections: library.collections.map((folder) => (folder.id === id ? result.data : folder))
      })
      setIconPickerFolderId(null)
    } finally {
      setFolderOperationBusy(false)
    }
  }
  const moveFolder = async (id: string, parentId: string | null): Promise<void> => {
    if (folderOperationBusy) return
    setFolderOperationBusy(true)
    try {
      const result = await window.kuskus.moveCollection({ collectionId: id, parentId })
      if (!result.ok) return onError(result.error)
      onLibraryChange(result.data)
      if (parentId !== null) setFolderCollapsed(parentId, false)
      setFolderToMoveId(null)
    } finally {
      setFolderOperationBusy(false)
    }
  }
  const confirmFolderRemoval = async (): Promise<void> => {
    if (!folderToDelete || folderOperationBusy) return
    const { id, name } = folderToDelete
    setFolderOperationBusy(true)
    try {
      const result = await window.kuskus.deleteCollection(id)
      if (!result.ok) return onError(result.error)
      onLibraryChange(result.data)
      if (destination.type === 'collection' && destination.collectionId === id) {
        onDestinationChange({ type: 'inbox' })
      }
      setFolderToDelete(null)
      notifyCollectionRemoved(name)
    } finally {
      setFolderOperationBusy(false)
    }
  }
  const openAnotherLibrary = async (): Promise<void> => {
    if (librarySwitchBlocked || libraryOperationBusy) return
    setLibraryOperationBusy(true)
    const result = await window.kuskus.open()
    setLibraryOperationBusy(false)
    if (!result.ok) {
      if (result.code !== 'cancelled') onError(result.error)
      return
    }
    window.location.reload()
  }
  const createLibrary = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!newLibraryName.trim() || librarySwitchBlocked || libraryOperationBusy) return
    setLibraryOperationBusy(true)
    const result = await window.kuskus.create(newLibraryName)
    setLibraryOperationBusy(false)
    if (!result.ok) {
      if (result.code !== 'cancelled') onError(result.error)
      return
    }
    window.location.reload()
  }
  const copyLibraryPath = async (): Promise<void> => {
    const result = await window.kuskus.copyLibraryPath()
    if (!result.ok) return onError(result.error)
    onStatus('Library path copied.')
  }
  const locationCounts = useMemo(() => {
    let inbox = 0
    let active = 0
    let archive = 0
    let trash = 0

    for (const item of library.items) {
      if (item.location.type === 'inbox') {
        inbox += 1
        active += 1
      } else if (item.location.type === 'collection') {
        active += 1
      } else if (item.location.type === 'archive') {
        archive += 1
      } else {
        trash += 1
      }
    }

    return { inbox, active, archive, trash }
  }, [library.items])

  const collectionSubtreeCounts = useMemo(
    () =>
      buildFolderSubtreeCounts(
        library.collections,
        library.items.flatMap((item) =>
          item.location.type === 'collection' ? [item.location.collectionId] : []
        )
      ),
    [library.collections, library.items]
  )

  const folderRemovalSummary = useMemo(() => {
    if (!folderToDelete) return null
    const subfolderCount = library.collections.filter(
      (folder) => folder.parentId === folderToDelete.id
    ).length
    const itemCount = library.items.filter(
      (item) =>
        item.location.type === 'collection' && item.location.collectionId === folderToDelete.id
    ).length
    return { subfolderCount, itemCount }
  }, [folderToDelete, library.collections, library.items])

  const iconPickerFolder = iconPickerFolderId
    ? (library.collections.find((folder) => folder.id === iconPickerFolderId) ?? null)
    : null

  return (
    <>
      <AppSidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu aria-label="Library navigation">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={destination.type === 'inbox'}
                    className={cn(
                      inboxDropActive &&
                        'bg-sidebar-accent text-sidebar-accent-foreground ring-2 ring-sidebar-ring'
                    )}
                    onClick={() => onDestinationChange({ type: 'inbox' })}
                    onDragEnter={(event) => {
                      if (!hasKuskusItemDrag(event.dataTransfer)) return
                      event.preventDefault()
                      setInboxDropActive(true)
                    }}
                    onDragOver={(event) => {
                      if (!hasKuskusItemDrag(event.dataTransfer)) return
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                    }}
                    onDragLeave={(event) => {
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                      setInboxDropActive(false)
                    }}
                    onDrop={(event) => {
                      if (!hasKuskusItemDrag(event.dataTransfer)) return
                      event.preventDefault()
                      const itemIds = readKuskusItemDrag(event.dataTransfer)
                      setInboxDropActive(false)
                      if (itemIds.length > 0) onMoveItems(itemIds, { type: 'inbox' })
                    }}
                  >
                    <IconInbox aria-hidden="true" />
                    <span>Inbox</span>
                    <span className="ml-auto font-mono text-xs tabular-nums text-sidebar-foreground/60">
                      {locationCounts.inbox}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={destination.type === 'all'}
                    onClick={() => onDestinationChange({ type: 'all' })}
                  >
                    <IconLibrary aria-hidden="true" />
                    <span>All Items</span>
                    <span className="ml-auto font-mono text-xs tabular-nums text-sidebar-foreground/60">
                      {locationCounts.active}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="group/folder-group">
            <SidebarGroupLabel
              className={cn(
                'rounded-xl transition-[background-color,color,box-shadow] [transition-duration:var(--motion-duration-tooltip)] [transition-timing-function:var(--motion-ease-out)] motion-reduce:transition-none',
                activeFolderDropTarget?.type === 'root' &&
                  'bg-sidebar-accent/60 text-sidebar-accent-foreground ring-2 ring-sidebar-ring'
              )}
              onDragEnter={(event) => {
                if (!hasKuskusFolderDrag(event.dataTransfer)) return
                event.preventDefault()
                setActiveFolderDropTarget({ type: 'root' })
              }}
              onDragOver={(event) => {
                if (!hasKuskusFolderDrag(event.dataTransfer)) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                leaveFolderDropTarget({ type: 'root' })
              }}
              onDrop={(event) => {
                if (!hasKuskusFolderDrag(event.dataTransfer)) return
                event.preventDefault()
                event.stopPropagation()
                const folderId = readKuskusFolderDrag(event.dataTransfer)
                setActiveFolderDropTarget(null)
                if (folderId) void moveFolder(folderId, null)
              }}
            >
              Folders
            </SidebarGroupLabel>
            <SidebarGroupAction
              aria-label="Add folder"
              title="Add folder"
              className="opacity-0 transition-opacity [transition-duration:var(--motion-duration-tooltip)] [transition-timing-function:var(--motion-ease-out)] group-focus-within/folder-group:opacity-100 group-hover/folder-group:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none"
              onClick={() => {
                setFolderName('')
                setFolderDialog({ type: 'create', parentId: null })
              }}
            >
              <IconPlus aria-hidden="true" />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <FolderTree
                nodes={folderTree}
                collapsedIds={collapsedFolderIds}
                selectedId={selectedFolderId}
                activeDropTarget={activeFolderDropTarget}
                counts={collectionSubtreeCounts}
                onToggle={toggleFolder}
                onSelect={selectFolder}
                onDropTargetChange={setActiveFolderDropTarget}
                onDropTargetLeave={leaveFolderDropTarget}
                onMoveItems={onMoveItems}
                onMoveFolder={(folderId, parentId) => void moveFolder(folderId, parentId)}
                onRequestMoveFolder={setFolderToMoveId}
                onAddSubfolder={(parentId) => {
                  setFolderName('')
                  setFolderDialog({ type: 'create', parentId })
                }}
                onChangeIcon={(id) => setIconPickerFolderId(id)}
                onRename={(id, name) => {
                  setFolderName(name)
                  setFolderDialog({ type: 'rename', id })
                }}
                onRemove={deleteFolder}
              />
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu aria-label="Item lifecycle">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={destination.type === 'archive'}
                    onClick={() => onDestinationChange({ type: 'archive' })}
                  >
                    <IconArchive aria-hidden="true" />
                    <span>Archive</span>
                    <span className="ml-auto font-mono text-xs tabular-nums text-sidebar-foreground/60">
                      {locationCounts.archive}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={destination.type === 'trash'}
                    onClick={() => onDestinationChange({ type: 'trash' })}
                  >
                    <IconTrash aria-hidden="true" />
                    <span>Trash</span>
                    <span className="ml-auto font-mono text-xs tabular-nums text-sidebar-foreground/60">
                      {locationCounts.trash}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="[-webkit-app-region:no-drag]">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger render={<SidebarMenuButton aria-label="Open Settings" />}>
                  <IconSettings aria-hidden="true" />
                  <span>Settings</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56" side="right" sideOffset={8}>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>View</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={view}
                      onValueChange={(value) => onViewChange(value as LibraryView)}
                    >
                      {VIEW_OPTIONS.map((option) => {
                        const Icon = option.icon
                        return (
                          <DropdownMenuRadioItem key={option.value} value={option.value}>
                            <Icon aria-hidden="true" />
                            {option.label}
                          </DropdownMenuRadioItem>
                        )
                      })}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Capture</DropdownMenuLabel>
                    <div className="flex min-h-9 items-center gap-2 px-2 py-1.5 text-sm">
                      <IconKeyboard
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>Global capture</span>
                      <Badge
                        className="ml-auto"
                        variant={
                          globalCaptureShortcutStatus === null ||
                          globalCaptureShortcutStatus.registered
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {globalCaptureShortcutStatus === null
                          ? 'Checking'
                          : globalCaptureShortcutStatus.registered
                            ? 'Available'
                            : 'Unavailable'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-2 pb-1.5 text-xs text-muted-foreground">
                      <span>Summon New item in Inbox</span>
                      <Kbd>{globalCaptureShortcutStatus?.accelerator ?? 'Ctrl+Shift+Space'}</Kbd>
                    </div>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Vault files</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                      checked={showReferencedAttachments}
                      onCheckedChange={onShowReferencedAttachmentsChange}
                    >
                      Show referenced attachments
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={theme}
                      onValueChange={(value) => onThemeChange(value as Theme)}
                    >
                      <DropdownMenuRadioItem value="light">
                        <IconSun aria-hidden="true" />
                        Light
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="dark">
                        <IconMoon aria-hidden="true" />
                        Dark
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem disabled value="system">
                        <IconDeviceDesktop aria-hidden="true" />
                        System
                        <span className="ml-auto text-xs text-muted-foreground">Coming soon</span>
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuItem disabled>
                      <IconPalette aria-hidden="true" />
                      Accent color
                      <span className="ml-auto text-xs text-muted-foreground">Coming soon</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                      <IconTypography aria-hidden="true" />
                      Font
                      <span className="ml-auto text-xs text-muted-foreground">Coming soon</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarSeparator className="mx-1" />
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      aria-label={`Library actions for ${library.name}`}
                      title={library.path}
                    />
                  }
                >
                  <IconFolder aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{library.name}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64" side="right" sideOffset={8}>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="min-w-0">
                      <span className="block truncate font-medium text-foreground">
                        {library.name}
                      </span>
                      <span className="block truncate" title={library.path}>
                        {library.path}
                      </span>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      disabled={librarySwitchBlocked || libraryOperationBusy}
                      onClick={() => void openAnotherLibrary()}
                    >
                      <IconFolderOpen aria-hidden="true" />
                      Open Another Library…
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={librarySwitchBlocked || libraryOperationBusy}
                      onClick={() => setCreatingLibrary(true)}
                    >
                      <IconPlus aria-hidden="true" />
                      Create New Library…
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void copyLibraryPath()}>
                      <IconCopy aria-hidden="true" />
                      Copy Library Path
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  {librarySwitchBlocked && (
                    <DropdownMenuLabel className="text-pretty">
                      Finish or remove the current save or image import before switching libraries.
                    </DropdownMenuLabel>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </AppSidebar>
      <FolderNameDialog
        open={folderDialog !== null}
        mode={
          folderDialog?.type === 'create'
            ? {
                type: 'create',
                ...(folderDialog.parentId
                  ? {
                      parentName: library.collections.find(
                        (folder) => folder.id === folderDialog.parentId
                      )?.name
                    }
                  : {})
              }
            : folderDialog
        }
        name={folderName}
        busy={folderOperationBusy}
        onOpenChange={(open) => {
          if (!open) closeFolderDialog()
        }}
        onNameChange={setFolderName}
        onSubmit={(name) => void submitFolderName(name)}
      />
      {iconPickerFolder && (
        <FolderIconPickerDialog
          open
          value={iconPickerFolder.icon}
          disabled={folderOperationBusy}
          onOpenChange={(open) => {
            if (!open && !folderOperationBusy) setIconPickerFolderId(null)
          }}
          onSelect={(icon) => void changeFolderIcon(iconPickerFolder.id, icon)}
        />
      )}
      <FolderMoveDialog
        folder={
          folderToMoveId
            ? (library.collections.find((folder) => folder.id === folderToMoveId) ?? null)
            : null
        }
        collections={library.collections}
        busy={folderOperationBusy}
        onOpenChange={(open) => {
          if (!open && !folderOperationBusy) setFolderToMoveId(null)
        }}
        onMove={(parentId) => {
          if (folderToMoveId) void moveFolder(folderToMoveId, parentId)
        }}
      />
      <Dialog
        open={creatingLibrary}
        onOpenChange={(open) => {
          if (libraryOperationBusy) return
          setCreatingLibrary(open)
          if (!open) setNewLibraryName('')
        }}
      >
        <DialogContent>
          <form className="grid gap-4" onSubmit={(event) => void createLibrary(event)}>
            <DialogHeader>
              <DialogTitle>Create New Library</DialogTitle>
              <DialogDescription>
                Choose a name, then select where Kuskus should create its local folder.
              </DialogDescription>
            </DialogHeader>
            <Input
              autoFocus
              aria-label="Library name"
              autoComplete="off"
              name="libraryName"
              maxLength={80}
              placeholder="My Kuskus Library"
              value={newLibraryName}
              disabled={libraryOperationBusy}
              onChange={(event) => setNewLibraryName(event.target.value)}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={libraryOperationBusy}
                onClick={() => setCreatingLibrary(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!newLibraryName.trim() || libraryOperationBusy}>
                {libraryOperationBusy ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <IconPlus data-icon="inline-start" aria-hidden="true" />
                )}
                {libraryOperationBusy ? 'Creating…' : 'Create Library'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={folderToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !folderOperationBusy) setFolderToDelete(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {folderRemovalSummary && folderRemovalSummary.subfolderCount > 0
                ? `“${folderToDelete?.name}” can’t be removed yet`
                : `Remove “${folderToDelete?.name}”?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {folderRemovalSummary
                ? (() => {
                    const { subfolderCount, itemCount } = folderRemovalSummary
                    if (subfolderCount > 0) {
                      return `It contains ${subfolderCount} ${
                        subfolderCount === 1 ? 'subfolder' : 'subfolders'
                      }. Move or remove ${
                        subfolderCount === 1 ? 'it' : 'them'
                      } first. Its items stay where they are.`
                    }
                    return itemCount === 0
                      ? 'The empty folder will be removed.'
                      : `${itemCount} ${itemCount === 1 ? 'item' : 'items'} will be moved to Inbox before the folder is removed.`
                  })()
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={folderOperationBusy}>Cancel</AlertDialogCancel>
            {folderRemovalSummary !== null && folderRemovalSummary.subfolderCount === 0 && (
              <AlertDialogAction
                disabled={folderOperationBusy}
                onClick={() => void confirmFolderRemoval()}
              >
                Remove folder
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
