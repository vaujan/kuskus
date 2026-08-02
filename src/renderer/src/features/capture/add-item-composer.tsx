import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  IconAlertCircle,
  IconDots,
  IconFile,
  IconLink,
  IconLoader2,
  IconPhoto,
  IconPhotoPlus,
  IconRefresh,
  IconTrash,
  IconX
} from '@tabler/icons-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Kbd } from '@/components/ui/kbd'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ItemCard, ItemCardCaption, ItemCardSurface } from '@/features/items/item-card'
import { SavedItemCard } from '@/features/items/saved-item-card'
import type { LibraryView } from '@/features/items/item-view'
import { composeMarkdownCapture, detectCaptureKind } from '@/features/capture/capture-detection'
import { useCaptureSession } from '@/features/capture/use-capture-session'
import { useCaptureQueue } from '@/features/capture/use-capture-queue'
import { cn } from '@/lib/utils'
import type { CaptureSurface } from '../../../../shared/capture-contract'
import type {
  ActiveItemLocation,
  CaptureDraftFileDto,
  CaptureDraftImageDto,
  LibraryItemDto,
  UrlItemDto
} from '../../../../shared/library-contract'
import {
  encodeMarkdownImageTarget,
  normalizeStagedAttachmentMarkdown,
  removeStagedAttachmentMarkdown
} from '../../../../shared/markdown-image-references'

export type ImportRequest =
  { id: number; file: File } | { id: number; url: string } | { id: number; text: string }

