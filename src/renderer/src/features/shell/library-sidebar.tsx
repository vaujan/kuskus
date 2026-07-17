import {
  IconCheck,
  IconCopy,
  IconDots,
  IconFolder,
  IconFolderOpen,
  IconIcons,
  IconInbox,
  IconMoon,
  IconPencil,
  IconPlus,
  IconSun,
  IconTag,
  IconTrash,
  IconX
} from '@tabler/icons-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { CollectionIcon } from '@/features/collections/collection-icons'
import { FolderIconPickerDialog } from '@/features/collections/folder-icon-picker-dialog'
import type { Theme } from '@/hooks/use-theme'
import type { CollectionIconKey, LibraryDto } from '../../../../shared/library-contract'

type IconPickerTarget = { type: 'new' } | { type: 'folder'; id: string } | null

export function LibrarySidebar({
  library,
  theme,
  onToggleTheme,
  onLibraryChange,
  onError,
  onStatus,
  librarySwitchBlocked
}: {
  library: LibraryDto
  theme: Theme
  onToggleTheme: () => void
  onLibraryChange: (library: LibraryDto) => void
  onError: (message: string) => void
  onStatus: (message: string) => void
  librarySwitchBlocked: boolean
}): React.JSX.Element {
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderIcon, setNewFolderIcon] = useState<CollectionIconKey>('folder')
  const [addingFolder, setAddingFolder] = useState(false)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [creatingLibrary, setCreatingLibrary] = useState(false)
  const [newLibraryName, setNewLibraryName] = useState('')
  const [libraryOperationBusy, setLibraryOperationBusy] = useState(false)
  const [iconPickerTarget, setIconPickerTarget] = useState<IconPickerTarget>(null)
  const [iconUpdateBusy, setIconUpdateBusy] = useState(false)
  const sorted = (folders: LibraryDto['collections']): LibraryDto['collections'] =>
    [...folders].sort((a, b) => a.name.localeCompare(b.name))

  const createFolder = async (): Promise<void> => {
    const result = await window.kuskus.createCollection({
      name: newFolderName,
      ...(newFolderIcon === 'folder' ? {} : { icon: newFolderIcon })
    })
    if (!result.ok) return onError(result.error)
    onLibraryChange({ ...library, collections: sorted([...library.collections, result.data]) })
    setNewFolderName('')
    setNewFolderIcon('folder')
    setAddingFolder(false)
  }
  const cancelFolderCreation = (): void => {
    setNewFolderName('')
    setNewFolderIcon('folder')
    setAddingFolder(false)
  }
  const cancelFolderRename = (): void => {
    setEditingFolderName('')
    setEditingFolderId(null)
  }
  const renameFolder = async (id: string): Promise<void> => {
    const result = await window.kuskus.renameCollection(id, editingFolderName)
    if (!result.ok) return onError(result.error)
    onLibraryChange({
      ...library,
      collections: sorted(
        library.collections.map((folder) => (folder.id === id ? result.data : folder))
      )
    })
    setEditingFolderId(null)
  }
  const deleteFolder = async (id: string, name: string): Promise<void> => {
    if (!window.confirm(`Remove “${name}”? This only removes an empty folder.`)) return
    const result = await window.kuskus.deleteCollection(id)
    if (!result.ok) return onError(result.error)
    onLibraryChange({
      ...library,
      collections: library.collections.filter((folder) => folder.id !== id)
    })
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

  return (
    <>
      <AppSidebar collapsible="offcanvas">
        <SidebarHeader className="[-webkit-app-region:no-drag]">
          <SidebarMenu>
            <SidebarMenuItem>
              <div
                className="flex h-8 min-w-0 items-center gap-2 rounded-[calc(var(--radius-sm)+2px)] p-2 pr-8 text-xs font-medium"
                title={library.path}
              >
                <IconFolder className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{library.name}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuAction aria-label="Library actions" title="Library actions" />
                  }
                >
                  <IconDots aria-hidden="true" />
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
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu aria-label="Library navigation">
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>
                    <IconInbox aria-hidden="true" />
                    <span>Inbox</span>
                    <span className="ml-auto font-mono text-xs tabular-nums text-sidebar-foreground/60">
                      {library.items.length}
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
              onClick={() => setAddingFolder(true)}
            >
              <IconPlus aria-hidden="true" />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu aria-label="Folders">
                {library.collections.map((folder) => {
                  return (
                    <SidebarMenuItem key={folder.id}>
                      {editingFolderId === folder.id ? (
                        <form
                          className="flex h-8 items-center gap-1 px-1"
                          onSubmit={(event) => {
                            event.preventDefault()
                            void renameFolder(folder.id)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.preventDefault()
                              cancelFolderRename()
                            }
                          }}
                        >
                          <div className="relative min-w-0 flex-1">
                            <Input
                              aria-label={`Rename ${folder.name}`}
                              className="h-8 pr-14 text-sm"
                              autoFocus
                              value={editingFolderName}
                              onChange={(event) => setEditingFolderName(event.target.value)}
                            />
                            <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5">
                              <Button
                                size="icon-xs"
                                type="button"
                                variant="ghost"
                                aria-label="Cancel renaming folder"
                                title="Cancel"
                                onClick={cancelFolderRename}
                              >
                                <IconX aria-hidden="true" />
                              </Button>
                              <Button
                                size="icon-xs"
                                type="submit"
                                aria-label="Save folder name"
                                title="Save folder name"
                              >
                                <IconCheck aria-hidden="true" />
                              </Button>
                            </div>
                          </div>
                        </form>
                      ) : (
                        <>
                          <SidebarMenuButton>
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
                                    setEditingFolderId(folder.id)
                                    setEditingFolderName(folder.name)
                                  }}
                                >
                                  <IconPencil data-icon="inline-start" aria-hidden="true" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setIconPickerTarget({ type: 'folder', id: folder.id })
                                  }
                                >
                                  <IconIcons data-icon="inline-start" aria-hidden="true" />
                                  Change icon
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => void deleteFolder(folder.id, folder.name)}
                                >
                                  <IconTrash aria-hidden="true" />
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </SidebarMenuItem>
                  )
                })}
                {addingFolder && (
                  <SidebarMenuItem>
                    <form
                      className="flex h-8 items-center gap-1 px-1"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void createFolder()
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          cancelFolderCreation()
                        }
                      }}
                    >
                      <Button
                        size="icon"
                        type="button"
                        variant="ghost"
                        aria-label="Choose folder icon"
                        title="Choose folder icon"
                        onClick={() => setIconPickerTarget({ type: 'new' })}
                      >
                        <CollectionIcon icon={newFolderIcon} aria-hidden="true" />
                      </Button>
                      <div className="relative min-w-0 flex-1">
                        <Input
                          aria-label="Folder name"
                          className="h-8 pr-14 text-sm"
                          autoFocus
                          placeholder="Folder name"
                          value={newFolderName}
                          onChange={(event) => setNewFolderName(event.target.value)}
                        />
                        <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5">
                          <Button
                            size="icon-xs"
                            type="button"
                            variant="ghost"
                            aria-label="Cancel adding folder"
                            title="Cancel"
                            onClick={cancelFolderCreation}
                          >
                            <IconX aria-hidden="true" />
                          </Button>
                          <Button
                            size="icon-xs"
                            type="submit"
                            aria-label="Add folder"
                            title="Add folder"
                          >
                            <IconCheck aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </form>
                  </SidebarMenuItem>
                )}
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
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={onToggleTheme}>
                {theme === 'dark' ? (
                  <IconSun aria-hidden="true" />
                ) : (
                  <IconMoon aria-hidden="true" />
                )}
                <span>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </AppSidebar>
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
    </>
  )
}
