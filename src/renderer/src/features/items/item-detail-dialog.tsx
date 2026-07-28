import { Dialog } from '@base-ui/react/dialog'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  IconAlignLeft as AlignLeft,
  IconCalendar as Calendar,
  IconChevronLeft as ChevronLeft,
  IconChevronRight as ChevronRight,
  IconCode as Code,
  IconColumns2 as Columns2,
  IconDimensions as Dimensions,
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { createMarkdownDiffRows } from '@/features/items/markdown-diff'
import { MarkdownEditor, type MarkdownEditorHandle } from '@/features/items/markdown-editor'
import { MarkdownPreview } from '@/features/items/markdown-preview'
import {
  getScrollRatio,
  getScrollTopForRatio,
  hasMeaningfulScrollDelta
} from '@/features/items/markdown-scroll'
import { NoteAutosaveCoordinator, type NoteAutosaveSnapshot } from '@/features/items/note-autosave'
import {
  getSplitToggleMode,
  toggleReadMarkdown,
  type NoteMode,
  type SinglePaneNoteMode
} from '@/features/items/note-view-mode'
import { openExternalUrlWithFeedback } from '@/features/items/open-external-url'
import { useImagePreview } from '@/features/items/use-image-preview'
import { useUrlPreview } from '@/features/items/use-url-preview'
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
          className="size-10"
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
  leadingControls,
  actions,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onError
}: {
  itemId: string
  leadingControls?: React.ReactNode
  actions?: React.ReactNode
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onError: (message: string) => void
}): React.JSX.Element {
  return (
    <div className="absolute top-3 right-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end gap-2">
      {leadingControls}
      <div className="flex rounded-full bg-popover/85 p-0.5 shadow-sm ring-1 ring-foreground/8 backdrop-blur-md">
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
                    className="size-10"
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
    </div>
  )
}

