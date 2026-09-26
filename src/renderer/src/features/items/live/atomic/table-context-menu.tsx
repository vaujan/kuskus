/* eslint-disable react-refresh/only-export-components -- CodeMirror opens this React menu through an imperative bridge. */
import { createRoot, type Root } from 'react-dom/client'
import { useCallback, useEffect, useId, useRef, useState, type ComponentType } from 'react'
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconArrowsSort,
  IconBold,
  IconCheck,
  IconClipboard,
  IconCopy,
  IconCopyPlus,
  IconCut,
  IconEraser,
  IconItalic,
  IconLetterCase,
  IconPlus,
  IconSortAscendingLetters,
  IconSortDescendingLetters,
  IconStrikethrough,
  IconTableColumn,
  IconTableRow,
  IconTrash,
  type IconProps
} from '@tabler/icons-react'
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@/components/ui/context-menu'

export type TableContextMenuIcon =
  | 'copy'
  | 'cut'
  | 'paste'
  | 'clear'
  | 'format'
  | 'row'
  | 'column'
  | 'align'
  | 'sort'
  | 'add'
  | 'move-up'
  | 'move-down'
  | 'move-left'
  | 'move-right'
  | 'duplicate'
  | 'delete'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'left'
  | 'center'
  | 'right'
  | 'ascending'
  | 'descending'

export type TableContextMenuEntry = TableContextMenuItem | 'separator'

export interface TableContextMenuItem {
  label: string
  icon?: TableContextMenuIcon
  shortcut?: string
  action?: () => void | Promise<void>
  children?: TableContextMenuEntry[]
  disabled?: boolean
  destructive?: boolean
  checked?: boolean
  confirmation?: {
    title: string
    description: string
  }
}

function openTableConfirmation(
  confirmation: NonNullable<TableContextMenuItem['confirmation']>,
  action: () => void | Promise<void>
): void {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  let disposed = false
  const dispose = (): void => {
    if (disposed) return
    disposed = true
    queueMicrotask(() => {
      root.unmount()
      host.remove()
    })
  }

  function Confirmation(): React.JSX.Element {
    const [open, setOpen] = useState(true)
    const confirmed = useRef(false)
    return (
      <AlertDialog
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={(nextOpen) => {
          if (nextOpen) return
          dispose()
          if (confirmed.current) void Promise.resolve().then(action).catch(() => undefined)
        }}
      >
        <AlertDialogContent size="sm" finalFocus={false}>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmation.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                confirmed.current = true
                setOpen(false)
              }}
            >
              Delete table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  root.render(<Confirmation />)
}

const ICONS: Record<TableContextMenuIcon, ComponentType<IconProps>> = {
  copy: IconCopy,
  cut: IconCut,
  paste: IconClipboard,
  clear: IconEraser,
  format: IconLetterCase,
  row: IconTableRow,
  column: IconTableColumn,
  align: IconAlignLeft,
  sort: IconArrowsSort,
  add: IconPlus,
  'move-up': IconArrowUp,
  'move-down': IconArrowDown,
  'move-left': IconArrowLeft,
  'move-right': IconArrowRight,
  duplicate: IconCopyPlus,
  delete: IconTrash,
  bold: IconBold,
  italic: IconItalic,
  strike: IconStrikethrough,
  left: IconAlignLeft,
  center: IconAlignCenter,
  right: IconAlignRight,
  ascending: IconSortAscendingLetters,
  descending: IconSortDescendingLetters
}

function MenuIcon({ name }: { name?: TableContextMenuIcon }): React.JSX.Element | null {
  if (!name) return null
  const Icon = ICONS[name]
  return <Icon aria-hidden="true" />
}

function entryGroups(entries: TableContextMenuEntry[]): TableContextMenuItem[][] {
  const groups: TableContextMenuItem[][] = [[]]
  for (const entry of entries) {
    if (entry === 'separator') {
      if (groups.at(-1)?.length) groups.push([])
      continue
    }
    groups.at(-1)?.push(entry)
  }
  return groups.filter((group) => group.length)
}

