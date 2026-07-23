import { Dialog } from '@base-ui/react/dialog'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  IconAlignLeft as AlignLeft,
  IconCalendar as Calendar,
  IconChevronLeft as ChevronLeft,
  IconChevronRight as ChevronRight,
  IconDimensions as Dimensions,
  IconCode as Code,
  IconEdit as Edit,
  IconEye as Eye,
  IconExternalLink as ExternalLink,
  IconFile as File,
  IconFileAlert as FileWarning,
  IconFileTypography as FileTypography,
  IconFolderOpen as FolderOpen,
  IconLink as Link,
  IconLoader2 as LoaderCircle,
  IconPhotoOff as ImageOff,
  IconPlayerPlayFilled as Play,
  IconWorld as Globe2,
  IconX as X,
  type TablerIcon
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
  Dialog as ConflictDialog,
  DialogContent as ConflictDialogContent,
  DialogDescription as ConflictDialogDescription,
  DialogFooter as ConflictDialogFooter,
  DialogHeader as ConflictDialogHeader,
  DialogTitle as ConflictDialogTitle
} from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { createMarkdownDiffRows } from '@/features/items/markdown-diff'
import { MarkdownPreview } from '@/features/items/markdown-preview'
import { NoteAutosaveCoordinator, type NoteAutosaveSnapshot } from '@/features/items/note-autosave'
import { getUnsupportedMarkdownReason } from '@/features/items/markdown-preflight'
import { useImagePreview } from '@/features/items/use-image-preview'
import { useUrlPreview } from '@/features/items/use-url-preview'
import {
  WysiwygMarkdownEditor,
  type WysiwygMarkdownEditorHandle
} from '@/features/items/wysiwyg-markdown-editor'
import { WindowControls } from '@/features/shell/window-controls'
import { cn } from '@/lib/utils'
import type { LibraryItemDto } from '../../../../shared/library-contract'

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
})

type NoteMode = 'read' | 'edit' | 'source'

const NOTE_MODE_OPTIONS: Record<NoteMode, { label: string; icon: TablerIcon }> = {
  read: { label: 'Read', icon: Eye },
  edit: { label: 'Edit', icon: Edit },
  source: { label: 'Source', icon: Code }
}

function isNoteMode(value: unknown): value is NoteMode {
  return value === 'read' || value === 'edit' || value === 'source'
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : DATE_FORMATTER.format(date)
}

function formatMediaType(value: string): string {
  return value.replace('image/', '').toLocaleUpperCase()
}

function PropertyRow({
  icon: Icon,
  label,
  children,
  valueClassName
}: {
  icon: TablerIcon
  label: string
  children: React.ReactNode
  valueClassName?: string
}): React.JSX.Element {
  return (
    <div className="grid min-h-9 grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3 rounded-md px-1.5 py-2">
      <dt className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-4 shrink-0" stroke={1.5} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </dt>
      <dd className={cn('min-w-0 text-xs leading-5 text-foreground/85', valueClassName)}>
        {children}
      </dd>
    </div>
  )
}

