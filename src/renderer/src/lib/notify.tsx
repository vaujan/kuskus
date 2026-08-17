import {
  IconAlertOctagon,
  IconArchive,
  IconArchiveOff,
  IconArrowUpRight,
  IconFolderMinus,
  IconFolderSymlink,
  IconKeyboard,
  IconKeyboardOff,
  IconLinkOff,
  IconPencil,
  IconRestore,
  IconTrash,
  IconTrashX
} from '@tabler/icons-react'
import { toast } from 'sonner'
import type { CSSProperties, ReactNode } from 'react'
import { Kbd } from '@/components/ui/kbd'

const UNDO_TOAST_DURATION = 6000
const EXTERNAL_LINK_TOAST_ID = 'external-link-feedback'

// Matches the editable-target guard used by workspace shortcuts so Ctrl+Z never
// steals undo from text fields, menus, or dialogs.
const EDITABLE_SHORTCUT_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="menu"], [role="dialog"], [role="listbox"]'

interface UndoEntry {
  id: string | number
  run: () => void
  settled: boolean
}

const undoStack: UndoEntry[] = []
let undoShortcutAttached = false

function settleUndo(entry: UndoEntry): void {
  entry.settled = true
  const index = undoStack.indexOf(entry)
  if (index !== -1) undoStack.splice(index, 1)
}

function runUndo(entry: UndoEntry): void {
  if (entry.settled) return
  settleUndo(entry)
  toast.dismiss(entry.id)
  entry.run()
}

function handleUndoShortcut(event: KeyboardEvent): void {
  if (
    event.defaultPrevented ||
    event.altKey ||
    event.shiftKey ||
    (!event.ctrlKey && !event.metaKey) ||
    event.key.toLocaleLowerCase() !== 'z'
  ) {
    return
  }
  const target = event.target
  if (target instanceof Element && target.closest(EDITABLE_SHORTCUT_SELECTOR)) return
  const entry = undoStack[undoStack.length - 1]
  if (!entry) return
  event.preventDefault()
  runUndo(entry)
}

function ensureUndoShortcut(): void {
  if (undoShortcutAttached) return
  undoShortcutAttached = true
  window.addEventListener('keydown', handleUndoShortcut)
}

interface UndoableToastOptions {
  title: string
  icon: ReactNode
  onUndo: () => void
  description?: ReactNode
}

function showUndoableToast({ title, icon, onUndo, description }: UndoableToastOptions): void {
  ensureUndoShortcut()
  const entry: UndoEntry = { id: 0, run: onUndo, settled: false }
  const id = toast(title, {
    icon,
    description,
    duration: UNDO_TOAST_DURATION,
    className: 'notify-undo',
    style: { '--notify-undo-duration': `${UNDO_TOAST_DURATION}ms` } as CSSProperties,
    action: {
      label: (
        <>
          Undo{' '}
          <Kbd className="ml-0.5 h-[18px] min-w-[18px] rounded-md bg-foreground/10 px-1 text-[10px]">
            Ctrl+Z
          </Kbd>
        </>
      ),
      onClick: () => runUndo(entry)
    },
    onDismiss: () => settleUndo(entry),
    onAutoClose: () => settleUndo(entry)
  })
  entry.id = id
  undoStack.push(entry)
}

interface VerbToastOptions {
  title: string
  icon: ReactNode
  description?: ReactNode
  destructive?: boolean
  duration?: number
  id?: string
  action?: {
    label: ReactNode
    onClick: () => void
  }
}

function showVerbToast({
  title,
  icon,
  description,
  destructive = false,
  duration,
  id,
  action
}: VerbToastOptions): void {
  toast(title, {
    icon,
    description,
    duration,
    id,
    action,
    classNames: destructive ? { icon: '!text-destructive' } : undefined
  })
}

export function notifyActionError(error: string): void {
  toast.error('Unable to Complete Action', {
    description: error,
    duration: 6000,
    icon: <IconAlertOctagon />
  })
}

export function notifyArchived(count: number, onUndo: () => void, description?: string): void {
  showUndoableToast({
    title: count === 1 ? 'Item archived' : `${count} items archived`,
    icon: <IconArchive />,
    onUndo,
    description
  })
}

