import { toast } from 'sonner'
import type { CSSProperties, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
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
  onUndo: () => void
  description?: ReactNode
}

function showUndoableToast({ title, onUndo, description }: UndoableToastOptions): void {
  ensureUndoShortcut()
  const entry: UndoEntry = { id: 0, run: onUndo, settled: false }
  const id = toast(title, {
    description,
    duration: UNDO_TOAST_DURATION,
    className: 'notify-undo',
    style: { '--notify-undo-duration': `${UNDO_TOAST_DURATION}ms` } as CSSProperties,
    action: (
      <Button
        className="ml-auto shrink-0"
        size="sm"
        variant="secondary"
        onClick={() => runUndo(entry)}
      >
        Undo
        <Kbd className="ml-0.5 h-[18px] min-w-[18px] rounded-md bg-foreground/10 px-1 text-[10px]">
          Ctrl+Z
        </Kbd>
      </Button>
    ),
    onDismiss: () => settleUndo(entry),
    onAutoClose: () => settleUndo(entry)
  })
  entry.id = id
  undoStack.push(entry)
}

interface VerbToastOptions {
  title: string
  description?: ReactNode
  destructive?: boolean
  duration?: number
  id?: string
  action?: ReactNode
}

function showVerbToast({
  title,
  description,
  destructive = false,
  duration,
  id,
  action
}: VerbToastOptions): void {
  const options = {
    description,
    duration,
    id,
    action
  }
  if (destructive) {
    toast.error(title, options)
    return
  }
  toast(title, options)
}

export function notifyActionError(error: string): void {
  toast.error('Unable to Complete Action', {
    description: error,
    duration: 6000
  })
}

export function notifyArchived(count: number, onUndo: () => void, description?: string): void {
  showUndoableToast({
    title: count === 1 ? 'Item archived' : `${count} items archived`,
    onUndo,
    description
  })
}

export function notifyUnarchived(count: number, description?: string): void {
  showVerbToast({
    title: count === 1 ? 'Item unarchived' : `${count} items unarchived`,
    description
  })
}

export function notifyTrashed(count: number, onUndo: () => void): void {
  showUndoableToast({
    title: count === 1 ? 'Item moved to Trash' : `${count} items moved to Trash`,
    onUndo
  })
}

export function notifyEmptyNoteTrashed(onUndo: () => void): void {
  showUndoableToast({
    title: 'Note moved to Trash',
    description: 'It was empty.',
    onUndo
  })
}

export function notifyRestored(count: number, description?: string): void {
  showVerbToast({
    title: count === 1 ? 'Item restored' : `${count} items restored`,
    description
  })
}

export function notifyRenamed(): void {
  showVerbToast({ title: 'Item renamed' })
}

export function notifyExternalChangesMerged(overlappingChanges: boolean): void {
  showVerbToast({
    title: 'External changes merged',
    description: overlappingChanges
      ? 'Your edits were kept where both versions changed.'
      : undefined,
    duration: 3000,
    id: 'external-note-changes-merged'
  })
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
    description: descriptions.join(' ')
  })
}

export function notifyPermanentlyDeleted(count: number): void {
  showVerbToast({
    title: count === 1 ? 'Item permanently deleted' : `${count} items permanently deleted`,
    destructive: true
  })
}

export function notifyCollectionRemoved(name: string): void {
  showVerbToast({
    title: `Removed “${name}”`,
    description: 'Its items were moved to Inbox.'
  })
}

export function notifyLinkOpened(hostname?: string): void {
  showVerbToast({
    title: 'Opened in browser',
    description: hostname ? <span className="font-mono">{hostname}</span> : undefined,
    duration: 2500,
    id: EXTERNAL_LINK_TOAST_ID
  })
}

export function notifyLinkOpenFailed(error: string, onRetry: () => void): void {
  showVerbToast({
    title: 'Could not open link',
    description: error,
    destructive: true,
    duration: 6000,
    id: EXTERNAL_LINK_TOAST_ID,
    action: (
      <Button className="ml-auto shrink-0" size="sm" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    )
  })
}

export function notifyGlobalCapturePrepared(): void {
  showVerbToast({
    title: 'New item is ready in Inbox',
    description: 'Finish the current dialog to continue capturing.',
    duration: 4000,
    id: 'global-capture-prepared'
  })
}

export function notifyGlobalCaptureUnavailable(accelerator: string): void {
  showVerbToast({
    title: 'Global capture shortcut unavailable',
    description:
      window.electron.window.platform === 'linux' && window.navigator.userAgent.includes('Wayland')
        ? `Kuskus could not register ${accelerator} with your Wayland compositor.`
        : `Another application may already use ${accelerator}.`,
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

export function notifyRichEditingUnavailable(): void {
  toast.info('Switched to Markdown source', {
    description:
      'Live mode is unavailable for this note — it contains raw HTML that cannot be represented exactly in the rich editor.',
    duration: 6000,
    id: 'rich-editing-unavailable'
  })
}
