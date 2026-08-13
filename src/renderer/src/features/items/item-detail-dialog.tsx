import { Dialog } from '@base-ui/react/dialog'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import {
  IconAlignLeft as AlignLeft,
  IconArrowsDiagonal as ArrowsDiagonal,
  IconArrowsDiagonalMinimize as ArrowsDiagonalMinimize,
  IconCalendar as Calendar,
  IconChevronLeft as ChevronLeft,
  IconChevronRight as ChevronRight,
  IconCode as Code,
  IconColumns2 as Columns2,
  IconDimensions as Dimensions,
  IconEye as Eye,
  IconEyeEdit as EyeEdit,
  IconExternalLink as ExternalLink,
  IconFile as File,
  IconFileAlert as FileWarning,
  IconFileTypography as FileTypography,
  IconFolderOpen as FolderOpen,
  IconLink as Link,
  IconLoader2 as LoaderCircle,
  IconPhotoOff as ImageOff,
  IconPhoto as Image,
  IconPencil as Pencil,
  IconPlayerPlayFilled as Play,
  IconTrash as Trash,
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
import { ButtonGroup } from '@/components/ui/button-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
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
import {
  createInlineTitleEditState,
  reduceInlineTitleEdit,
  resolveInlineTitleSubmission
} from '@/features/items/item-title-edit'
import { MarkdownEditor, type MarkdownEditorHandle } from '@/features/items/markdown-editor'
import { type LivePreviewOptions } from '@/features/items/markdown-live-preview'
import { MarkdownPreview } from '@/features/items/markdown-preview'
import { NoteProperties } from '@/features/items/note-properties'
import {
  getScrollRatio,
  getScrollTopForRatio,
  hasMeaningfulScrollDelta
} from '@/features/items/markdown-scroll'
import { NoteAutosaveCoordinator, type NoteAutosaveSnapshot } from '@/features/items/note-autosave'
import {
  NOTE_INLINE_TITLE_STORAGE_KEY,
  parseNoteInlineTitle
} from '@/features/items/note-inline-title'
import type { NoteDetailMenuOptions } from '@/features/items/item-action-menu'
import {
  NOTE_READING_WIDTH_STORAGE_KEY,
  parseNoteReadingWidth,
  type NoteReadingWidth
} from '@/features/items/note-reading-width'
import {
  getSplitToggleMode,
  toggleReadLive,
  toggleSourceMode,
  type NoteMode,
  type SinglePaneNoteMode
} from '@/features/items/note-view-mode'
import { openExternalUrlWithFeedback } from '@/features/items/open-external-url'
import { useImagePreview } from '@/features/items/use-image-preview'
import { useNoteAttachmentPreviews } from '@/features/items/use-note-attachment-previews'
import { useUrlPreview } from '@/features/items/use-url-preview'
import { WindowControls } from '@/features/shell/window-controls'
import { cn } from '@/lib/utils'
import type {
  ActiveItemLocation,
  CollectionDto,
  LibraryItemDto
} from '../../../../shared/library-contract'
import { markdownImageTargetKey } from '../../../../shared/markdown-image-references'
import { parseNoteFrontmatter } from '../../../../shared/note-frontmatter'

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

export interface DetailTitleRenameResult {
  ok: boolean
  error?: string
}

function InlineItemTitle({
  item,
  onRename,
  className,
  textClassName,
  centered = false
}: {
  item: LibraryItemDto
  onRename: (title: string) => Promise<DetailTitleRenameResult>
  className?: string
  textClassName?: string
  centered?: boolean
}): React.JSX.Element {
  const [state, dispatch] = useReducer(
    reduceInlineTitleEdit,
    item.title,
    createInlineTitleEditState
  )
  const editorRef = useRef<HTMLSpanElement | null>(null)
  const initialDraft = useRef(item.title)
  const pendingRef = useRef(false)
  const cancelledByEscape = useRef(false)
  const focusEditor = useCallback((editor: HTMLSpanElement | null): void => {
    editorRef.current = editor
    if (!editor) return
    editor.textContent = initialDraft.current
    editor.focus()
    const range = document.createRange()
    range.selectNodeContents(editor)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, [])

  const cancel = (): void => {
    if (pendingRef.current) return
    cancelledByEscape.current = true
    dispatch({ type: 'cancel', title: item.title })
  }

  const commit = async (): Promise<void> => {
    if (pendingRef.current) return
    const resolution = resolveInlineTitleSubmission(
      item.title,
      editorRef.current?.textContent ?? state.draft
    )
    if (resolution.type === 'cancel') {
      dispatch({ type: 'cancel', title: item.title })
      return
    }

    pendingRef.current = true
    dispatch({ type: 'submit' })
    let result: DetailTitleRenameResult
    try {
      result = await onRename(resolution.title)
    } catch {
      result = { ok: false, error: 'The item could not be renamed.' }
    }
    pendingRef.current = false
    if (result.ok) {
      dispatch({ type: 'success', title: resolution.title })
      return
    }
    dispatch({ type: 'failure', error: result.error ?? 'The item could not be renamed.' })
    window.requestAnimationFrame(() => editorRef.current?.focus())
  }

  if (item.location.type === 'trash') {
    return <span className={cn(className, textClassName)}>{item.title}</span>
  }

  return (
    <div className={cn('min-w-0', centered && 'flex w-full flex-col items-center')}>
      {state.editing ? (
        <div
          className={cn('flex w-fit min-w-0 max-w-full', centered && 'justify-center')}
          onBlur={() => {
            if (cancelledByEscape.current) {
              cancelledByEscape.current = false
              return
            }
            void commit()
          }}
        >
          <span
            ref={focusEditor}
            role="textbox"
            contentEditable={state.pending ? false : 'plaintext-only'}
            suppressContentEditableWarning
            aria-label={`Rename ${item.title}`}
            aria-multiline="false"
            aria-disabled={state.pending || undefined}
            className={cn(
              '-my-2.5 block min-w-[1ch] max-w-full bg-transparent px-0 py-2.5 outline-none',
              className,
              textClassName,
              state.pending && 'cursor-wait opacity-60',
              centered && 'text-center'
            )}
            spellCheck
            aria-invalid={state.error ? true : undefined}
            onInput={(event) => {
              const editor = event.currentTarget
              const value = (editor.textContent ?? '').replace(/[\r\n]+/g, ' ').slice(0, 200)
              if (editor.textContent !== value) {
                editor.textContent = value
                const range = document.createRange()
                range.selectNodeContents(editor)
                range.collapse(false)
                const selection = window.getSelection()
                selection?.removeAllRanges()
                selection?.addRange(range)
              }
              dispatch({ type: 'change', value })
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.stopPropagation()
                void commit()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                cancel()
              }
            }}
          />
          <span className="sr-only" aria-live="polite">
            {state.pending
              ? 'Saving title'
              : 'Editing title. Press Enter to save or Escape to cancel.'}
          </span>
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            'group/title -my-2.5 flex max-w-full items-center gap-1.5 py-2.5 text-left outline-none',
            className,
            centered && 'justify-center text-center'
          )}
          aria-label={`Rename ${item.title}`}
          onClick={() => {
            cancelledByEscape.current = false
            initialDraft.current = item.title
            dispatch({ type: 'start', title: item.title })
          }}
        >
          <span className={cn('min-w-0', textClassName)} title={item.title}>
            {item.title}
          </span>
          <Pencil
            className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-visible/title:opacity-100"
            stroke={1.75}
            aria-hidden="true"
          />
        </button>
      )}
      {state.error ? (
        <p
          className={cn('mt-1 text-xs leading-4 text-destructive', centered && 'text-center')}
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
    </div>
  )
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
  pressed,
  onClick,
  children
}: {
  label: string
  disabled?: boolean
  pressed?: boolean
  onClick?: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <Button
          type="button"
          variant="ghost"
          className="size-10 aria-pressed:bg-muted aria-pressed:text-foreground"
          aria-label={label}
          disabled={disabled}
          aria-pressed={pressed}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function DetailToolbar({
  itemId,
  title,
  modeControls,
  actions,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onError,
  presentation,
  expanded = false,
  onExpandedChange,
  showClose = true
}: {
  itemId: string
  title: string
  modeControls?: React.ReactNode
  actions?: React.ReactNode
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onError: (message: string) => void
  presentation: 'dialog' | 'focus'
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  showClose?: boolean
}): React.JSX.Element {
  if (presentation === 'focus') {
    const isMac = window.electron.window.platform === 'darwin'
    const expandLabel = expanded ? 'Restore item rail' : 'Expand note'

    return (
      <header
        data-detail-focus-header
        className={cn(
          'pointer-events-none relative z-40 flex h-10 shrink-0 items-center justify-between',
          expanded && '!bg-background/50'
        )}
      >
        <div
          data-detail-focus-leading-actions
          className={cn(
            'pointer-events-auto flex items-center [&_button]:[-webkit-app-region:no-drag]',
            !expanded && 'group-data-[focus-single-pane=true]/focus-detail:hidden'
          )}
        >
          {onExpandedChange ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-10 text-muted-foreground"
                    aria-label={expandLabel}
                    aria-pressed={expanded}
                    onClick={() => onExpandedChange(!expanded)}
                  />
                }
              >
                <span className="relative size-4" aria-hidden="true">
                  <ArrowsDiagonal
                    stroke={1.5}
                    className={cn(
                      'absolute inset-0 size-4 transition-[opacity,scale,filter] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
                      expanded
                        ? 'scale-[0.25] opacity-0 blur-[4px]'
                        : 'scale-100 opacity-100 blur-0'
                    )}
                  />
                  <ArrowsDiagonalMinimize
                    stroke={1.5}
                    className={cn(
                      'absolute inset-0 size-4 transition-[opacity,scale,filter] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
                      expanded
                        ? 'scale-100 opacity-100 blur-0'
                        : 'scale-[0.25] opacity-0 blur-[4px]'
                    )}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>{expandLabel}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <p
          data-detail-focus-title
          className="absolute left-1/2 max-w-[min(32rem,calc(100%-28rem))] -translate-x-1/2 truncate px-4 text-center text-sm font-light max-[1080px]:hidden"
          title={title}
        >
          {title}
        </p>
        <div
          data-detail-focus-actions
          className={cn(
            'pointer-events-auto ml-auto flex min-w-0 items-center justify-end [&_button]:[-webkit-app-region:no-drag]',
            !isMac && 'pr-[8.625rem]'
          )}
        >
          {modeControls}
          {actions}
        </div>
      </header>
    )
  }
  const leadingControls = modeControls ? (
    <div className="flex items-center gap-2">{modeControls}</div>
  ) : null

  return (
    <header
      data-detail-utility-bar
      className={cn(
        'flex min-h-14 shrink-0 items-center gap-3 border-b bg-popover px-3',
        leadingControls ? 'justify-between' : 'justify-end'
      )}
    >
      {leadingControls}
      <div className="flex items-center rounded-xl bg-muted/40 p-1 shadow-sm ring-1 ring-foreground/8">
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
        {showClose ? (
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
        ) : null}
      </div>
    </header>
  )
}

function NoteModeControls({
  mode,
  onModeChange,
  surface = 'toolbar'
}: {
  mode: NoteMode
  onModeChange: (mode: NoteMode) => void
  surface?: 'toolbar' | 'caption'
}): React.JSX.Element {
  const options = [
    { value: 'read' as const, label: 'Read (Ctrl+E)', icon: Eye, shortcut: 'Control+E' },
    {
      value: 'live' as const,
      label: 'Live preview (Ctrl+E)',
      icon: EyeEdit,
      shortcut: 'Control+E'
    },
    {
      value: 'markdown' as const,
      label: 'Markdown source (Ctrl+Alt+E)',
      icon: Code,
      shortcut: 'Control+Alt+E'
    },
    {
      value: 'split' as const,
      label: 'Split view (Ctrl+Shift+E)',
      icon: Columns2,
      shortcut: 'Control+Shift+E'
    }
  ]

  if (surface === 'caption') {
    const activeOption = options.find((option) => option.value === mode) ?? options[0]
    const ActiveIcon = activeOption.icon

    return (
      <Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-10 text-muted-foreground"
                    aria-label={`Note mode: ${activeOption.label}`}
                  />
                }
              />
            }
          >
            <ActiveIcon stroke={1.5} aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Note view</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={mode}
                onValueChange={(value) => onModeChange(value as NoteMode)}
              >
                {options.map(({ value, label, icon: Icon, shortcut }) => (
                  <DropdownMenuRadioItem key={value} value={value} className="whitespace-nowrap">
                    <Icon aria-hidden="true" />
                    {label.replace(/ \(.+\)$/, '')}
                    <DropdownMenuShortcut>
                      {shortcut.replace('Control', 'Ctrl')}
                    </DropdownMenuShortcut>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <TooltipContent>{activeOption.label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <ButtonGroup
      aria-label="Note mode"
      className="rounded-xl bg-muted/40 p-1 shadow-sm ring-1 ring-foreground/8"
    >
      {options.map(({ value, label, icon: Icon, shortcut }) => (
        <Tooltip key={value}>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-10 text-muted-foreground first:rounded-l-lg! last:rounded-r-lg! aria-pressed:bg-muted aria-pressed:text-foreground"
                aria-label={label}
                aria-pressed={mode === value}
                aria-keyshortcuts={shortcut}
                onClick={() => onModeChange(value)}
              />
            }
          >
            <Icon stroke={1.5} aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </ButtonGroup>
  )
}
function NoteDocumentBlocks({
  item,
  markdown,
  showInlineTitle,
  showProperties,
  className,
  onRenameTitle,
  onDraftChange,
  onOpenSource,
  onError
}: {
  item: Extract<LibraryItemDto, { type: 'note' }>
  markdown: string
  showInlineTitle: boolean
  showProperties: boolean
  className?: string
  onRenameTitle: (title: string) => Promise<DetailTitleRenameResult>
  onDraftChange: (value: string) => void
  onOpenSource: () => void
  onError: (message: string) => void
}): React.JSX.Element | null {
  const frontmatter = parseNoteFrontmatter(markdown)
  const hasProperties =
    showProperties && frontmatter.status === 'valid' && frontmatter.properties.length > 0
  if (!showInlineTitle && !hasProperties) return null

  return (
    <div
      className={cn('not-typeset flex min-w-0 flex-col gap-8 font-sans', className)}
      data-not-typeset
    >
      {showInlineTitle ? (
        <InlineItemTitle
          item={item}
          onRename={onRenameTitle}
          className="font-heading text-3xl leading-tight font-semibold text-foreground text-balance"
          textClassName="break-words"
        />
      ) : null}
      {hasProperties ? (
        <NoteProperties
          value={markdown}
          onChange={onDraftChange}
          onOpenSource={onOpenSource}
          onError={onError}
        />
      ) : null}
    </div>
  )
}

function NoteDetailsDialog({
  item,
  open,
  onOpenChange
}: {
  item: Extract<LibraryItemDto, { type: 'note' }>
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  return (
    <ConflictDialog open={open} onOpenChange={onOpenChange}>
      <ConflictDialogContent className="sm:max-w-md">
        <ConflictDialogHeader>
          <ConflictDialogTitle>Note details</ConflictDialogTitle>
          <ConflictDialogDescription>
            System information stored outside YAML properties.
          </ConflictDialogDescription>
        </ConflictDialogHeader>
        <dl className="flex flex-col gap-1 text-sm">
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-xl px-2 py-1.5">
            <dt className="text-muted-foreground">Created</dt>
            <dd className="tabular-nums">{formatDate(item.createdAt)}</dd>
          </div>
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-xl px-2 py-1.5">
            <dt className="text-muted-foreground">Updated</dt>
            <dd className="tabular-nums">{formatDate(item.updatedAt)}</dd>
          </div>
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-xl px-2 py-1.5">
            <dt className="text-muted-foreground">File</dt>
            <dd className="break-all">{item.relativePath}</dd>
          </div>
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-xl px-2 py-1.5">
            <dt className="text-muted-foreground">Files</dt>
            <dd className="tabular-nums">
              {item.attachments.length}{' '}
              {item.attachments.length === 1 ? 'attachment' : 'attachments'}
            </dd>
          </div>
        </dl>
      </ConflictDialogContent>
    </ConflictDialog>
  )
}

function MissingContent({
  type,
  onMoveToTrash
}: {
  type: 'file' | 'image' | 'note'
  onMoveToTrash?: () => void
}): React.JSX.Element {
  return (
    <div className="flex max-w-xs flex-col items-center gap-3 px-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <FileWarning className="size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {type === 'note'
            ? 'Note file is missing'
            : `${type === 'image' ? 'Image' : 'File'} is missing`}
        </p>
        <p className="text-pretty text-xs leading-5 text-muted-foreground">
          Kuskus kept the item, but its stored content is no longer in the library.
        </p>
      </div>
      {onMoveToTrash ? (
        <Button variant="secondary" size="sm" onClick={onMoveToTrash}>
          <Trash className="size-4" aria-hidden="true" />
          Move to Trash
        </Button>
      ) : null}
    </div>
  )
}

function ImageCanvas({
  item,
  onMoveToTrash
}: {
  item: Extract<LibraryItemDto, { type: 'image' }>
  onMoveToTrash?: () => void
}): React.JSX.Element {
  const { preview, previewError } = useImagePreview(item.id, item.missingContent)

  return (
    <section className="flex min-h-64 min-w-0 items-center justify-center overflow-hidden bg-white p-5 dark:bg-black @min-[860px]/detail:min-h-0 @min-[860px]/detail:p-10">
      {item.missingContent ? (
        <MissingContent type="image" onMoveToTrash={onMoveToTrash} />
      ) : preview ? (
        <img
          src={preview}
          alt={item.title}
          width={item.width}
          height={item.height}
          className="max-h-full max-w-full rounded-sm object-contain shadow-[0_20px_60px_-36px_rgb(0_0_0/0.8)] outline -outline-offset-1 outline-black/10 dark:outline-white/10"
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
    <section className="relative flex min-h-64 min-w-0 items-center justify-center overflow-hidden bg-muted/25 p-5 @min-[860px]/detail:min-h-0 @min-[860px]/detail:p-10">
      {preview.preview ? (
        <img
          src={preview.preview}
          alt=""
          className="max-h-full max-w-full rounded-md object-contain shadow-[0_24px_72px_-40px_rgb(0_0_0/0.8)] outline -outline-offset-1 outline-black/10 dark:outline-white/10"
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
  readingWidth,
  showInlineTitle,
  onRenameTitle,
  onDraftChange,
  onModeChange,
  onRetry,
  onRestore,
  onReviewConflict,
  onOpenVaultLink,
  onError,
  onMoveToTrash
}: {
  item: Extract<LibraryItemDto, { type: 'note' }>
  mode: NoteMode
  snapshot: NoteAutosaveSnapshot
  readingWidth: NoteReadingWidth
  showInlineTitle: boolean
  onRenameTitle: (title: string) => Promise<DetailTitleRenameResult>
  onDraftChange: (value: string) => void
  onModeChange: (mode: NoteMode) => void
  onRetry: () => void
  onRestore: () => void
  onReviewConflict: () => void
  onOpenVaultLink: (target: string) => void
  onMoveToTrash: (itemId: string) => void
  onError: (message: string) => void
}): React.JSX.Element {
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const previewViewportRef = useRef<HTMLDivElement>(null)
  const previousModeRef = useRef<NoteMode>(mode)
  const activeScrollDriverRef = useRef<'source' | 'preview'>(mode === 'read' ? 'preview' : 'source')
  const pendingScrollDriverRef = useRef<'source' | 'preview' | null>(null)
  const programmaticScrollTargetRef = useRef<'source' | 'preview' | null>(null)
  const syncFrameRef = useRef<number | null>(null)
  const releaseSyncFrameRef = useRef<number | null>(null)
  const attachmentPreviews = useNoteAttachmentPreviews(item.id, item.attachments)
  const frontmatter = useMemo(() => parseNoteFrontmatter(snapshot.draft), [snapshot.draft])
  const hasProperties = frontmatter.status === 'valid' && frontmatter.properties.length > 0
  const liveHiddenRange = useMemo(
    () => (frontmatter.status === 'valid' ? { from: 0, to: frontmatter.endOffset } : undefined),
    [frontmatter]
  )
  const editorTopContent =
    showInlineTitle || (mode === 'live' && hasProperties) ? (
      <NoteDocumentBlocks
        item={item}
        markdown={snapshot.draft}
        showInlineTitle={showInlineTitle}
        showProperties={mode === 'live'}
        className="pb-8"
        onRenameTitle={onRenameTitle}
        onDraftChange={onDraftChange}
        onOpenSource={() => onModeChange('markdown')}
        onError={onError}
      />
    ) : undefined

  const noteAttachments = item.attachments
  const onOpenVaultLinkRef = useRef(onOpenVaultLink)
  useEffect(() => {
    onOpenVaultLinkRef.current = onOpenVaultLink
  }, [onOpenVaultLink])
  const liveOptions = useMemo<LivePreviewOptions>(() => {
    const images = new Map<
      string,
      { attachment: (typeof noteAttachments)[number]; preview: string | null }
    >()
    for (const attachment of noteAttachments) {
      const entry = { attachment, preview: attachmentPreviews[attachment.id] ?? null }
      images.set(markdownImageTargetKey(attachment.relativePath), entry)
      images.set(markdownImageTargetKey(attachment.filename), entry)
    }
    return {
      resolveImage: (target) => {
        const entry = images.get(markdownImageTargetKey(target))
        if (!entry) return null
        return {
          src: entry.preview,
          missing: entry.attachment.missingContent,
          label: entry.attachment.filename
        }
      },
      onOpenLink: (url) => void openExternalUrlWithFeedback(url),
      onOpenVaultLink: (target) => onOpenVaultLinkRef.current(target),
      hiddenRange: liveHiddenRange
    }
  }, [attachmentPreviews, liveHiddenRange, noteAttachments])

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

  useLayoutEffect(() => {
    if (mode === 'read') {
      const preview = previewViewportRef.current
      if (preview) {
        preview.tabIndex = 0
        preview.focus({ preventScroll: true })
      }
    } else if (mode === 'live' || mode === 'markdown') {
      editorRef.current?.focus()
    }
  }, [mode])

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
    <div className="flex h-full min-w-0 flex-1 flex-col" data-reading-width={readingWidth}>
      {item.missingContent ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <MissingContent type="note" onMoveToTrash={() => onMoveToTrash(item.id)} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {snapshot.error ? (
            <div className="kuskus-detail-document-frame shrink-0 pt-2">
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
                  {snapshot.status === 'error' ? (
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
              mode === 'split' && '@min-[860px]/detail:grid-cols-2'
            )}
          >
            <div className={cn('min-h-0 min-w-0', mode === 'read' ? 'hidden' : 'flex')}>
              <MarkdownEditor
                ref={editorRef}
                value={snapshot.draft}
                active={mode !== 'read'}
                live={mode === 'live'}
                liveOptions={liveOptions}
                topContent={editorTopContent}
                hiddenRange={mode === 'live' ? liveHiddenRange : undefined}
                onChange={(value) => {
                  activeScrollDriverRef.current = 'source'
                  onDraftChange(value)
                }}
                onScroll={() => scheduleScrollSynchronization('source')}
              />
            </div>
            <ScrollArea
              ref={(root) => {
                previewViewportRef.current =
                  root?.querySelector<HTMLDivElement>('[data-slot="scroll-area-viewport"]') ?? null
              }}
              className={cn(
                'min-h-0 min-w-0 [&_[data-slot=scroll-area-viewport]]:focus-visible:ring-0 [&_[data-slot=scroll-area-viewport]]:focus-visible:outline-none',
                mode === 'read' && 'flex',
                mode === 'live' && 'hidden',
                mode === 'markdown' && 'hidden',
                mode === 'split' && 'hidden @min-[860px]/detail:flex'
              )}
            >
              <article className="kuskus-detail-document-frame min-h-full w-full py-8">
                <NoteDocumentBlocks
                  item={item}
                  markdown={snapshot.draft}
                  showInlineTitle={showInlineTitle}
                  showProperties
                  className="mb-8"
                  onRenameTitle={onRenameTitle}
                  onDraftChange={onDraftChange}
                  onOpenSource={() => onModeChange('markdown')}
                  onError={onError}
                />
                <MarkdownPreview
                  value={snapshot.draft}
                  itemId={item.id}
                  attachments={item.attachments}
                  attachmentPreviews={attachmentPreviews}
                  presentation="detail"
                  onOpenLink={(url) => void openExternalUrlWithFeedback(url)}
                  onOpenVaultLink={onOpenVaultLink}
                  onTaskToggle={onDraftChange}
                />
              </article>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  )
}

function NoteAttachmentRow({
  attachment,
  item,
  referenceCount,
  onRename,
  onError
}: {
  attachment: Extract<LibraryItemDto, { type: 'note' }>['attachments'][number]
  item: Extract<LibraryItemDto, { type: 'image' }> | null
  referenceCount: number
  onRename: () => void
  onError: (message: string) => void
}): React.JSX.Element {
  const preview = useImagePreview(item?.id ?? attachment.id, !item || attachment.missingContent)
  return (
    <li className="flex min-w-0 gap-3 rounded-xl bg-muted/45 p-2 shadow-[inset_0_0_0_1px_color-mix(in_oklab,currentColor_6%,transparent)]">
      {preview.preview ? (
        <img
          className="size-14 shrink-0 rounded object-cover outline -outline-offset-1 outline-black/10 dark:outline-white/10"
          src={preview.preview}
          alt=""
        />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded bg-background/70 text-muted-foreground shadow-sm">
          {attachment.missingContent ? (
            <ImageOff className="size-5" aria-hidden="true" />
          ) : (
            <Image className="size-5" aria-hidden="true" />
          )}
        </span>
      )}
      <div className="min-w-0 flex-1 py-0.5">
        <p className="truncate text-sm font-medium" title={attachment.filename}>
          {attachment.filename}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={attachment.relativePath}>
          {attachment.relativePath}
        </p>
        <p className="mt-1 text-[0.6875rem] text-muted-foreground tabular-nums">
          {attachment.missingContent
            ? 'Missing image'
            : referenceCount > 1
              ? `Shared by ${referenceCount} notes`
              : item
                ? 'Used by this note'
                : 'Untracked vault image'}
        </p>
      </div>
      <div className="flex shrink-0 items-start">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-10"
          aria-label={`Rename ${attachment.filename}`}
          disabled={!item || attachment.missingContent}
          onClick={onRename}
        >
          <Pencil aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-10"
          aria-label={`Show ${attachment.filename} in Explorer`}
          disabled={!item || attachment.missingContent}
          onClick={() => {
            if (!item) return
            void window.kuskus.showItemInExplorer(item.id).then((result) => {
              if (!result.ok) onError(result.error)
            })
          }}
        >
          <FolderOpen aria-hidden="true" />
        </Button>
      </div>
    </li>
  )
}

function NoteAttachmentsPanel({
  note,
  libraryItems,
  onClose,
  onRename,
  onError
}: {
  note: Extract<LibraryItemDto, { type: 'note' }>
  libraryItems: readonly LibraryItemDto[]
  onClose: () => void
  onRename: (itemId: string) => void
  onError: (message: string) => void
}): React.JSX.Element {
  const imageItems = new Map(
    libraryItems
      .filter((item): item is Extract<LibraryItemDto, { type: 'image' }> => item.type === 'image')
      .map((item) => [item.id, item])
  )
  const referenceCounts = new Map<string, number>()
  for (const item of libraryItems) {
    if (item.type !== 'note') continue
    for (const attachment of item.attachments) {
      referenceCounts.set(attachment.id, (referenceCounts.get(attachment.id) ?? 0) + 1)
    }
  }
  return (
    <aside
      data-detail-structural-surface
      className="absolute inset-y-0 right-0 z-10 flex w-80 shrink-0 flex-col border-l bg-popover shadow-xl @min-[860px]/detail:static @min-[860px]/detail:shadow-none"
    >
      <header className="flex min-h-16 items-center gap-3 px-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">Attachments</h2>
          <p className="text-xs text-muted-foreground tabular-nums">
            {note.attachments.length} {note.attachments.length === 1 ? 'image' : 'images'}
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-10"
          aria-label="Close attachments"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </Button>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="space-y-2 p-3 pt-1">
          {note.attachments.map((attachment) => {
            const image = imageItems.get(attachment.id) ?? null
            return (
              <NoteAttachmentRow
                key={`${attachment.id}-${attachment.relativePath}`}
                attachment={attachment}
                item={image}
                referenceCount={referenceCounts.get(attachment.id) ?? 1}
                onRename={() => image && onRename(image.id)}
                onError={onError}
              />
            )
          })}
        </ul>
      </ScrollArea>
    </aside>
  )
}

function DetailInspector({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <aside className="min-w-0 border-t @min-[860px]/detail:border-t-0 @min-[860px]/detail:border-l">
      <div className="flex flex-col gap-6 p-6">{children}</div>
    </aside>
  )
}

function ImageInspector({
  item,
  onRenameTitle
}: {
  item: Extract<LibraryItemDto, { type: 'image' }>
  onRenameTitle: (title: string) => Promise<DetailTitleRenameResult>
}): React.JSX.Element {
  return (
    <DetailInspector>
      <InlineItemTitle
        item={item}
        onRename={onRenameTitle}
        className="text-2xl leading-8 font-semibold tracking-tight text-balance"
        textClassName="break-words"
      />
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
    </DetailInspector>
  )
}

function FileCanvas({
  item,
  onMoveToTrash
}: {
  item: Extract<LibraryItemDto, { type: 'file' }>
  onMoveToTrash: () => void
}): React.JSX.Element {
  return (
    <section className="flex min-h-64 min-w-0 items-center justify-center overflow-hidden bg-muted/25 p-8 @min-[860px]/detail:min-h-0">
      {item.missingContent ? (
        <MissingContent type="file" onMoveToTrash={onMoveToTrash} />
      ) : (
        <div className="flex max-w-md flex-col items-center gap-5 text-center">
          <span className="flex size-24 items-center justify-center rounded-3xl bg-background/75 text-muted-foreground shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_12px_32px_-20px_rgb(0_0_0/0.45)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.08)]">
            <File className="size-10" stroke={1.5} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="break-words text-sm font-medium">{item.contentFilename}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.mediaType || 'Unknown type'}</p>
          </div>
        </div>
      )}
    </section>
  )
}

function FileInspector({
  item,
  onRenameTitle
}: {
  item: Extract<LibraryItemDto, { type: 'file' }>
  onRenameTitle: (title: string) => Promise<DetailTitleRenameResult>
}): React.JSX.Element {
  return (
    <DetailInspector>
      <InlineItemTitle
        item={item}
        onRename={onRenameTitle}
        className="text-2xl leading-8 font-semibold tracking-tight text-balance"
        textClassName="break-words"
      />
      <PropertyList>
        <PropertyRow icon={File} label="File name" valueClassName="break-words">
          {item.sourceFilename || item.contentFilename}
        </PropertyRow>
        <PropertyRow icon={FileTypography} label="Type" valueClassName="break-words">
          {item.mediaType || 'Unknown'}
        </PropertyRow>
        <PropertyRow icon={Calendar} label="Added" valueClassName="tabular-nums">
          <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
        </PropertyRow>
      </PropertyList>
    </DetailInspector>
  )
}

function UrlInspector({
  item,
  onRenameTitle,
  onOpenLink
}: {
  item: Extract<LibraryItemDto, { type: 'url' }>
  onRenameTitle: (title: string) => Promise<DetailTitleRenameResult>
  onOpenLink: () => void
}): React.JSX.Element {
  return (
    <DetailInspector>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <Globe2 className="size-4 shrink-0" stroke={1.5} aria-hidden="true" />
          <span className="truncate">{item.domain}</span>
        </p>
        <InlineItemTitle
          item={item}
          onRename={onRenameTitle}
          className="text-2xl leading-8 font-semibold tracking-tight text-balance"
          textClassName="break-words"
        />
      </div>
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
    </DetailInspector>
  )
}

export interface ItemDetailHandle {
  requestTransition: (action: () => void) => void
  flush: () => Promise<boolean>
}

interface ItemDetailProps {
  item: LibraryItemDto | null
  collections: readonly CollectionDto[]
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onOpenChange: (open: boolean) => void
  onItemUpdated: (item: LibraryItemDto) => void
  onRenameItem: (item: LibraryItemDto, title: string) => Promise<DetailTitleRenameResult>
  libraryItems: readonly LibraryItemDto[]
  onRenameAttachment: (itemId: string) => void
  renderActions?: (
    guard: (action: () => void) => void,
    detailOptions?: NoteDetailMenuOptions
  ) => React.ReactNode
  onOpenVaultLink: (target: string) => void
  onMoveItem: (destination: ActiveItemLocation) => void
  onMoveToTrash: (itemId: string) => void
  onEmptyNote: (itemId: string) => Promise<boolean>
  onError: (message: string) => void
  presentation?: 'dialog' | 'focus'
  initialNoteMode?: NoteMode
  expanded?: boolean
  expandable?: boolean
  onExpandedChange?: (expanded: boolean) => void
}

export const ItemDetailDialog = forwardRef<ItemDetailHandle, ItemDetailProps>(
  function ItemDetailDialog(
    {
      item,
      hasPrevious,
      hasNext,
      onPrevious,
      onNext,
      onOpenChange,
      onItemUpdated,
      onRenameItem,
      libraryItems,
      onRenameAttachment,
      renderActions,
      onOpenVaultLink,
      onMoveToTrash,
      onEmptyNote,
      onError,
      initialNoteMode = 'read',
      expanded = false,
      expandable = true,
      onExpandedChange,
      presentation = 'dialog'
    },
    ref
  ): React.JSX.Element {
    const [openedNote] = useState(() => (item?.type === 'note' ? item : null))
    const coordinator = useMemo(
      () =>
        openedNote
          ? new NoteAutosaveCoordinator({
              itemId: openedNote.id,
              initialMarkdown: openedNote.body,
              initialUpdatedAt: openedNote.updatedAt,
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
      savedUpdatedAt: '',
      error: null,
      conflict: null
    })
    const snapshot = useSyncExternalStore(
      coordinator?.subscribe ?? (() => () => undefined),
      coordinator?.getSnapshot ?? (() => fallbackSnapshot.current)
    )
    const [mode, setMode] = useState<NoteMode>(initialNoteMode)
    const previousSingleModeRef = useRef<SinglePaneNoteMode>(
      initialNoteMode === 'split' ? 'read' : initialNoteMode
    )
    const [leaving, setLeaving] = useState(false)
    const [readingWidth, setReadingWidth] = useState<NoteReadingWidth>(() =>
      parseNoteReadingWidth(localStorage.getItem(NOTE_READING_WIDTH_STORAGE_KEY))
    )
    const [showInlineTitle, setShowInlineTitle] = useState(() =>
      parseNoteInlineTitle(localStorage.getItem(NOTE_INLINE_TITLE_STORAGE_KEY))
    )
    const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
    const [conflictResolution, setConflictResolution] = useState<'mine' | 'disk' | null>(null)
    const [attachmentsOpen, setAttachmentsOpen] = useState(false)
    const [noteDetailsOpen, setNoteDetailsOpen] = useState(false)
    const changeExpanded = (nextExpanded: boolean): void => {
      if (nextExpanded) setAttachmentsOpen(false)
      onExpandedChange?.(nextExpanded)
    }

    const diffRows = useMemo(
      () =>
        snapshot.conflict ? createMarkdownDiffRows(snapshot.draft, snapshot.conflict.body) : [],
      [snapshot.conflict, snapshot.draft]
    )

    useEffect(() => () => coordinator?.dispose(), [coordinator])
    useEffect(() => {
      localStorage.setItem(NOTE_READING_WIDTH_STORAGE_KEY, readingWidth)
    }, [readingWidth])
    useEffect(() => {
      localStorage.setItem(NOTE_INLINE_TITLE_STORAGE_KEY, String(showInlineTitle))
    }, [showInlineTitle])
    useEffect(() => {
      if (mode !== 'split') previousSingleModeRef.current = mode
    }, [mode])
    useEffect(() => {
      if (item?.type !== 'note' || !coordinator) return
      const current = coordinator.getSnapshot()
      if (item.body === current.draft) {
        coordinator.acceptDiskVersion(item)
        return
      }
      if (coordinator.hasPendingChanges() || !coordinator.acceptDiskVersion(item)) {
        onItemUpdated({
          ...item,
          body: current.draft,
          updatedAt: current.savedUpdatedAt || item.updatedAt
        })
      }
    }, [coordinator, item, onItemUpdated])
    const changeMode = (nextMode: NoteMode): void => {
      if (nextMode !== mode) setMode(nextMode)
    }
    const toggleReadLiveMode = (): void => {
      setMode(toggleReadLive)
    }

    const resolvePendingNote = useCallback(async (): Promise<'ready' | 'trashed' | 'blocked'> => {
      if (leaving) return 'blocked'
      if (!coordinator) return 'ready'
      const current = coordinator.getSnapshot()
      if (!coordinator.hasPendingChanges() && current.draft.trim()) return 'ready'
      setLeaving(true)
      try {
        const saved = await coordinator.flush()
        if (saved || coordinator.getSnapshot().draft.trim()) {
          return saved ? 'ready' : 'blocked'
        }
        const settled = coordinator.getSnapshot()
        if (settled.status === 'error' || settled.status === 'conflict') return 'blocked'
        return (await onEmptyNote(openedNote!.id)) ? 'trashed' : 'blocked'
      } finally {
        setLeaving(false)
      }
    }, [coordinator, leaving, onEmptyNote, openedNote])

    const flushPendingNote = useCallback(
      async (): Promise<boolean> => (await resolvePendingNote()) !== 'blocked',
      [resolvePendingNote]
    )

    const requestGuardedAction = useCallback(
      (action: () => void): void => {
        void resolvePendingNote().then((resolution) => {
          if (resolution !== 'blocked') action()
        })
      },
      [resolvePendingNote]
    )

    const requestGuardedItemAction = useCallback(
      (action: () => void): void => {
        void resolvePendingNote().then((resolution) => {
          if (resolution === 'ready') action()
        })
      },
      [resolvePendingNote]
    )

    useImperativeHandle(
      ref,
      () => ({ requestTransition: requestGuardedAction, flush: flushPendingNote }),
      [flushPendingNote, requestGuardedAction]
    )

    const renameCurrentItem = async (title: string): Promise<DetailTitleRenameResult> => {
      if (!item) return { ok: false, error: 'The item is no longer available.' }
      const resolution = await resolvePendingNote()
      if (resolution !== 'ready') {
        return {
          ok: false,
          error:
            resolution === 'trashed'
              ? 'The empty note was moved to Trash.'
              : (snapshot.error ?? 'Save the note before renaming it.')
        }
      }
      return onRenameItem(item, title)
    }

    const openLink = async (): Promise<void> => {
      if (item?.type !== 'url') return
      await openExternalUrlWithFeedback(item.sourceUrl)
    }

    const handleKeyDown = (event: React.KeyboardEvent): void => {
      if (event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      const isEditingTarget = Boolean(target?.closest('input, textarea, [contenteditable="true"]'))
      if (event.key === 'Escape' && expanded && !isEditingTarget) {
        event.preventDefault()
        changeExpanded(false)
        return
      }
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
        event.altKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.repeat &&
        item?.type === 'note'
      ) {
        event.preventDefault()
        changeMode(toggleSourceMode(mode))
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
        toggleReadLiveMode()
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

    const detailContent = item ? (
      <div data-detail-content-stack className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <DetailToolbar
          itemId={item.id}
          title={item.title}
          expanded={expanded}
          onExpandedChange={
            expandable && item.type === 'note' && !item.missingContent ? changeExpanded : undefined
          }
          modeControls={
            item.type === 'note' ? (
              <NoteModeControls
                mode={mode}
                onModeChange={changeMode}
                surface={presentation === 'focus' ? 'caption' : 'toolbar'}
              />
            ) : undefined
          }
          actions={renderActions?.(
            requestGuardedItemAction,
            item.type === 'note'
              ? {
                  inlineTitle: showInlineTitle,
                  readableLineLength: readingWidth === 'comfortable',
                  onInlineTitleChange: setShowInlineTitle,
                  onReadableLineLengthChange: (checked) =>
                    setReadingWidth(checked ? 'comfortable' : 'wide'),
                  onManageAttachments: () => setAttachmentsOpen(true),
                  onShowDetails: () => setNoteDetailsOpen(true)
                }
              : undefined
          )}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
          onPrevious={() => requestGuardedAction(onPrevious)}
          onNext={() => requestGuardedAction(onNext)}
          onError={onError}
          presentation={presentation}
          showClose={presentation === 'dialog'}
        />
        <section
          data-detail-pane
          data-detail-structural-surface
          className={cn(
            'window-canvas relative flex min-h-0 min-w-0 flex-1 overflow-hidden !bg-background/50',
            !expanded && 'rounded-tl-2xl border-t border-l border-border'
          )}
        >
          {item.type === 'note' ? (
            <div className="relative flex min-h-0 min-w-0 flex-1">
              <NoteCanvas
                item={item}
                mode={mode}
                snapshot={snapshot}
                showInlineTitle={showInlineTitle}
                onRenameTitle={renameCurrentItem}
                onDraftChange={(value) => {
                  coordinator?.updateDraft(value)
                  onItemUpdated({ ...item, body: value })
                }}
                onModeChange={changeMode}
                readingWidth={readingWidth}
                onRetry={() => void coordinator?.retry()}
                onRestore={() => coordinator?.restoreSaved()}
                onError={onError}
                onReviewConflict={() => setConflictDialogOpen(true)}
                onOpenVaultLink={(target) => requestGuardedAction(() => onOpenVaultLink(target))}
                onMoveToTrash={(itemId) => requestGuardedAction(() => onMoveToTrash(itemId))}
              />
              {noteDetailsOpen ? (
                <NoteDetailsDialog
                  item={item}
                  open={noteDetailsOpen}
                  onOpenChange={setNoteDetailsOpen}
                />
              ) : null}
              {attachmentsOpen ? (
                <NoteAttachmentsPanel
                  note={item}
                  libraryItems={libraryItems}
                  onClose={() => setAttachmentsOpen(false)}
                  onRename={(itemId) => requestGuardedAction(() => onRenameAttachment(itemId))}
                  onError={onError}
                />
              ) : null}
            </div>
          ) : (
            <ScrollArea className="min-h-0 min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]]:focus-visible:ring-0 [&_[data-slot=scroll-area-viewport]]:focus-visible:outline-none">
              <div className="min-h-full min-w-0 @min-[860px]/detail:grid @min-[860px]/detail:grid-cols-[minmax(0,1fr)_20rem]">
                {item.type === 'image' ? (
                  <>
                    <ImageCanvas
                      item={item}
                      onMoveToTrash={() => requestGuardedAction(() => onMoveToTrash(item.id))}
                    />
                    <ImageInspector item={item} onRenameTitle={renameCurrentItem} />
                  </>
                ) : item.type === 'url' ? (
                  <>
                    <UrlCanvas item={item} />
                    <UrlInspector
                      item={item}
                      onRenameTitle={renameCurrentItem}
                      onOpenLink={() => void openLink()}
                    />
                  </>
                ) : (
                  <>
                    <FileCanvas
                      item={item}
                      onMoveToTrash={() => requestGuardedAction(() => onMoveToTrash(item.id))}
                    />
                    <FileInspector item={item} onRenameTitle={renameCurrentItem} />
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </section>
      </div>
    ) : null

    return (
      <>
        {presentation === 'dialog' ? (
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
                  <WindowControls
                    onClose={() => requestGuardedAction(window.electron.window.close)}
                  />
                </div>
                <div className="@container/detail pointer-events-auto fixed top-16 left-1/2 flex h-[calc(100vh-5rem)] max-h-[60rem] w-[calc(100vw-2rem)] max-w-[90rem] -translate-x-1/2 overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-white/10">
                  {item ? (
                    <>
                      <Dialog.Title className="sr-only">{item.title}</Dialog.Title>
                      <Dialog.Description className="sr-only">
                        {item.type === 'note' ? 'Editable note details' : 'Item details'} for{' '}
                        {item.title}. Use the arrow keys to move between visible items.
                      </Dialog.Description>
                      {detailContent}
                    </>
                  ) : null}
                </div>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        ) : (
          <section
            data-detail-surface
            data-detail-presentation="focus"
            className="@container/detail relative flex size-full min-h-0 min-w-0 overflow-hidden bg-transparent text-popover-foreground outline-none"
            aria-label={item ? `Item details for ${item.title}` : 'Item details'}
            onKeyDown={handleKeyDown}
          >
            {detailContent}
          </section>
        )}
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
                {conflictResolution === 'mine'
                  ? 'Replace the disk version?'
                  : 'Replace your draft?'}
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
)