function PropertyList({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <dl className="-mx-1.5 space-y-0.5">{children}</dl>
}

function DetailControl({
  label,
  disabled = false,
  onClick,
  children
}: {
  label: string
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <Button
          type="button"
          variant="ghost"
          className="size-10 active:scale-[0.96] transition-[scale,background-color,color]"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function FloatingControls({
  itemId,
  actions,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onError
}: {
  itemId: string
  actions?: React.ReactNode
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onError: (message: string) => void
}): React.JSX.Element {
  return (
    <div className="absolute top-3 right-3 z-20 flex rounded-full bg-popover/85 p-0.5 shadow-sm ring-1 ring-foreground/8 backdrop-blur-md">
      <DetailControl
        label="Previous item (Left arrow)"
        disabled={!hasPrevious}
        onClick={onPrevious}
      >
        <ChevronLeft aria-hidden="true" />
      </DetailControl>
      {actions}
      <DetailControl label="Next item (Right arrow)" disabled={!hasNext} onClick={onNext}>
        <ChevronRight aria-hidden="true" />
      </DetailControl>
      <DetailControl
        label="Show in Explorer"
        onClick={async () => {
          const result = await window.kuskus.showItemInExplorer(itemId)
          if (!result.ok) onError(result.error)
        }}
      >
        <FolderOpen aria-hidden="true" />
      </DetailControl>
      <Tooltip>
        <TooltipTrigger
          render={
            <Dialog.Close
              render={
                <Button
                  type="button"
                  variant="ghost"
                  className="size-10 active:scale-[0.96] transition-[scale,background-color,color]"
                  aria-label="Close item details"
                />
              }
            />
          }
        >
          <X aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Close item details</TooltipContent>
      </Tooltip>
    </div>
  )
}

function MissingContent({ type }: { type: 'image' | 'note' }): React.JSX.Element {
  return (
    <div className="flex max-w-xs flex-col items-center gap-3 px-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <FileWarning className="size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {type === 'image' ? 'Image file is missing' : 'Note file is missing'}
        </p>
        <p className="text-pretty text-xs leading-5 text-muted-foreground">
          Kuskus kept the item, but its stored content is no longer in the library.
        </p>
      </div>
    </div>
  )
}

function ImageCanvas({
  item
}: {
  item: Extract<LibraryItemDto, { type: 'image' }>
}): React.JSX.Element {
  const { preview, previewError } = useImagePreview(item.id, item.missingContent)

  return (
    <section className="flex min-h-64 min-w-0 items-center justify-center overflow-hidden bg-white dark:bg-black p-5 min-[860px]:min-h-0 min-[860px]:p-8">
      {item.missingContent ? (
        <MissingContent type="image" />
      ) : preview ? (
        <img
          src={preview}
          alt={item.title}
          width={item.width}
          height={item.height}
          className="max-h-full max-w-full object-contain outline -outline-offset-1 outline-black/10 dark:outline-white/10"
        />
      ) : previewError ? (
        <div className="flex max-w-xs flex-col items-center gap-3 px-6 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-background/70 text-muted-foreground shadow-sm">
            <ImageOff className="size-5" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">Preview unavailable</p>
            <p className="text-pretty text-xs leading-5 text-muted-foreground">
              The image could not be displayed.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Loading image
        </div>
      )}
    </section>
  )
}

function UrlCanvas({
  item
}: {
  item: Extract<LibraryItemDto, { type: 'url' }>
}): React.JSX.Element {
  const preview = useUrlPreview(item.id, 'preview', item.hasPreviewImage)
  const loading = item.metadataStatus === 'pending' || preview.loading
  return (
    <section className="relative flex min-h-64 min-w-0 items-center justify-center overflow-hidden bg-muted/35 p-5 min-[860px]:min-h-0 min-[860px]:p-8">
      {preview.preview ? (
        <img
          src={preview.preview}
          alt=""
          className="max-h-full max-w-full object-contain outline -outline-offset-1 outline-black/10 dark:outline-white/10"
        />
      ) : (
        <div className="flex max-w-xs flex-col items-center gap-3 px-6 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-background/70 text-muted-foreground shadow-sm">
            {loading ? (
              <LoaderCircle
                className="size-5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Globe2 className="size-5" aria-hidden="true" />
            )}
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {loading ? 'Loading link preview' : 'No preview available'}
            </p>
            <p className="text-pretty text-xs leading-5 text-muted-foreground">{item.domain}</p>
          </div>
        </div>
      )}
      {item.contentKind === 'video' && preview.preview ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-black/60 text-white shadow-sm backdrop-blur-sm">
            <Play className="ml-0.5 size-6" aria-hidden="true" />
          </span>
        </span>
      ) : null}
    </section>
  )
}

function NoteCanvas({
  item,
  mode,
  snapshot,
  unsupportedReason,
  editorRef,
  leaving,
  onDraftChange,
  onModeChange,
  onFlush,
  onRetry,
  onRestore,
  onReviewConflict,
  onError
}: {
  item: Extract<LibraryItemDto, { type: 'note' }>
  mode: NoteMode
  snapshot: NoteAutosaveSnapshot
  unsupportedReason: string | null
  editorRef: React.RefObject<WysiwygMarkdownEditorHandle | null>
  leaving: boolean
  onDraftChange: (value: string) => void
  onModeChange: (mode: NoteMode) => void
  onFlush: () => void
  onRetry: () => void
  onRestore: () => void
  onReviewConflict: () => void
  onError: (message: string) => void
}): React.JSX.Element {
  const sourceRef = useRef<HTMLTextAreaElement>(null)
  const SelectedModeIcon = NOTE_MODE_OPTIONS[mode].icon
  const statusLabel = leaving
    ? 'Finishing save…'
    : snapshot.status === 'saving'
      ? 'Saving…'
      : snapshot.status === 'dirty'
        ? 'Waiting to save…'
        : snapshot.status === 'invalid'
          ? 'Not saved'
          : snapshot.status === 'error'
            ? 'Unable to save'
            : snapshot.status === 'conflict'
              ? 'Save conflict'
              : 'Saved'

  return (
    <section className="flex size-full min-w-0 flex-col bg-popover">
      {!item.missingContent ? (
        <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-3 px-4 pt-16 pb-3 sm:flex-nowrap sm:px-7 sm:pt-3 sm:pr-52">
          <Select
            value={mode}
            onValueChange={(value) => {
              if (isNoteMode(value)) onModeChange(value)
            }}
          >
            <SelectTrigger
              size="sm"
              className="min-w-40 border-border bg-transparent"
              aria-label="Markdown note mode"
              aria-keyshortcuts="Control+E"
            >
              <SelectValue>
                <SelectedModeIcon aria-hidden="true" />
                {NOTE_MODE_OPTIONS[mode].label}
              </SelectValue>
              <Kbd aria-hidden="true">Ctrl+E</Kbd>
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectItem value="read">
                  <Eye aria-hidden="true" />
                  Read
                </SelectItem>
                <SelectItem value="edit" disabled={Boolean(unsupportedReason)}>
                  <Edit aria-hidden="true" />
                  Edit
                </SelectItem>
                <SelectItem value="source">
                  <Code aria-hidden="true" />
                  Source
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <p
            className={cn(
              'text-xs text-muted-foreground',
              (snapshot.status === 'error' ||
                snapshot.status === 'invalid' ||
                snapshot.status === 'conflict') &&
                'text-destructive'
            )}
            aria-live="polite"
            aria-atomic="true"
          >
            {statusLabel}
          </p>
          {snapshot.status === 'dirty' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-keyshortcuts="Control+Enter"
              onClick={onFlush}
            >
              Save now
            </Button>
          ) : null}
        </header>
      ) : null}
      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="focus-visible:ring-0 focus-visible:outline-none"
      >
        {item.missingContent ? (
          <div className="flex size-full items-center justify-center">
            <MissingContent type="note" />
          </div>
        ) : (
          <article className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5 px-7 py-10 sm:px-12 min-[860px]:px-16">
            {unsupportedReason ? (
              <Alert>
                <AlertTitle>Rich editing is unavailable for this note</AlertTitle>
                <AlertDescription>{unsupportedReason}</AlertDescription>
              </Alert>
            ) : null}
            {snapshot.error ? (
              <Alert variant="destructive">
                <AlertTitle>
                  {snapshot.status === 'conflict' ? 'The note changed on disk' : 'Note not saved'}
                </AlertTitle>
                <AlertDescription>{snapshot.error}</AlertDescription>
                <div className="mt-3 flex flex-wrap gap-2">
                  {snapshot.status === 'conflict' ? (
                    <Button type="button" variant="outline" size="sm" onClick={onReviewConflict}>
                      Review differences
                    </Button>
                  ) : snapshot.status === 'error' ? (
                    <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                      Retry save
                    </Button>
                  ) : null}
                  {snapshot.status === 'error' || snapshot.status === 'invalid' ? (
                    <Button type="button" variant="ghost" size="sm" onClick={onRestore}>
                      Restore saved version
                    </Button>
                  ) : null}
                </div>
              </Alert>
            ) : null}
            {mode === 'source' ? (
              <Textarea
                ref={sourceRef}
                value={snapshot.draft}
                className="min-h-[28rem] flex-1 resize-none border-0 bg-transparent p-0 font-mono text-sm leading-6 shadow-none focus-visible:border-transparent focus-visible:ring-0"
                aria-label="Markdown source"
                aria-invalid={snapshot.status === 'invalid'}
                autoFocus
                spellCheck={false}
                onChange={(event) => onDraftChange(event.currentTarget.value)}
              />
            ) : unsupportedReason ? (
              <MarkdownPreview
                value={snapshot.draft}
                itemId={item.id}
                attachments={item.attachments}
                presentation="detail"
                onOpenLink={async (url) => {
                  const result = await window.kuskus.openExternalUrl(url)
                  if (!result.ok) onError(result.error)
                }}
              />
            ) : null}
            {!unsupportedReason ? (
              <div className={mode === 'source' ? 'hidden' : undefined}>
                <WysiwygMarkdownEditor
                  ref={editorRef}
                  itemId={item.id}
                  initialMarkdown={snapshot.draft}
                  attachments={item.attachments}
                  readOnly={mode !== 'edit'}
                  onMarkdownChange={onDraftChange}
                  onOpenLink={(url) => {
                    void window.kuskus.openExternalUrl(url).then((result) => {
                      if (!result.ok) onError(result.error)
                    })
                  }}
                />
              </div>
            ) : null}
          </article>
        )}
      </ScrollArea>
    </section>
  )
}

function ImageInspector({
  item
}: {
  item: Extract<LibraryItemDto, { type: 'image' }>
}): React.JSX.Element {
  return (
    <aside className="min-w-0 border-t bg-popover min-[860px]:border-t-0 min-[860px]:border-l">
      <div className="space-y-5 p-5 pt-18 sm:p-6 sm:pt-20">
        <Dialog.Title className="text-balance text-xl leading-7 font-semibold text-popover-foreground">
          {item.title}
        </Dialog.Title>
        <PropertyList>
          <PropertyRow icon={File} label="File name" valueClassName="break-words">
            {item.sourceFilename ?? 'Pasted image'}
          </PropertyRow>
          <PropertyRow icon={FileTypography} label="Format">
            {formatMediaType(item.mediaType)}
          </PropertyRow>
          <PropertyRow icon={Dimensions} label="Dimensions" valueClassName="tabular-nums">
            {item.width} × {item.height}
          </PropertyRow>
          <PropertyRow icon={Calendar} label="Added" valueClassName="tabular-nums">
            <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
          </PropertyRow>
        </PropertyList>
      </div>
    </aside>
  )
}

function UrlInspector({
  item,
  onOpenLink
}: {
  item: Extract<LibraryItemDto, { type: 'url' }>
  onOpenLink: () => void
}): React.JSX.Element {
  return (
    <aside className="min-w-0 border-t bg-popover min-[860px]:border-t-0 min-[860px]:border-l">
      <div className="space-y-5 p-5 pt-18 sm:p-6 sm:pt-20">
        <Dialog.Title className="text-balance text-xl leading-7 font-semibold text-popover-foreground">
          {item.title}
        </Dialog.Title>
        <PropertyList>
          <PropertyRow icon={Link} label="Source" valueClassName="break-all">
            {item.sourceUrl}
          </PropertyRow>
          {item.description ? (
            <PropertyRow icon={AlignLeft} label="Description" valueClassName="text-pretty">
              {item.description}
            </PropertyRow>
          ) : null}
          <PropertyRow icon={Calendar} label="Added" valueClassName="tabular-nums">
            <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
          </PropertyRow>
        </PropertyList>
        <Button
          size="lg"
          className="w-full active:scale-[0.96] transition-[scale,background-color,color]"
          aria-keyshortcuts="Control+Enter"
          onClick={onOpenLink}
        >
          <ExternalLink data-icon="inline-start" aria-hidden="true" />
          Open link
          <Kbd
            className="ml-1 hidden bg-primary-foreground/15 text-primary-foreground sm:inline-flex"
            aria-hidden="true"
          >
            Ctrl+Enter
          </Kbd>
        </Button>
      </div>
    </aside>
  )
}

export function ItemDetailDialog({
  item,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onOpenChange,
  onItemUpdated,
  renderActions,
  onError
}: {
  item: LibraryItemDto | null
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onOpenChange: (open: boolean) => void
  onItemUpdated: (item: LibraryItemDto) => void
  renderActions?: (guard: (action: () => void) => void) => React.ReactNode
  onError: (message: string) => void
}): React.JSX.Element {
  const [openedNote] = useState(() => (item?.type === 'note' ? item : null))
  const editorRef = useRef<WysiwygMarkdownEditorHandle>(null)
  const [replacement, setReplacement] = useState<{ markdown: string; request: number } | null>(null)
  const coordinator = useMemo(
    () =>
      openedNote
        ? new NoteAutosaveCoordinator({
            itemId: openedNote.id,
            initialMarkdown: openedNote.body,
            save: (input) => window.kuskus.updateNote(input),
            onSaved: onItemUpdated,
            onDraftReplaced: (markdown) =>
              setReplacement((current) => ({ markdown, request: (current?.request ?? 0) + 1 }))
          })
        : null,
    [onItemUpdated, openedNote]
  )
  const fallbackSnapshot = useRef<NoteAutosaveSnapshot>({
    status: 'saved',
    draft: '',
    savedMarkdown: '',
    error: null,
    conflict: null
  })
  const snapshot = useSyncExternalStore(
    coordinator?.subscribe ?? (() => () => undefined),
    coordinator?.getSnapshot ?? (() => fallbackSnapshot.current)
  )
  const [mode, setMode] = useState<NoteMode>('read')
  const [leaving, setLeaving] = useState(false)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [conflictResolution, setConflictResolution] = useState<'mine' | 'disk' | null>(null)
  const unsupportedReason = openedNote ? getUnsupportedMarkdownReason(snapshot.draft) : null
  const diffRows = useMemo(
    () => (snapshot.conflict ? createMarkdownDiffRows(snapshot.draft, snapshot.conflict.body) : []),
    [snapshot.conflict, snapshot.draft]
  )

  useEffect(() => () => coordinator?.dispose(), [coordinator])
  useEffect(() => {
    if (!replacement) return
    void editorRef.current?.replaceMarkdown(replacement.markdown)
  }, [replacement])

  const changeMode = (nextMode: NoteMode): void => {
    if (nextMode === mode) return
    if (mode === 'source' && nextMode !== 'source' && !unsupportedReason) {
      const replacementPromise = editorRef.current?.replaceMarkdown(snapshot.draft)
      if (replacementPromise) {
        void replacementPromise.then(() => setMode(nextMode))
        return
      }
    }
    setMode(nextMode)
  }

  const requestGuardedAction = (action: () => void): void => {
    if (leaving) return
    if (!coordinator?.hasPendingChanges()) {
      action()
      return
    }
    setLeaving(true)
    void coordinator.flush().then((saved) => {
      setLeaving(false)
      if (saved) action()
    })
  }

  const openLink = async (): Promise<void> => {
    if (item?.type !== 'url') return

    const result = await window.kuskus.openExternalUrl(item.sourceUrl)
    if (!result.ok) onError(result.error)
  }

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.defaultPrevented) return
    const target = event.target as HTMLElement | null
    const isEditingTarget = Boolean(target?.closest('input, textarea, [contenteditable="true"]'))
    if (
      event.key.toLocaleLowerCase() === 'e' &&
      event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.repeat &&
      item?.type === 'note' &&
      (mode === 'source' || !unsupportedReason)
    ) {
      event.preventDefault()
      changeMode(mode === 'read' ? 'edit' : 'read')
      return
    }
    if (
      event.key === 'Enter' &&
      event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.repeat &&
      item?.type === 'url' &&
      !isEditingTarget
    ) {
      event.preventDefault()
      void openLink()
      return
    }
    if (
      event.key === 'Enter' &&
      event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.repeat &&
      item?.type === 'note' &&
      (mode === 'edit' || mode === 'source')
    ) {
      event.preventDefault()
      void coordinator?.flush()
      return
    }
    if (isEditingTarget) return
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (event.key === 'ArrowLeft' && hasPrevious) {
      event.preventDefault()
      requestGuardedAction(onPrevious)
    } else if (event.key === 'ArrowRight' && hasNext) {
      event.preventDefault()
      requestGuardedAction(onNext)
    }
  }

  return (
    <>
      <Dialog.Root
        open={item !== null}
        onOpenChange={(open) => {
          if (open) onOpenChange(true)
          else requestGuardedAction(() => onOpenChange(false))
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-[var(--backdrop)] transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup
            onKeyDown={handleKeyDown}
            className="pointer-events-none fixed inset-0 z-50 outline-none transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0"
          >
            <div className="pointer-events-auto fixed top-0 right-0 h-12">
              <WindowControls onClose={() => requestGuardedAction(window.electron.window.close)} />
            </div>
            <div className="pointer-events-auto fixed top-16 left-1/2 flex h-[calc(100vh-5rem)] max-h-[60rem] w-[calc(100vw-2rem)] max-w-[90rem] -translate-x-1/2 overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-white/10">
              {item ? (
                <>
                  {item.type === 'note' ? (
                    <Dialog.Title className="sr-only">{item.title}</Dialog.Title>
                  ) : null}
                  <Dialog.Description className="sr-only">
                    {item.type === 'note' ? 'Editable note details' : 'Read-only details'} for{' '}
                    {item.title}. Use the arrow keys to move between visible items.
                  </Dialog.Description>
                  <FloatingControls
                    itemId={item.id}
                    actions={renderActions?.(requestGuardedAction)}
                    hasPrevious={hasPrevious}
                    hasNext={hasNext}
                    onPrevious={() => requestGuardedAction(onPrevious)}
                    onNext={() => requestGuardedAction(onNext)}
                    onError={onError}
                  />
                  {item.type === 'note' ? (
                    <NoteCanvas
                      item={item}
                      mode={mode}
                      snapshot={snapshot}
                      unsupportedReason={unsupportedReason}
                      editorRef={editorRef}
                      leaving={leaving}
                      onDraftChange={(value) => coordinator?.updateDraft(value)}
                      onModeChange={changeMode}
                      onFlush={() => void coordinator?.flush()}
                      onRetry={() => void coordinator?.retry()}
                      onRestore={() => coordinator?.restoreSaved()}
                      onReviewConflict={() => setConflictDialogOpen(true)}
                      onError={onError}
                    />
                  ) : (
                    <ScrollArea
                      className="min-h-0 min-w-0 flex-1"
                      viewportClassName="focus-visible:ring-0 focus-visible:outline-none"
                    >
                      <div className="min-h-full min-w-0 min-[860px]:grid min-[860px]:grid-cols-[minmax(0,1fr)_20rem]">
                        {item.type === 'image' ? (
                          <>
                            <ImageCanvas item={item} />
                            <ImageInspector item={item} />
                          </>
                        ) : (
                          <>
                            <UrlCanvas item={item} />
                            <UrlInspector item={item} onOpenLink={() => void openLink()} />
                          </>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </>
              ) : null}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <ConflictDialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <ConflictDialogContent className="max-w-5xl" showCloseButton>
          <ConflictDialogHeader>
            <ConflictDialogTitle>Review note conflict</ConflictDialogTitle>
            <ConflictDialogDescription>
              Your draft is on the left. The version currently stored on disk is on the right.
            </ConflictDialogDescription>
          </ConflictDialogHeader>
          <div className="grid min-h-0 grid-cols-2 overflow-hidden rounded-lg border">
            <div className="border-r px-3 py-2 text-xs font-medium">My draft</div>
            <div className="px-3 py-2 text-xs font-medium">Disk version</div>
            <ScrollArea className="col-span-2 max-h-[60vh] border-t">
              <div className="grid min-w-[48rem] grid-cols-2 font-mono text-xs leading-5">
                {diffRows.map((row, index) => (
                  <div className="contents" key={`${index}-${row.localLine}-${row.diskLine}`}>
                    <pre
                      className={cn(
                        'min-h-5 border-r px-3 whitespace-pre-wrap',
                        row.kind !== 'same' && row.kind !== 'disk' && 'bg-destructive/10'
                      )}
                    >
                      <span className="mr-3 select-none text-muted-foreground">
                        {row.localLine ?? ''}
                      </span>
                      {row.localText}
                    </pre>
                    <pre
                      className={cn(
                        'min-h-5 px-3 whitespace-pre-wrap',
                        row.kind !== 'same' && row.kind !== 'local' && 'bg-destructive/10'
                      )}
                    >
                      <span className="mr-3 select-none text-muted-foreground">
                        {row.diskLine ?? ''}
                      </span>
                      {row.diskText}
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <ConflictDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConflictDialogOpen(false)
                setConflictResolution('disk')
              }}
            >
              Use disk version
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConflictDialogOpen(false)
                setConflictResolution('mine')
              }}
            >
              Use my version
            </Button>
          </ConflictDialogFooter>
        </ConflictDialogContent>
      </ConflictDialog>
      <AlertDialog
        open={conflictResolution !== null}
        onOpenChange={(open) => {
          if (!open) setConflictResolution(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {conflictResolution === 'mine' ? 'Replace the disk version?' : 'Replace your draft?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {conflictResolution === 'mine'
                ? 'Kuskus will save your reviewed draft over the external version. A newer external change will trigger another conflict.'
                : 'Your unsaved draft will be replaced by the reviewed version from disk.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              variant={conflictResolution === 'mine' ? 'destructive' : 'default'}
              onClick={() => {
                const current = snapshot.conflict
                const resolution = conflictResolution
                setConflictResolution(null)
                if (!current || !coordinator) return
                if (resolution === 'mine') void coordinator.useLocalVersion(current)
                else {
                  coordinator.useDiskVersion(current)
                  setMode('read')
                }
              }}
            >
              {conflictResolution === 'mine' ? 'Use my version' : 'Use disk version'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