const MORPH_DURATION_MS = 180
const LINK_SAVE_MINIMUM_MS = 500
const LINK_SAVE_TIMEOUT_MS = 12_000
const MORPH_STYLE = {
  '--capture-morph-duration': `${MORPH_DURATION_MS}ms`
} as CSSProperties

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function SavingLinkCard({
  domain,
  phase,
  view
}: {
  domain: string
  phase: 'saving' | 'preview'
  view: LibraryView
}): React.JSX.Element {
  return (
    <ItemCard aria-busy="true">
      <ItemCardSurface
        className={view === 'grid' || view === 'table' ? 'h-64 bg-muted' : 'aspect-[16/9] bg-muted'}
      >
        <div
          key={phase}
          className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center opacity-100 transition-opacity [transition-duration:var(--motion-duration-press)] [transition-timing-function:var(--motion-ease-out)] starting:opacity-0 motion-reduce:transition-none"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-background/70 text-muted-foreground shadow-sm">
            {phase === 'saving' ? (
              <IconLink className="size-5" aria-hidden="true" />
            ) : (
              <IconLoader2
                className="size-5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {phase === 'saving' ? 'Saving link' : 'Preparing preview'}
            </p>
            <p className="text-pretty text-xs leading-5 text-muted-foreground">
              {phase === 'saving' ? 'Adding it to your library…' : domain}
            </p>
          </div>
        </div>
      </ItemCardSurface>
      <ItemCardCaption className="min-h-14">
        <span className="truncate">{domain}</span>
      </ItemCardCaption>
    </ItemCard>
  )
}

function markdownImage(attachment: CaptureDraftImageDto): string {
  const alt = (attachment.sourceFilename ?? attachment.filename)
    .replace(/\.[^.]+$/, '')
    .replaceAll('[', '')
    .replaceAll(']', '')
  return `![${alt || 'Image'}](${encodeMarkdownImageTarget(attachment.relativePath)})`
}

function DraftImage({ attachment }: { attachment: CaptureDraftImageDto }): React.JSX.Element {
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (attachment.missingContent) return
    let active = true
    let objectUrl: string | null = null
    void window.kuskus.getCaptureDraftImagePreview(attachment.id).then((result) => {
      if (!active || !result.ok) return
      objectUrl = URL.createObjectURL(
        new Blob([result.data.bytes], { type: result.data.mediaType })
      )
      setPreview(objectUrl)
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment.id, attachment.missingContent])

  return attachment.missingContent || !preview ? (
    <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      <IconPhoto className="size-5" aria-hidden="true" />
    </span>
  ) : (
    <img
      className="size-16 shrink-0 rounded-lg object-cover outline -outline-offset-1 outline-black/10 dark:outline-white/10"
      src={preview}
      alt=""
    />
  )
}

export function AddItemComposer({
  open,
  focusRequest,
  discardRequest,
  libraryId,
  destination = { type: 'inbox' },
  surface = 'main',
  draftStorageKey,
  importRequest,
  view,
  onOpenChange,
  onImportRequestHandled,
  onCreated,
  onLinkCommitted,
  onLinkReleased,
  onStatus,
  onDraftStateChange,
  onTransientWorkChange,
  completionDelayMs = MORPH_DURATION_MS,
  completeLinkAfterLocalSave = false,
  dismissNoteInBackground = false,
  onFileDialogActiveChange
}: {
  open: boolean
  focusRequest: number
  discardRequest: number
  libraryId: string
  destination?: ActiveItemLocation
  surface?: CaptureSurface
  draftStorageKey?: string
  importRequest: ImportRequest | null
  view: LibraryView
  onOpenChange: (open: boolean) => void
  onImportRequestHandled: (id: number) => void
  onCreated: (item: LibraryItemDto) => boolean | Promise<boolean>
  onLinkCommitted: (item: UrlItemDto) => Promise<{ item: UrlItemDto; remainsVisible: boolean }>
  onLinkUpdated: (item: UrlItemDto) => void
  onLinkReleased: (itemId: string) => void
  onStatus: (message: string) => void
  onDraftStateChange: (hasDraft: boolean) => void
  onTransientWorkChange: (hasTransientWork: boolean) => void
  completionDelayMs?: number
  completeLinkAfterLocalSave?: boolean
  dismissNoteInBackground?: boolean
  onFileDialogActiveChange?: (active: boolean) => void
}): React.JSX.Element | null {
  const captureSession = useCaptureSession({
    libraryId,
    surface,
    legacyStorageKey: draftStorageKey
  })
  const { queue } = useCaptureQueue(libraryId)
  const draft = captureSession.markdown
  const setDraft = captureSession.setMarkdown
  const [attachments, setAttachments] = useState<CaptureDraftImageDto[]>([])
  const [saving, setSaving] = useState(false)
  const [stagingCount, setStagingCount] = useState(0)
  const [error, setError] = useState('')
  const [failedStage, setFailedStage] = useState<File | null>(null)
  const [fileCandidate, setFileCandidate] = useState<CaptureDraftFileDto | null>(null)
  const [morphedItem, setMorphedItem] = useState<LibraryItemDto | null>(null)
  const [exiting, setExiting] = useState(false)
  const [exitingDraft, setExitingDraft] = useState('')
  const [savingLink, setSavingLink] = useState<{
    domain: string
    phase: 'saving' | 'preview'
  } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handledImportRequest = useRef<number | null>(null)
  const handledDiscardRequest = useRef(discardRequest)
  const previousRevision = useRef(captureSession.revision)

  useEffect(() => {
    if (
      captureSession.revision !== previousRevision.current &&
      !captureSession.markdown &&
      !captureSession.busy
    ) {
      setError('')
      setFailedStage(null)
      setSavingLink(null)
      setMorphedItem(null)
      setExiting(false)
      setExitingDraft('')
    }
    previousRevision.current = captureSession.revision
  }, [captureSession.busy, captureSession.markdown, captureSession.revision])

  useEffect(() => {
    let active = true
    void Promise.all([
      window.kuskus.listCaptureDraftImages(),
      window.kuskus.getCaptureDraftFile()
    ]).then(([images, file]) => {
      if (!active) return
      if (images.ok) setAttachments(images.data)
      else setError(images.error)
      if (file.ok) setFileCandidate(file.data)
      else setError(file.error)
    })
    return () => {
      active = false
    }
  }, [captureSession.assetsRevision])

  const hasDraft =
    draft.trim().length > 0 ||
    attachments.length > 0 ||
    failedStage !== null ||
    fileCandidate !== null
  const hasTransientWork = saving || stagingCount > 0
  const surfaceActive = captureSession.owner === surface
  const captureBlocked = hasTransientWork || exiting || (captureSession.loaded && !surfaceActive)
  const savingFeedback = saving || exiting
  const captureKind = detectCaptureKind(draft, attachments.length)
  const effectiveKind = fileCandidate ? 'file' : captureKind
  const displayedError = error || captureSession.error

  useEffect(() => {
    if (!captureSession.loaded || !surfaceActive || attachments.length === 0) return
    const normalized = normalizeStagedAttachmentMarkdown(draft, attachments)
    if (normalized !== draft) setDraft(normalized)
  }, [attachments, captureSession.loaded, draft, setDraft, surfaceActive])

  useEffect(() => onDraftStateChange(hasDraft), [hasDraft, onDraftStateChange])
  useEffect(
    () => onTransientWorkChange(hasTransientWork || captureSession.busy || queue.pendingCount > 0),
    [captureSession.busy, hasTransientWork, onTransientWorkChange, queue.pendingCount]
  )

  useEffect(() => {
    if (surfaceActive) void captureSession.setBusy(hasTransientWork)
  }, [captureSession.setBusy, hasTransientWork, surfaceActive])

  useEffect(() => {
    if (!open) return
    void captureSession.claim()
    window.requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      editorRef.current?.focus()
    })
  }, [captureSession.claim, focusRequest, open])

  const insertAtSelection = useCallback(
    (value: string, start?: number, end?: number): void => {
      const editor = editorRef.current
      const selectionStart = start ?? editor?.selectionStart ?? draft.length
      const selectionEnd = end ?? editor?.selectionEnd ?? selectionStart
      setDraft((current) => {
        const prefix = current.slice(0, selectionStart)
        const suffix = current.slice(selectionEnd)
        const before = prefix && !prefix.endsWith('\n') ? '\n\n' : ''
        const after = suffix && !suffix.startsWith('\n') ? '\n\n' : ''
        return `${prefix}${before}${value}${after}${suffix}`
      })
      window.requestAnimationFrame(() => editor?.focus())
    },
    [draft.length]
  )

  const stageCaptureImage = useCallback(
    async (file: File, selectionStart?: number, selectionEnd?: number): Promise<void> => {
      if (fileCandidate) {
        setError('Save or remove the staged file before adding an image.')
        return
      }
      if (!file.type.startsWith('image/')) {
        setError('Only PNG, JPEG, GIF, WebP, and BMP images are supported.')
        return
      }
      setStagingCount((count) => count + 1)
      setError('')
      setFailedStage(null)
      try {
        const result = await window.kuskus.stageCaptureDraftImage({
          bytes: await file.arrayBuffer(),
          mediaType: file.type,
          sourceFilename: file.name || null
        })
        if (!result.ok) {
          setFailedStage(file)
          setError(result.error)
          return
        }
        const noteIntent = draft.trim().length > 0
        const imageCandidate = !noteIntent && attachments.length === 1
        setAttachments((current) => [...current, result.data])
        void captureSession.touchAssets()
        if (noteIntent) {
          insertAtSelection(markdownImage(result.data), selectionStart, selectionEnd)
          onStatus('Image added to the Markdown draft.')
        } else if (imageCandidate) {
          setDraft(composeMarkdownCapture([...attachments, result.data].map(markdownImage)))
          onStatus('Images added to the Markdown draft.')
        } else {
          onStatus('Image ready to save.')
        }
      } catch (caught) {
        setFailedStage(file)
        setError(caught instanceof Error ? caught.message : 'The image could not be staged.')
      } finally {
        setStagingCount((count) => Math.max(0, count - 1))
      }
    },
    [attachments, captureSession, draft, fileCandidate, insertAtSelection, onStatus, setDraft]
  )

  const stageCaptureFile = useCallback(
    async (file: File): Promise<void> => {
      if (draft.trim() || attachments.length > 0) {
        setError('Save or discard the current note before staging a separate file.')
        return
      }
      setStagingCount((count) => count + 1)
      setError('')
      try {
        const result = await window.kuskus.stageCaptureDraftFile({
          bytes: await file.arrayBuffer(),
          sourceFilename: file.name,
          mediaType: file.type || 'application/octet-stream'
        })
        if (!result.ok) {
          setError(result.error)
          return
        }
        setFileCandidate(result.data)
        void captureSession.touchAssets()
        onStatus('File ready to save.')
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'The file could not be staged.')
      } finally {
        setStagingCount((count) => Math.max(0, count - 1))
      }
    },
    [attachments.length, captureSession, draft, onStatus]
  )

  const finishCreate = useCallback(
    async (item: LibraryItemDto, message: string): Promise<void> => {
      if (dismissNoteInBackground && item.type === 'note') {
        setError('')
        const remainsVisible = await onCreated(item)
        onStatus(
          remainsVisible
            ? message
            : 'Saved successfully, but hidden by the current location, search, or filters.'
        )
        return
      }

      setMorphedItem(item)
      setError('')
      await wait(completionDelayMs)
      const remainsVisible = await onCreated(item)
      setMorphedItem(null)
      onOpenChange(false)
      onStatus(
        remainsVisible
          ? message
          : 'Saved successfully, but hidden by the current location, search, or filters.'
      )
    },
    [completionDelayMs, dismissNoteInBackground, onCreated, onOpenChange, onStatus]
  )

  const finishCommittedLink = useCallback(
    async (item: UrlItemDto, remainsVisible: boolean): Promise<void> => {
      setMorphedItem(item)
      setSavingLink(null)
      setError('')
      await wait(completionDelayMs)
      onLinkReleased(item.id)
      setMorphedItem(null)
      onOpenChange(false)
      onStatus(
        remainsVisible
          ? 'Link saved.'
          : 'Saved successfully, but hidden by the current location, search, or filters.'
      )
    },
    [completionDelayMs, onLinkReleased, onOpenChange, onStatus]
  )

  const save = async (): Promise<void> => {
    if (effectiveKind === 'empty' || saving || captureBlocked) return
    setSaving(true)
    setError('')
    const kind = effectiveKind
    const minimumLinkState =
      kind === 'link' && !completeLinkAfterLocalSave
        ? wait(LINK_SAVE_MINIMUM_MS)
        : Promise.resolve()
    const linkTimeout = kind === 'link' ? wait(LINK_SAVE_TIMEOUT_MS) : Promise.resolve()
    if (kind === 'link') {
      let domain = draft.trim()
      try {
        domain = new URL(domain).hostname
      } catch {
        // Detection already validated the URL; retain the original text if parsing unexpectedly fails.
      }
      setSavingLink({ domain, phase: 'saving' })
    }
    try {
      const revision = await captureSession.flush()
      const submitted = await window.capture.submit({
        libraryId,
        expectedRevision: revision,
        kind: kind === 'link' ? 'url' : kind,
        attachmentIds: attachments.map((attachment) => attachment.id),
        fileId: fileCandidate?.id ?? null,
        destination
      })
      if (!submitted.ok) {
        setSavingLink(null)
        setError(submitted.error)
        return
      }

      setAttachments([])
      setFileCandidate(null)
      setFailedStage(null)
      setSavingLink(null)
      if (surface === 'quick') {
        onOpenChange(false)
        onStatus('Capture accepted.')
        return
      }

      if (kind === 'link') setSavingLink({ domain: draft.trim(), phase: 'preview' })
      const result = await window.capture.waitForSubmission(submitted.data.id)
      if (!result.ok) {
        setSavingLink(null)
        setError(result.error)
        return
      }
      if (result.data.type === 'url') {
        const committed = await onLinkCommitted(result.data)
        await minimumLinkState
        await Promise.race([Promise.resolve(), linkTimeout])
        await finishCommittedLink(committed.item, committed.remainsVisible)
        return
      }
      await finishCreate(
        result.data,
        kind === 'file'
          ? 'File saved to Inbox.'
          : captureKind === 'image'
            ? 'Image saved to Inbox.'
            : captureKind === 'link'
              ? 'Link saved to Inbox. Loading page details…'
              : 'Note saved to Inbox.'
      )
    } catch (caught) {
      setSavingLink(null)
      setError(caught instanceof Error ? caught.message : 'The content could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const discard = useCallback(async (): Promise<void> => {
    if (hasTransientWork) return
    const result = await window.kuskus.discardCaptureDraft()
    if (!result.ok) {
      setError(result.error)
      onOpenChange(true)
      return
    }
    setDraft('')
    await captureSession.clear()
    setAttachments([])
    setFailedStage(null)
    setFileCandidate(null)
    setError('')
    onOpenChange(false)
    onStatus('Draft discarded.')
  }, [captureSession, hasTransientWork, onOpenChange, onStatus, setDraft])

  useEffect(() => {
    if (discardRequest === handledDiscardRequest.current) return
    handledDiscardRequest.current = discardRequest
    void discard()
  }, [discard, discardRequest])

  const removeAttachment = async (attachment: CaptureDraftImageDto): Promise<void> => {
    const result = await window.kuskus.removeCaptureDraftImage(attachment.id)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setAttachments((current) => current.filter((entry) => entry.id !== attachment.id))
    setDraft((current) => removeStagedAttachmentMarkdown(current, attachment))
    void captureSession.touchAssets()
    onStatus('Image removed from the draft.')
  }

  useEffect(() => {
    if (!importRequest || handledImportRequest.current === importRequest.id) return
    handledImportRequest.current = importRequest.id
    onImportRequestHandled(importRequest.id)
    const timeout = window.setTimeout(() => {
      if ('file' in importRequest) {
        if (importRequest.file.type.startsWith('image/')) {
          void stageCaptureImage(importRequest.file)
        } else {
          void stageCaptureFile(importRequest.file)
        }
        return
      }
      const value = 'url' in importRequest ? importRequest.url : importRequest.text
      if (captureKind === 'image') {
        setDraft(composeMarkdownCapture([markdownImage(attachments[0])], value))
      } else {
        insertAtSelection(value)
      }
    })
    void timeout
  }, [
    attachments,
    captureKind,
    importRequest,
    insertAtSelection,
    onImportRequestHandled,
    onStatus,
    stageCaptureFile,
    stageCaptureImage
  ])

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const image = Array.from(event.clipboardData.items)
      .find((entry) => entry.type.startsWith('image/'))
      ?.getAsFile()
    if (image) {
      event.preventDefault()
      void stageCaptureImage(
        image,
        event.currentTarget.selectionStart,
        event.currentTarget.selectionEnd
      )
      return
    }
  }

  if (!open && !morphedItem) return null

  if (morphedItem) {
    return (
      <div
        className="animate-in fade-in zoom-in-[0.98] [animation-duration:var(--capture-morph-duration)] [animation-timing-function:var(--motion-ease-out)] motion-reduce:animate-none"
        style={MORPH_STYLE}
      >
        <SavedItemCard
          item={morphedItem}
          view={view === 'visual' ? 'visual' : 'grid'}
          selected={false}
          onActivate={() => undefined}
          onOpen={() => undefined}
        />
      </div>
    )
  }

  if (savingLink) {
    return (
      <div ref={rootRef} className="min-w-0">
        <SavingLinkCard domain={savingLink.domain} phase={savingLink.phase} view={view} />
      </div>
    )
  }

  const editor = (
    <Textarea
      ref={editorRef}
      className={cn(
        'min-h-32 resize-none border-0 bg-transparent px-1 py-2 text-sm leading-6 shadow-none [field-sizing:content] placeholder:text-muted-foreground/70 focus-visible:ring-0',
        surface === 'quick' ? 'min-h-full max-h-none overflow-hidden' : 'max-h-96 overflow-y-auto'
      )}
      aria-label="Markdown note or link"
      placeholder={
        captureKind === 'image'
          ? 'Add text to turn this into a note…'
          : 'Write, paste a link, or drop an image…'
      }
      value={exiting ? exitingDraft : draft}
      disabled={captureBlocked || fileCandidate !== null}
      onChange={(event) => {
        const value = event.target.value
        if (captureKind !== 'image' || !value) {
          setDraft(value)
          return
        }
        const converted = composeMarkdownCapture([markdownImage(attachments[0])], value)
        setDraft(converted)
        window.requestAnimationFrame(() => {
          editorRef.current?.setSelectionRange(converted.length, converted.length)
        })
      }}
      onPaste={handlePaste}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          void save()
        } else if (event.key === 'Escape' && !hasTransientWork) {
          event.preventDefault()
          onOpenChange(false)
          onStatus(hasDraft ? 'Draft retained. Use Continue draft to return.' : 'New item closed.')
        }
      }}
    />
  )

  return (
    <Card
      ref={rootRef}
      aria-busy={savingFeedback}
      className={cn(
        'gap-0 overflow-hidden rounded-lg py-0 transition-[opacity,transform,filter] [transition-duration:80ms] ease-in',
        surface === 'quick' && 'h-full',
        'animate-in fade-in zoom-in-[0.98] [animation-duration:var(--capture-morph-duration)] [animation-timing-function:var(--motion-ease-out)]',
        exiting && '-translate-y-3 opacity-0 blur-[4px]',
        'motion-reduce:translate-y-0 motion-reduce:animate-none motion-reduce:blur-none motion-reduce:transition-none'
      )}
      style={MORPH_STYLE}
    >
      <CardContent
        className={cn('flex flex-col gap-3 p-3', surface === 'quick' && 'min-h-full flex-1')}
      >
        {queue.failures.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-2 border-destructive/30 px-3 py-2 text-left text-destructive"
            onClick={() => window.capture.openRecovery()}
          >
            <IconAlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-xs">
              {queue.failures.length}{' '}
              {queue.failures.length === 1 ? 'capture needs' : 'captures need'} attention
            </span>
          </Button>
        ) : null}
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          tabIndex={-1}
          onChange={(event) => {
            onFileDialogActiveChange?.(false)
            const files = Array.from(event.currentTarget.files ?? [])
            event.currentTarget.value = ''
            if (files.length === 0) return
            if (files[0].type.startsWith('image/')) void stageCaptureImage(files[0])
            else void stageCaptureFile(files[0])
          }}
        />
        {fileCandidate ? (
          <div className="flex items-center gap-3 rounded-xl bg-card/50 backdrop-blur-2xl p-3">
            <IconFile className="size-6 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{fileCandidate.filename}</p>
              <p className="text-xs text-muted-foreground">Ready to copy into the vault</p>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Remove ${fileCandidate.filename}`}
              disabled={captureBlocked}
              onClick={() => {
                void window.kuskus.removeCaptureDraftFile().then((result) => {
                  if (result.ok) {
                    setFileCandidate(null)
                    void captureSession.touchAssets()
                  } else setError(result.error)
                })
              }}
            >
              <IconX aria-hidden="true" />
            </Button>
          </div>
        ) : null}
        {attachments.length > 0 ? (
          <div className="flex flex-col gap-2" aria-label="Draft images">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-3 rounded-xl bg-muted/45 p-2"
              >
                <DraftImage attachment={attachment} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{attachment.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {attachment.missingContent
                      ? 'Staged file is missing'
                      : captureKind === 'image'
                        ? 'Ready to save'
                        : 'Embedded in Markdown'}
                  </p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${attachment.filename}`}
                  disabled={captureBlocked}
                  onClick={() => void removeAttachment(attachment)}
                >
                  <IconX aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        {surface === 'quick' ? (
          <ScrollArea
            className="min-h-0 flex-1"
            viewportClassName="focus-visible:ring-0 focus-visible:outline-none"
          >
            {editor}
          </ScrollArea>
        ) : (
          editor
        )}
        {stagingCount > 0 ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
            <Spinner /> Staging {stagingCount} {stagingCount === 1 ? 'image' : 'images'}…
          </p>
        ) : null}
        {displayedError ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to add content</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>{displayedError}</span>
              {failedStage ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void stageCaptureImage(failedStage)}
                >
                  <IconRefresh data-icon="inline-start" aria-hidden="true" />
                  Retry image
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        <div
          className={cn('flex items-center justify-end gap-2', surface === 'quick' && 'mt-auto')}
        >
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="More new item actions"
                  disabled={captureBlocked}
                />
              }
            >
              <IconDots aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => {
                    onFileDialogActiveChange?.(true)
                    fileInputRef.current?.click()
                    window.addEventListener('focus', () => onFileDialogActiveChange?.(false), {
                      once: true
                    })
                  }}
                >
                  <IconPhotoPlus aria-hidden="true" />
                  Add file or image
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    onOpenChange(false)
                    onStatus(
                      hasDraft
                        ? 'Draft retained. Use Continue draft to return.'
                        : 'New item closed.'
                    )
                  }}
                >
                  <IconX aria-hidden="true" />
                  {hasDraft ? 'Hide draft' : 'Close'}
                </DropdownMenuItem>
                {hasDraft ? (
                  <DropdownMenuItem variant="destructive" onClick={() => void discard()}>
                    <IconTrash aria-hidden="true" />
                    Discard draft
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="lg"
            className=""
            disabled={effectiveKind === 'empty' || captureBlocked}
            aria-keyshortcuts="Control+Enter Meta+Enter"
            onClick={() => void save()}
          >
            {savingFeedback ? <Spinner data-icon="inline-start" /> : null}
            {savingFeedback
              ? effectiveKind === 'file'
                ? 'Saving file…'
                : captureKind === 'image'
                  ? 'Saving image…'
                  : captureKind === 'link'
                    ? 'Saving link…'
                    : 'Saving note…'
              : effectiveKind === 'file'
                ? 'Save file'
                : captureKind === 'image'
                  ? 'Save image'
                  : captureKind === 'link'
                    ? 'Save link'
                    : 'Save note'}
            {!savingFeedback ? (
              <Kbd
                className={
                  surface === 'quick'
                    ? 'ml-1 bg-primary-foreground/15 text-primary-foreground'
                    : 'ml-1 hidden bg-primary-foreground/15 text-primary-foreground sm:inline-flex'
                }
                aria-hidden="true"
              >
                Ctrl+Enter
              </Kbd>
            ) : null}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
