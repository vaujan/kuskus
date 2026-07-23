import {
  IconArchive,
  IconCopy,
  IconDeviceDesktop,
  IconDots,
  IconFolder,
  IconFolderOpen,
  IconIcons,
  IconInbox,
  IconLibrary,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconMoon,
  IconPalette,
  IconPencil,
  IconPlus,
  IconSettings,
  IconSun,
  IconTable,
  IconTag,
  IconTrash,
  IconTypography,
  type TablerIcon
} from '@tabler/icons-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator
} from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { CollectionIcon } from '@/features/collections/collection-icons'
import { FolderIconPickerDialog } from '@/features/collections/folder-icon-picker-dialog'
import { FolderNameDialog } from '@/features/collections/folder-name-dialog'
import type { LibraryView } from '@/features/items/item-view'
import type { Theme } from '@/hooks/use-theme'
import type { CollectionIconKey, LibraryDto } from '../../../../shared/library-contract'
import { toast } from 'sonner'

type IconPickerTarget = { type: 'new' } | { type: 'folder'; id: string } | null
type FolderDialogState = { type: 'create' } | { type: 'rename'; id: string } | null
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

export function LibrarySidebar({
  library,
  theme,
  onThemeChange,
  view,
  onViewChange,
  destination,
  onDestinationChange,
  onLibraryChange,
  onError,
  onStatus,
  librarySwitchBlocked
}: {
  library: LibraryDto
  theme: Theme
  onThemeChange: (theme: Theme) => void
  view: LibraryView
  onViewChange: (view: LibraryView) => void
  destination: LibraryDestination
  onDestinationChange: (destination: LibraryDestination) => void
  onLibraryChange: (library: LibraryDto) => void
  onError: (message: string) => void
  onStatus: (message: string) => void
  librarySwitchBlocked: boolean
}): React.JSX.Element {
  const [newFolderIcon, setNewFolderIcon] = useState<CollectionIconKey>('folder')
  const [folderDialog, setFolderDialog] = useState<FolderDialogState>(null)
  const [folderName, setFolderName] = useState('')
  const [folderOperationBusy, setFolderOperationBusy] = useState(false)
  const [creatingLibrary, setCreatingLibrary] = useState(false)
  const [newLibraryName, setNewLibraryName] = useState('')
  const [libraryOperationBusy, setLibraryOperationBusy] = useState(false)
  const [iconPickerTarget, setIconPickerTarget] = useState<IconPickerTarget>(null)
  const [iconUpdateBusy, setIconUpdateBusy] = useState(false)
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null)
  const sorted = (folders: LibraryDto['collections']): LibraryDto['collections'] =>
    [...folders].sort((a, b) => a.name.localeCompare(b.name))

  const createFolder = async (name: string): Promise<void> => {
    const result = await window.kuskus.createCollection({
      name,
      ...(newFolderIcon === 'folder' ? {} : { icon: newFolderIcon })
    })
    if (!result.ok) return onError(result.error)
    onLibraryChange({ ...library, collections: sorted([...library.collections, result.data]) })
    setNewFolderIcon('folder')
    setFolderName('')
    setFolderDialog(null)
  }
  const renameFolder = async (id: string, name: string): Promise<void> => {
    const result = await window.kuskus.renameCollection(id, name)
    if (!result.ok) return onError(result.error)
    onLibraryChange({
      ...library,
      collections: sorted(
        library.collections.map((folder) => (folder.id === id ? result.data : folder))
      )
    })
    setFolderName('')
    setFolderDialog(null)
  }
  const submitFolderName = async (name: string): Promise<void> => {
    if (!folderDialog || folderOperationBusy) return
    setFolderOperationBusy(true)
    try {
      if (folderDialog.type === 'create') {
        await createFolder(name)
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
    setNewFolderIcon('folder')
    if (iconPickerTarget?.type === 'new') setIconPickerTarget(null)
  }
  const deleteFolder = (id: string, name: string): void => {
    setFolderToDelete({ id, name })
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
      toast.success(`Removed “${name}”`, {
        description: 'Its items were moved to Inbox.'
      })
    } finally {
      setFolderOperationBusy(false)
    }
  }
  const selectFolderIcon = async (icon: CollectionIconKey): Promise<void> => {
    if (!iconPickerTarget || iconUpdateBusy) return
    if (iconPickerTarget.type === 'new') {
      setNewFolderIcon(icon)
      setIconPickerTarget(null)
      return
    }

    setIconUpdateBusy(true)
    const result = await window.kuskus.setCollectionIcon(iconPickerTarget.id, icon)
    setIconUpdateBusy(false)
    if (!result.ok) return onError(result.error)
    onLibraryChange({
      ...library,
      collections: library.collections.map((folder) =>
        folder.id === iconPickerTarget.id ? result.data : folder
      )
    })
    setIconPickerTarget(null)
  }
  const selectedPickerIcon =
    iconPickerTarget?.type === 'folder'
      ? (library.collections.find((folder) => folder.id === iconPickerTarget.id)?.icon ?? 'folder')
      : newFolderIcon
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
  const inboxCount = library.items.filter((item) => item.location.type === 'inbox').length
  const activeCount = library.items.filter(
    (item) => item.location.type === 'inbox' || item.location.type === 'collection'
  ).length
  const archiveCount = library.items.filter((item) => item.location.type === 'archive').length
  const trashCount = library.items.filter((item) => item.location.type === 'trash').length

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
                    onClick={() => onDestinationChange({ type: 'inbox' })}
                  >
                    <IconInbox aria-hidden="true" />
                    <span>Inbox</span>
                    <span className="ml-auto font-mono text-xs tabular-nums text-sidebar-foreground/60">
                      {inboxCount}
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
                      {activeCount}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="group/folder-group">
            <SidebarGroupLabel>Folders</SidebarGroupLabel>
            <SidebarGroupAction
              aria-label="Add folder"
              title="Add folder"
              className="opacity-0 transition-opacity group-focus-within/folder-group:opacity-100 group-hover/folder-group:opacity-100 focus-visible:opacity-100"
              onClick={() => {
                setFolderName('')
                setNewFolderIcon('folder')
                setFolderDialog({ type: 'create' })
              }}
            >
              <IconPlus aria-hidden="true" />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu aria-label="Folders">
                {library.collections.map((folder) => {
                  return (
                    <SidebarMenuItem key={folder.id}>
                      <SidebarMenuButton
                        isActive={
                          destination.type === 'collection' &&
                          destination.collectionId === folder.id
                        }
                        onClick={() =>
                          onDestinationChange({ type: 'collection', collectionId: folder.id })
                        }
                      >
                        <CollectionIcon icon={folder.icon} aria-hidden="true" />
                        <span>{folder.name}</span>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <SidebarMenuAction
                              showOnHover
                              aria-label={`Manage ${folder.name}`}
                              title={`Manage ${folder.name}`}
                            />
                          }
                        >
                          <IconDots aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-36"
                          side="right"
                          sideOffset={6}
                        >
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onClick={() => {
                                setFolderName(folder.name)
                                setFolderDialog({ type: 'rename', id: folder.id })
                              }}
                            >
                              <IconPencil data-icon="inline-start" aria-hidden="true" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setIconPickerTarget({ type: 'folder', id: folder.id })}
                            >
                              <IconIcons data-icon="inline-start" aria-hidden="true" />
                              Change icon
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteFolder(folder.id, folder.name)}
                            >
                              <IconTrash aria-hidden="true" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
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
                      {archiveCount}
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
                      {trashCount}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Tags</SidebarGroupLabel>
            <SidebarGroupContent>
              <p className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                <IconTag className="size-3.5" aria-hidden="true" />
                No tags yet
              </p>
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
                icon: newFolderIcon,
                onChooseIcon: () => setIconPickerTarget({ type: 'new' })
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
      <FolderIconPickerDialog
        open={iconPickerTarget !== null}
        value={selectedPickerIcon}
        disabled={iconUpdateBusy}
        onOpenChange={(open) => {
          if (!open && !iconUpdateBusy) setIconPickerTarget(null)
        }}
        onSelect={(icon) => void selectFolderIcon(icon)}
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
            <AlertDialogTitle>Remove “{folderToDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {folderToDelete
                ? (() => {
                    const count = library.items.filter(
                      (item) =>
                        item.location.type === 'collection' &&
                        item.location.collectionId === folderToDelete.id
                    ).length
                    return count === 0
                      ? 'The empty folder will be removed.'
                      : `${count} ${count === 1 ? 'item' : 'items'} will be moved to Inbox before the folder is removed.`
                  })()
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={folderOperationBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={folderOperationBusy}
              onClick={() => void confirmFolderRemoval()}
            >
              Remove folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
