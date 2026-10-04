import type { NoteMode } from '../items/note-view-mode'
import { COLOR_MODES, COLOR_THEMES, type ColorMode, type ColorTheme } from '../../hooks/theme'
import type {
  LibraryDto,
  LibraryItemDto,
  ActiveItemLocation
} from '../../../../shared/library-contract'
import type { LibraryDestination } from '../shell/library-sidebar'
import type { AppLayout } from '../shell/application-menu'
import type { AppCommand } from './command-catalog'

interface WorkspaceCommandActions {
  newNote: () => void
  newFolder: () => void
  noteMode: (mode: NoteMode) => void
  addItem: () => void
  addFile: () => void
  quickOpen: () => void
  searchLibrary: () => void
  navigate: (destination: LibraryDestination) => void
  rename: (item: LibraryItemDto) => void
  move: (ids: string[], destination: ActiveItemLocation) => void
  pin: (ids: string[], pinned: boolean) => void
  trash: (ids: string[]) => void
  restore: (ids: string[]) => void
  layout: (layout: AppLayout) => void
  find: (replace: boolean) => void
  settings: () => void
  colorTheme: (theme: ColorTheme) => void
  colorMode: (mode: ColorMode) => void
}

export function createWorkspaceCommands({
  library,
  targetIds,
  itemOperationBusy,
  commandModifier,
  noteCommandsEnabled,
  colorTheme,
  colorMode,
  actions
}: {
  library: LibraryDto
  targetIds: string[]
  itemOperationBusy: boolean
  commandModifier: string
  noteCommandsEnabled: boolean
  colorTheme: ColorTheme
  colorMode: ColorMode
  actions: WorkspaceCommandActions
}): { commands: AppCommand[] } {
  const commandItems = targetIds.flatMap((id) => {
    const item = library.items.find((candidate) => candidate.id === id)
    return item ? [item] : []
  })
  const commandTargetLabel =
    commandItems.length === 1
      ? commandItems[0].title
      : commandItems.length > 1
        ? `${commandItems.length} selected items`
        : 'Library commands'
  const targetUnavailable = itemOperationBusy
    ? 'An item operation is in progress'
    : commandItems.length !== targetIds.length
      ? 'The selection has changed'
      : commandItems.length === 0
        ? 'Select an item first'
        : undefined
  const activeTargets = commandItems.every((item) => item.location.type !== 'trash')
  const trashedTargets =
    commandItems.length > 0 && commandItems.every((item) => item.location.type === 'trash')
  const commandIds = commandItems.map((item) => item.id)
  const folders = [...library.collections].sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath)
  )
  const commandDestinations: { id: string; label: string; destination: ActiveItemLocation }[] = [
    { id: 'inbox', label: 'Inbox', destination: { type: 'inbox' } },
    ...folders.map((folder) => ({
      id: folder.id,
      label: folder.relativePath,
      destination: { type: 'collection' as const, collectionId: folder.id }
    }))
  ]
  const commands: AppCommand[] = [
    { id: 'new-folder', label: 'New folder…', group: 'Create', run: actions.newFolder },
    {
      id: 'new-note',
      label: 'New note',
      group: 'Create',
      shortcut: 'Ctrl+N',
      run: actions.newNote
    },
    {
      id: 'add-item',
      label: 'Add item',
      group: 'Create',
      shortcut: 'Ctrl+Shift+N',
      keywords: ['capture', 'import'],
      run: actions.addItem
    },
    {
      id: 'add-file',
      label: 'Add file or image…',
      group: 'Create',
      keywords: ['import', 'upload'],
      run: actions.addFile
    },
    {
      id: 'quick-open',
      label: 'Quick Open…',
      group: 'Navigate',
      shortcut: `${commandModifier}+O`,
      run: actions.quickOpen
    },
    {
      id: 'search-library',
      label: 'Search library',
      group: 'Navigate',
      shortcut: `${commandModifier}+Shift+F`,
      run: actions.searchLibrary
    },
    ...(['inbox', 'all', 'pinned', 'archive', 'trash'] as const).map((type): AppCommand => ({
      id: `go-${type}`,
      label: `Go to ${{ inbox: 'Inbox', all: 'All Items', pinned: 'Pinned', archive: 'Archive', trash: 'Trash' }[type]}`,
      group: 'Navigate',
      run: () => actions.navigate({ type })
    })),
    {
      id: 'go-folder',
      label: 'Go to folder…',
      disabledReason: folders.length ? undefined : 'Create a folder first',
      group: 'Navigate',
      children: folders.map((folder) => ({
        id: `go-folder:${folder.id}`,
        label: folder.relativePath,
        group: 'Folders',
        run: () => actions.navigate({ type: 'collection', collectionId: folder.id })
      }))
    },
    {
      id: 'rename',
      label: 'Rename item…',
      group: 'Organize',
      shortcut: 'F2',
      description: commandTargetLabel,
      disabledReason:
        targetUnavailable ??
        (!activeTargets
          ? 'Restore the item first'
          : commandItems.length !== 1
            ? 'Select one item'
            : undefined),
      run: () => actions.rename(commandItems[0])
    },
    {
      id: 'move',
      label: 'Move to folder…',
      group: 'Organize',
      keywords: ['organize'],
      description: commandTargetLabel,
      disabledReason: targetUnavailable ?? (!activeTargets ? 'Restore the items first' : undefined),
      children: commandDestinations.map(({ id, label, destination: next }) => ({
        id: `move:${id}`,
        label,
        group: 'Destinations',
        disabledReason: commandItems.every(
          (item) =>
            item.location.type === next.type &&
            (next.type === 'inbox' ||
              (item.location.type === 'collection' &&
                item.location.collectionId === next.collectionId))
        )
          ? 'Current destination'
          : undefined,
        run: () => actions.move(commandIds, next)
      }))
    },
    {
      id: 'pin',
      label:
        commandIds.length > 0 && commandIds.every((id) => library.pinnedItemIds.includes(id))
          ? 'Unpin items'
          : 'Pin items',
      group: 'Organize',
      description: commandTargetLabel,
      disabledReason: targetUnavailable ?? (!activeTargets ? 'Restore the items first' : undefined),
      run: () =>
        actions.pin(commandIds, !commandIds.every((id) => library.pinnedItemIds.includes(id)))
    },
    {
      id: 'trash',
      label: 'Move to Trash',
      group: 'Organize',
      keywords: ['delete', 'remove'],
      description: commandTargetLabel,
      destructive: true,
      disabledReason:
        targetUnavailable ?? (!activeTargets ? 'Items are already in Trash' : undefined),
      run: () => actions.trash(commandIds)
    },
    ...(trashedTargets
      ? [
          {
            id: 'restore',
            label: 'Restore items',
            group: 'Organize',
            description: commandTargetLabel,
            disabledReason: targetUnavailable,
            run: () => actions.restore(commandIds)
          }
        ]
      : []),
    ...(['visual', 'grid', 'focus'] as const).map((layout): AppCommand => ({
      id: `layout-${layout}`,
      label: `Switch to ${layout === 'visual' ? 'masonry' : layout} view`,
      group: 'View',
      run: () => actions.layout(layout)
    })),
    ...(noteCommandsEnabled
      ? [
          ...(['read', 'live', 'markdown', 'split'] as const).map((mode): AppCommand => ({
            id: `note-mode:${mode}`,
            label: {
              read: 'Read note',
              live: 'Edit note live',
              markdown: 'Edit Markdown source',
              split: 'Split note view'
            }[mode],
            group: 'Note',
            run: () => actions.noteMode(mode)
          })),
          {
            id: 'note-find',
            label: 'Find in note',
            group: 'Note',
            shortcut: `${commandModifier}+F`,
            run: () => actions.find(false)
          },
          {
            id: 'note-replace',
            label: 'Replace in note',
            group: 'Note',
            run: () => actions.find(true)
          }
        ]
      : []),
    {
      id: 'color-theme',
      label: 'Change color theme…',
      group: 'Appearance',
      description: COLOR_THEMES.find((theme) => theme.value === colorTheme)?.label,
      keywords: COLOR_THEMES.map((theme) => theme.label),
      children: COLOR_THEMES.map((theme) => ({
        id: `color-theme:${theme.value}`,
        label: theme.label,
        group: 'Color themes',
        checked: theme.value === colorTheme,
        run: () => actions.colorTheme(theme.value)
      }))
    },
    {
      id: 'color-mode',
      label: 'Change color mode…',
      group: 'Appearance',
      description: COLOR_MODES.find((mode) => mode.value === colorMode)?.label,
      keywords: ['light', 'dark', 'system', 'appearance'],
      children: COLOR_MODES.map((mode) => ({
        id: `color-mode:${mode.value}`,
        label: mode.value === 'system' ? 'Follow system appearance' : `${mode.label} mode`,
        group: 'Color modes',
        checked: mode.value === colorMode,
        run: () => actions.colorMode(mode.value)
      }))
    },
    {
      id: 'settings',
      label: 'Open settings',
      group: 'Application',
      keywords: ['preferences', 'keyboard', 'shortcuts'],
      shortcut: `${commandModifier}+,`,
      run: () => actions.settings()
    }
  ]
  return { commands }
}
