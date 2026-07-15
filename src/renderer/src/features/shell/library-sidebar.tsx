import {
  Check,
  ChevronDown,
  Folder,
  Inbox,
  MoreHorizontal,
  Moon,
  Pencil,
  Plus,
  Sun,
  Tag,
  Trash2,
  UserRound,
  X
} from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import type { Theme } from '@/hooks/use-theme'
import type { LibraryDto } from '../../../../shared/library-contract'

export function LibrarySidebar({
  library,
  theme,
  onToggleTheme,
  onLibraryChange,
  onError
}: {
  library: LibraryDto
  theme: Theme
  onToggleTheme: () => void
  onLibraryChange: (library: LibraryDto) => void
  onError: (message: string) => void
}): React.JSX.Element {
  const [newFolderName, setNewFolderName] = useState('')
  const [addingFolder, setAddingFolder] = useState(false)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const sorted = (folders: LibraryDto['collections']): LibraryDto['collections'] =>
    [...folders].sort((a, b) => a.name.localeCompare(b.name))

  const createFolder = async (): Promise<void> => {
    const result = await window.kuskus.createCollection(newFolderName)
    if (!result.ok) return onError(result.error)
    onLibraryChange({ ...library, collections: sorted([...library.collections, result.data]) })
    setNewFolderName('')
    setAddingFolder(false)
  }
  const cancelFolderCreation = (): void => {
    setNewFolderName('')
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

  return (
    <AppSidebar collapsible="offcanvas">
      <SidebarHeader className="[-webkit-app-region:no-drag]">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<button className="flex min-h-11 w-full items-center gap-3 rounded-[calc(var(--radius-sm)+2px)] p-2 text-left outline-hidden transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label="Show local folder details" />}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[calc(var(--radius-sm)+2px)] bg-sidebar-primary text-sidebar-primary-foreground">
              <Folder className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{library.name}</span>
              <span className="block truncate text-xs text-muted-foreground">Local folder</span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72" side="right" sideOffset={8}>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Local folder</DropdownMenuLabel>
              <DropdownMenuItem disabled className="gap-3 py-2">
                  <Folder className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{library.name}</span>
                    <span
                      className="block truncate text-xs text-muted-foreground"
                      title={library.path}
                    >
                      {library.path}
                    </span>
                  </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu aria-label="Library navigation">
              <SidebarMenuItem>
                <SidebarMenuButton isActive>
                  <Inbox aria-hidden="true" />
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
            <Plus aria-hidden="true" />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu aria-label="Folders">
              {library.collections.map((folder) => (
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
                            <X aria-hidden="true" />
                          </Button>
                          <Button
                            size="icon-xs"
                            type="submit"
                            aria-label="Save folder name"
                            title="Save folder name"
                          >
                            <Check aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <>
                      <SidebarMenuButton>
                        <Folder aria-hidden="true" />
                        <span>{folder.name}</span>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<SidebarMenuAction
                          showOnHover
                          aria-label={`Manage ${folder.name}`}
                          title={`Manage ${folder.name}`}
                          />}
                        >
                          <MoreHorizontal aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36" side="right" sideOffset={6}>
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onClick={() => {
                                  setEditingFolderId(folder.id)
                                  setEditingFolderName(folder.name)
                                }}
                              >
                                <Pencil data-icon="inline-start" aria-hidden="true" />
                                Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void deleteFolder(folder.id, folder.name)}>
                              <Trash2 aria-hidden="true" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </SidebarMenuItem>
              ))}
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
                          <X aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon-xs"
                          type="submit"
                          aria-label="Add folder"
                          title="Add folder"
                        >
                          <Check aria-hidden="true" />
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
              <Tag className="size-3.5" aria-hidden="true" />
              No tags yet
            </p>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger render={<button className="flex min-h-11 w-full items-center gap-3 rounded-[calc(var(--radius-sm)+2px)] p-2 text-left outline-hidden transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label="Open personal workspace menu" />}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
              <UserRound className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium">Personal workspace</span>
              <span className="block truncate text-xs text-muted-foreground">Local-only</span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" side="right" sideOffset={8}>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Personal workspace</DropdownMenuLabel>
              <DropdownMenuItem onClick={onToggleTheme}>
                  {theme === 'dark' ? (
                    <Sun data-icon="inline-start" aria-hidden="true" />
                  ) : (
                    <Moon data-icon="inline-start" aria-hidden="true" />
                  )}
                  {theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </AppSidebar>
  )
}