function MenuEntries({
  entries,
  close,
  label
}: {
  entries: TableContextMenuEntry[]
  close: () => void
  label?: string
}): React.JSX.Element {
  const groups = entryGroups(entries)
  return (
    <>
      {groups.map((group, groupIndex) => (
        <div key={groupIndex}>
          {groupIndex > 0 ? <ContextMenuSeparator /> : null}
          <ContextMenuGroup>
            {groupIndex === 0 && label ? <ContextMenuLabel>{label}</ContextMenuLabel> : null}
            {group.map((entry) => {
              if (entry.children) {
                return (
                  <ContextMenuSub key={entry.label}>
                    <ContextMenuSubTrigger disabled={entry.disabled}>
                      <MenuIcon name={entry.icon} />
                      {entry.label}
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-52">
                      <MenuEntries entries={entry.children} close={close} />
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                )
              }

              return (
                <ContextMenuItem
                  key={entry.label}
                  disabled={entry.disabled}
                  variant={entry.destructive ? 'destructive' : 'default'}
                  onClick={() => {
                    const { confirmation, action } = entry
                    if (confirmation && action) {
                      close()
                      window.setTimeout(() => {
                        openTableConfirmation(confirmation, action)
                      }, 0)
                      return
                    }
                    void Promise.resolve(entry.action?.())
                      .catch(() => undefined)
                      .finally(close)
                  }}
                >
                  <MenuIcon name={entry.icon} />
                  {entry.label}
                  {entry.checked ? (
                    <IconCheck className="ml-auto text-primary" aria-hidden="true" />
                  ) : entry.shortcut ? (
                    <ContextMenuShortcut>{entry.shortcut}</ContextMenuShortcut>
                  ) : null}
                </ContextMenuItem>
              )
            })}
          </ContextMenuGroup>
        </div>
      ))}
    </>
  )
}

function TableContextMenu({
  x,
  y,
  label,
  entries,
  dispose
}: {
  x: number
  y: number
  label: string
  entries: TableContextMenuEntry[]
  dispose: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const triggerId = useId()
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (!nextOpen) window.setTimeout(dispose, 150)
    },
    [dispose]
  )
  const close = useCallback(() => handleOpenChange(false), [handleOpenChange])

  useEffect(() => {
    triggerRef.current?.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: x,
        clientY: y
      })
    )
  }, [x, y])

  return (
    <ContextMenu
      open={open}
      triggerId={triggerId}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) dispose()
      }}
    >
      <ContextMenuTrigger
        render={
          <div
            ref={triggerRef}
            data-table-context-menu-trigger
            id={triggerId}
            style={{
              position: 'fixed',
              left: x,
              top: y,
              width: 1,
              height: 1,
              padding: 0,
              border: 0,
              opacity: 0,
              background: 'transparent',
              pointerEvents: 'none'
            }}
          />
        }
      />
      <ContextMenuContent finalFocus={false} className="w-56">
        <MenuEntries entries={entries} close={close} label={label} />
      </ContextMenuContent>
    </ContextMenu>
  )
}

let activeMenuDispose: (() => void) | null = null

export function closeTableContextMenu(): void {
  activeMenuDispose?.()
}

export function openTableContextMenu({
  x,
  y,
  label,
  entries
}: {
  x: number
  y: number
  label: string
  entries: TableContextMenuEntry[]
}): void {
  activeMenuDispose?.()

  const host = document.createElement('div')
  host.dataset.tableContextMenuHost = ''
  document.body.appendChild(host)
  const root: Root = createRoot(host)
  let disposed = false
  const dispose = (): void => {
    if (disposed) return
    disposed = true
    activeMenuDispose = null
    queueMicrotask(() => {
      root.unmount()
      host.remove()
    })
  }
  activeMenuDispose = dispose
  root.render(<TableContextMenu x={x} y={y} label={label} entries={entries} dispose={dispose} />)
}