function NoteModeControls({
  mode,
  onModeChange
}: {
  mode: NoteMode
  onModeChange: (mode: NoteMode) => void
}): React.JSX.Element {
  const options = [
    { value: 'read' as const, label: 'Read (Ctrl+E)', icon: Eye, shortcut: 'Control+E' },
    { value: 'markdown' as const, label: 'Markdown (Ctrl+E)', icon: Code, shortcut: 'Control+E' },
    {
      value: 'split' as const,
      label: 'Split view (Ctrl+Shift+E)',
      icon: Columns2,
      shortcut: 'Control+Shift+E'
    }
  ]

  return (
    <div
      className="flex rounded-full bg-popover/85 p-0.5 shadow-sm ring-1 ring-foreground/8 backdrop-blur-md"
      role="group"
      aria-label="Note mode"
    >
      {options.map(({ value, label, icon: Icon, shortcut }) => (
        <Tooltip key={value}>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                'size-10 rounded-full text-muted-foreground shadow-none',
                mode === value &&
                  'bg-foreground/8 text-foreground shadow-sm hover:bg-foreground/10 dark:bg-foreground/10 dark:hover:bg-foreground/12'
              )}
              aria-label={label}
              aria-pressed={mode === value}
              aria-keyshortcuts={shortcut}
              onClick={() => onModeChange(value)}
            >
              <Icon stroke={1.5} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
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
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
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
  onDraftChange,
  onRetry,
  onRestore,
  onReviewConflict
}: {
  item: Extract<LibraryItemDto, { type: 'note' }>
  mode: NoteMode
  snapshot: NoteAutosaveSnapshot
  onDraftChange: (value: string) => void
  onRetry: () => void
  onRestore: () => void
  onReviewConflict: () => void
}): React.JSX.Element {
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const previewViewportRef = useRef<HTMLDivElement>(null)
  const previousModeRef = useRef<NoteMode>(mode)
  const activeScrollDriverRef = useRef<'source' | 'preview'>(mode === 'read' ? 'preview' : 'source')
  const pendingScrollDriverRef = useRef<'source' | 'preview' | null>(null)
  const programmaticScrollTargetRef = useRef<'source' | 'preview' | null>(null)
  const syncFrameRef = useRef<number | null>(null)
  const releaseSyncFrameRef = useRef<number | null>(null)
  const problemStatusLabel =
    snapshot.status === 'invalid'
      ? 'Not saved'
      : snapshot.status === 'error'
        ? 'Unable to save'
        : snapshot.status === 'conflict'
          ? 'Save conflict'
          : null

  const scheduleScrollSynchronization = useCallback(
    (driver: 'source' | 'preview', recordDriver = true): void => {
      if (mode !== 'split') return
      if (programmaticScrollTargetRef.current === driver) {
        programmaticScrollTargetRef.current = null
        return
      }
      if (recordDriver) activeScrollDriverRef.current = driver
      pendingScrollDriverRef.current = driver
      if (syncFrameRef.current !== null) return

      syncFrameRef.current = requestAnimationFrame(() => {
        syncFrameRef.current = null
        const pendingDriver = pendingScrollDriverRef.current
        pendingScrollDriverRef.current = null
        const source = editorRef.current?.getScroller()
        const preview = previewViewportRef.current
        if (!pendingDriver || !source || !preview) return

        const driverElement = pendingDriver === 'source' ? source : preview
        const targetElement = pendingDriver === 'source' ? preview : source
        if (driverElement.clientHeight === 0 || targetElement.clientHeight === 0) return

        const ratio = getScrollRatio(
          driverElement.scrollTop,
          driverElement.scrollHeight,
          driverElement.clientHeight
        )
        const nextScrollTop = getScrollTopForRatio(
          ratio,
          targetElement.scrollHeight,
          targetElement.clientHeight
        )
        if (!hasMeaningfulScrollDelta(targetElement.scrollTop, nextScrollTop)) return

        const targetPane = pendingDriver === 'source' ? 'preview' : 'source'
        programmaticScrollTargetRef.current = targetPane
        targetElement.scrollTop = nextScrollTop
        if (releaseSyncFrameRef.current !== null) {
          cancelAnimationFrame(releaseSyncFrameRef.current)
        }
        releaseSyncFrameRef.current = requestAnimationFrame(() => {
          if (programmaticScrollTargetRef.current === targetPane) {
            programmaticScrollTargetRef.current = null
          }
          releaseSyncFrameRef.current = null
        })
      })
    },
    [mode]
  )

  useEffect(() => {
    const preview = previewViewportRef.current
    if (!preview) return
    const handlePreviewScroll = (): void => scheduleScrollSynchronization('preview')
    preview.addEventListener('scroll', handlePreviewScroll, { passive: true })
    return () => preview.removeEventListener('scroll', handlePreviewScroll)
  }, [scheduleScrollSynchronization])

  useEffect(() => {
    const previousMode = previousModeRef.current
    previousModeRef.current = mode
    const frame = requestAnimationFrame(() => {
      editorRef.current?.requestMeasure()
      if (mode === 'split' && previousMode !== 'split') {
        const driver = previousMode === 'read' ? 'preview' : 'source'
        activeScrollDriverRef.current = driver
        scheduleScrollSynchronization(driver, false)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [mode, scheduleScrollSynchronization])

  useEffect(() => {
    if (mode !== 'split') return
    scheduleScrollSynchronization(activeScrollDriverRef.current, false)
  }, [mode, scheduleScrollSynchronization, snapshot.draft])

  useEffect(() => {
    if (mode !== 'split') return
    const source = editorRef.current?.getScroller()
    const preview = previewViewportRef.current
    if (!source || !preview) return

    const observer = new ResizeObserver(() => {
      editorRef.current?.requestMeasure()
      scheduleScrollSynchronization(activeScrollDriverRef.current, false)
    })
    observer.observe(source)
    observer.observe(preview)
    const sourceContent = source.querySelector('.cm-content')
    const previewContent = preview.firstElementChild
    if (sourceContent) observer.observe(sourceContent)
    if (previewContent) observer.observe(previewContent)
    return () => observer.disconnect()
  }, [mode, scheduleScrollSynchronization])

  useEffect(
    () => () => {
      if (syncFrameRef.current !== null) cancelAnimationFrame(syncFrameRef.current)
      if (releaseSyncFrameRef.current !== null) cancelAnimationFrame(releaseSyncFrameRef.current)
    },
    []
  )

  return (
    <section className="flex size-full min-w-0 flex-col bg-popover">
      {!item.missingContent ? (
        <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-x-5 gap-y-3 px-4 pt-28 pb-3 sm:flex-nowrap sm:px-7 sm:pt-3 sm:pr-[23rem]">
          <div className="min-w-0 flex-1 basis-full sm:basis-auto">
            <p
              className="truncate text-sm leading-5 font-medium text-foreground"
              title={item.title}
            >
              {item.title}
            </p>
            <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[0.6875rem] leading-4 text-muted-foreground tabular-nums">
              <span className="whitespace-nowrap">
                Added <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
              </span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">
                Edited <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
              </span>
            </p>
          </div>
          {problemStatusLabel ? (
            <p
              className="shrink-0 text-xs text-destructive"
              aria-live="assertive"
              aria-atomic="true"
            >
              {problemStatusLabel}
            </p>
          ) : null}
        </header>
      ) : null}
      {item.missingContent ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <MissingContent type="note" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {snapshot.error ? (
            <div className="shrink-0 px-7 pt-4 sm:px-12">
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
            </div>
          ) : null}
          <div
            className={cn(
              'grid min-h-0 flex-1 grid-cols-1',
              mode === 'split' && 'min-[860px]:grid-cols-2'
            )}
          >
            <div
              className={cn(
                'min-h-0 min-w-0',
                mode === 'read' ? 'hidden' : 'flex',
                mode === 'split' && 'min-[860px]:border-r'
              )}
            >
              <MarkdownEditor
                ref={editorRef}
                value={snapshot.draft}
                invalid={snapshot.status === 'invalid'}
                active={mode === 'markdown' || mode === 'split'}
                onChange={(value) => {
                  activeScrollDriverRef.current = 'source'
                  onDraftChange(value)
                }}
                onScroll={() => scheduleScrollSynchronization('source')}
              />
            </div>
            <ScrollArea
              className={cn(
                'min-h-0 min-w-0',
                mode === 'read' && 'flex',
                mode === 'markdown' && 'hidden',
                mode === 'split' && 'hidden min-[860px]:flex'
              )}
              viewportClassName="focus-visible:ring-0 focus-visible:outline-none"
              viewportRef={previewViewportRef}
            >
              <article className="mx-auto min-h-full w-full max-w-3xl px-7 py-10 sm:px-12 min-[860px]:px-16">
                <MarkdownPreview
                  value={snapshot.draft}
                  itemId={item.id}
                  attachments={item.attachments}
                  presentation="detail"
                  onOpenLink={(url) => void openExternalUrlWithFeedback(url)}
                />
              </article>
            </ScrollArea>
          </div>
        </div>
      )}
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
        <Button size="lg" className="w-full" aria-keyshortcuts="Control+Enter" onClick={onOpenLink}>
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
  const coordinator = useMemo(
    () =>
      openedNote
        ? new NoteAutosaveCoordinator({
            itemId: openedNote.id,
            initialMarkdown: openedNote.body,
            save: (input) => window.kuskus.updateNote(input),
            onSaved: onItemUpdated,
            onDraftReplaced: () => undefined
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
  const previousSingleModeRef = useRef<SinglePaneNoteMode>('read')
  const [leaving, setLeaving] = useState(false)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [conflictResolution, setConflictResolution] = useState<'mine' | 'disk' | null>(null)
  const diffRows = useMemo(
    () => (snapshot.conflict ? createMarkdownDiffRows(snapshot.draft, snapshot.conflict.body) : []),
    [snapshot.conflict, snapshot.draft]
  )

  useEffect(() => () => coordinator?.dispose(), [coordinator])
  const changeMode = (nextMode: NoteMode): void => {
    if (nextMode === mode) return
    if (nextMode !== 'split') previousSingleModeRef.current = nextMode
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
    await openExternalUrlWithFeedback(item.sourceUrl)
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
      event.shiftKey &&
      !event.repeat &&
      item?.type === 'note'
    ) {
      event.preventDefault()
      changeMode(getSplitToggleMode(mode, previousSingleModeRef.current))
      return
    }
    if (
      event.key.toLocaleLowerCase() === 'e' &&
      event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.repeat &&
      item?.type === 'note'
    ) {
      event.preventDefault()
      changeMode(toggleReadMarkdown(mode))
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
      mode !== 'read'
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
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-[var(--backdrop)]" />
          <Dialog.Popup
            onKeyDown={handleKeyDown}
            className="pointer-events-none fixed inset-0 z-50 outline-none"
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
                    leadingControls={
                      item.type === 'note' ? (
                        <NoteModeControls mode={mode} onModeChange={changeMode} />
                      ) : undefined
                    }
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
                      onDraftChange={(value) => coordinator?.updateDraft(value)}
                      onRetry={() => void coordinator?.retry()}
                      onRestore={() => coordinator?.restoreSaved()}
                      onReviewConflict={() => setConflictDialogOpen(true)}
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