export function notifyUnarchived(count: number, description?: string): void {
  showVerbToast({
    title: count === 1 ? 'Item unarchived' : `${count} items unarchived`,
    icon: <IconArchiveOff />,
    description
  })
}

export function notifyTrashed(count: number, onUndo: () => void): void {
  showUndoableToast({
    title: count === 1 ? 'Item moved to Trash' : `${count} items moved to Trash`,
    icon: <IconTrash />,
    onUndo
  })
}

export function notifyEmptyNoteTrashed(onUndo: () => void): void {
  showUndoableToast({
    title: 'Note moved to Trash',
    description: 'It was empty.',
    icon: <IconTrash />,
    onUndo
  })
}

export function notifyRestored(count: number, description?: string): void {
  showVerbToast({
    title: count === 1 ? 'Item restored' : `${count} items restored`,
    icon: <IconRestore />,
    description
  })
}

export function notifyRenamed(): void {
  showVerbToast({ title: 'Item renamed', icon: <IconPencil /> })
}

export function notifyReferenceAwareMove(input: {
  movedImages: number
  retainedImages: number
  updatedNotes: number
}): void {
  const descriptions: string[] = []
  if (input.movedImages > 0) {
    descriptions.push(
      `${input.movedImages} ${input.movedImages === 1 ? 'image moved' : 'images moved'} with the note.`
    )
  }
  if (input.retainedImages > 0) {
    descriptions.push(
      `${input.retainedImages} shared or separately organized ${input.retainedImages === 1 ? 'image stayed' : 'images stayed'} in place.`
    )
  }
  if (input.updatedNotes > 0) {
    descriptions.push(
      `${input.updatedNotes} ${input.updatedNotes === 1 ? 'note reference was' : 'note references were'} updated.`
    )
  }
  showVerbToast({
    title: input.movedImages > 0 ? 'Moved note and its images' : 'References kept up to date',
    icon: <IconFolderSymlink />,
    description: descriptions.join(' ')
  })
}

export function notifyPermanentlyDeleted(count: number): void {
  showVerbToast({
    title: count === 1 ? 'Item permanently deleted' : `${count} items permanently deleted`,
    icon: <IconTrashX />,
    destructive: true
  })
}

export function notifyCollectionRemoved(name: string): void {
  showVerbToast({
    title: `Removed “${name}”`,
    icon: <IconFolderMinus />,
    description: 'Its items were moved to Inbox.'
  })
}

export function notifyLinkOpened(hostname?: string): void {
  showVerbToast({
    title: 'Opened in browser',
    icon: <IconArrowUpRight />,
    description: hostname ? <span className="font-mono">{hostname}</span> : undefined,
    duration: 2500,
    id: EXTERNAL_LINK_TOAST_ID
  })
}

export function notifyLinkOpenFailed(error: string, onRetry: () => void): void {
  showVerbToast({
    title: 'Could not open link',
    icon: <IconLinkOff />,
    description: error,
    destructive: true,
    duration: 6000,
    id: EXTERNAL_LINK_TOAST_ID,
    action: { label: 'Try again', onClick: onRetry }
  })
}

export function notifyGlobalCapturePrepared(): void {
  showVerbToast({
    title: 'New item is ready in Inbox',
    icon: <IconKeyboard />,
    description: 'Finish the current dialog to continue capturing.',
    duration: 4000,
    id: 'global-capture-prepared'
  })
}

export function notifyGlobalCaptureUnavailable(): void {
  showVerbToast({
    title: 'Global capture shortcut unavailable',
    icon: <IconKeyboardOff />,
    description: 'Another application may already use Ctrl+Shift+Space.',
    destructive: true,
    duration: 6000,
    id: 'global-capture-unavailable'
  })
}

export function notifyVaultIndexingStarted(): void {
  toast.loading('Indexing your vault', {
    description: 'The first open builds an index of every file, so large vaults take a moment.',
    id: 'vault-indexing'
  })
}

export function dismissVaultIndexing(): void {
  toast.dismiss('vault-indexing')
}
