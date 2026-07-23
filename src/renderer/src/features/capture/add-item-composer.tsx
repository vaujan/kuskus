import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconDots,
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
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ItemCard, ItemCardCaption, ItemCardSurface } from '@/features/items/item-card'
import { SavedItemCard } from '@/features/items/saved-item-card'
import type { LibraryView } from '@/features/items/item-view'
import { composeMarkdownCapture, detectCaptureKind } from '@/features/capture/capture-detection'
import type {
  CaptureDraftImageDto,
  LibraryItemDto,
  UrlItemDto
} from '../../../../shared/library-contract'

export type ImportRequest =
  { id: number; file: File } | { id: number; url: string } | { id: number; text: string }

const MORPH_DURATION_MS = 180
const LINK_SAVE_MINIMUM_MS = 500
const LINK_SAVE_TIMEOUT_MS = 12_000

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
          className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center opacity-100 transition-opacity duration-150 starting:opacity-0 motion-reduce:transition-none"
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
  return `![${alt || 'Image'}](${attachment.relativePath})`
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
  draftStorageKey,
  importRequest,
  view,
  onOpenChange,
  onImportRequestHandled,
  onCreated,
  onLinkCommitted,
  onLinkUpdated,
  onLinkReleased,
  onStatus,
  onDraftStateChange,
  onTransientWorkChange
}: {
  open: boolean
  focusRequest: number
  discardRequest: number
  draftStorageKey: string
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
}): React.JSX.Element | null {
  const [draft, setDraft] = useState(() => localStorage.getItem(draftStorageKey) ?? '')
  const [attachments, setAttachments] = useState<CaptureDraftImageDto[]>([])
  const [saving, setSaving] = useState(false)
  const [stagingCount, setStagingCount] = useState(0)
  const [error, setError] = useState('')
  const [failedStage, setFailedStage] = useState<File | null>(null)
  const [morphedItem, setMorphedItem] = useState<LibraryItemDto | null>(null)
  const [savingLink, setSavingLink] = useState<{
    domain: string
    phase: 'saving' | 'preview'
  } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handledImportRequest = useRef<number | null>(null)
  const handledDiscardRequest = useRef(discardRequest)

  useEffect(() => {
    if (draft) localStorage.setItem(draftStorageKey, draft)
    else localStorage.removeItem(draftStorageKey)
  }, [draft, draftStorageKey])

  useEffect(() => {
    let active = true
    void window.kuskus.listCaptureDraftImages().then((result) => {
      if (!active) return
      if (result.ok) setAttachments(result.data)
      else setError(result.error)
    })
    return () => {
      active = false
    }
  }, [])

  const hasDraft = draft.trim().length > 0 || attachments.length > 0 || failedStage !== null
  const hasTransientWork = saving || stagingCount > 0
  const captureKind = detectCaptureKind(draft, attachments.length)

  useEffect(() => onDraftStateChange(hasDraft), [hasDraft, onDraftStateChange])
  useEffect(
    () => onTransientWorkChange(hasTransientWork),
    [hasTransientWork, onTransientWorkChange]
  )

  useEffect(() => {
    if (!open) return
    window.requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      editorRef.current?.focus()
    })
  }, [focusRequest, open])

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
    [attachments, draft, insertAtSelection, onStatus]
  )

  const finishCreate = useCallback(
    (item: LibraryItemDto, message: string): void => {
      setMorphedItem(item)
      setError('')
      window.setTimeout(() => {
        void Promise.resolve(onCreated(item)).then((remainsVisible) => {
          setMorphedItem(null)
          onOpenChange(false)
          onStatus(
            remainsVisible
              ? message
              : 'Saved successfully, but hidden by the current location, search, or filters.'
          )
        })
      }, MORPH_DURATION_MS)
    },
    [onCreated, onOpenChange, onStatus]
  )

  const finishCommittedLink = useCallback(
    async (item: UrlItemDto, remainsVisible: boolean): Promise<void> => {
      setMorphedItem(item)
      setSavingLink(null)
      setError('')
      await wait(MORPH_DURATION_MS)
      onLinkReleased(item.id)
      setMorphedItem(null)
      onOpenChange(false)
      onStatus(
        remainsVisible
          ? 'Link saved.'
          : 'Saved successfully, but hidden by the current location, search, or filters.'
      )
    },
    [onLinkReleased, onOpenChange, onStatus]
  )

  const save = async (): Promise<void> => {
    if (captureKind === 'empty' || saving || hasTransientWork) return
    setSaving(true)
    setError('')
    const kind = captureKind
    const minimumLinkState = kind === 'link' ? wait(LINK_SAVE_MINIMUM_MS) : Promise.resolve()
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
      if (kind === 'link') {
        const created = await window.kuskus.createUrl(draft.trim())
        if (!created.ok) {
          setSavingLink(null)
          setError(created.error)
          return
        }
        const committed = await onLinkCommitted(created.data)
        let latestItem = committed.item
        setDraft('')
        setAttachments([])
        setSavingLink({ domain: latestItem.domain, phase: 'preview' })
        const preparation = window.kuskus.enrichUrl(latestItem.id).then(async (result) => {
          if (!result.ok) return latestItem
          latestItem = result.data
          onLinkUpdated(latestItem)
          if (latestItem.hasPreviewImage) {
            await window.kuskus.getUrlPreview(latestItem.id, 'preview').catch(() => undefined)
          }
          return latestItem
        })
        await Promise.race([preparation, linkTimeout])
        await minimumLinkState
        await finishCommittedLink(latestItem, committed.remainsVisible)
        return
      }
      const result =
        kind === 'image'
          ? await window.kuskus.commitCaptureDraftImage(attachments[0].id)
          : await window.kuskus.createNote({
              markdown: draft,
              attachmentIds: attachments.map((attachment) => attachment.id)
            })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDraft('')
      setAttachments([])
      finishCreate(
        result.data,
        captureKind === 'image'
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
    setAttachments([])
    setFailedStage(null)
    setError('')
    onOpenChange(false)
    onStatus('Draft discarded.')
  }, [hasTransientWork, onOpenChange, onStatus])

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
    const syntax = markdownImage(attachment)
    setDraft((current) => current.replace(syntax, '').replace(/\n{3,}/g, '\n\n'))
    onStatus('Image removed from the draft.')
  }

  useEffect(() => {
    if (!importRequest || handledImportRequest.current === importRequest.id) return
    handledImportRequest.current = importRequest.id
    onImportRequestHandled(importRequest.id)
    const timeout = window.setTimeout(() => {
      if ('file' in importRequest) {
        void stageCaptureImage(importRequest.file)
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
      <div className="animate-in fade-in zoom-in-[0.98] duration-200 motion-reduce:animate-none">
        <SavedItemCard
          item={morphedItem}
          view={view === 'visual' ? 'visual' : 'grid'}
          selected={false}
          onError={setError}
          onSelect={() => undefined}
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

  return (
    <Card
      ref={rootRef}
      className="gap-0 overflow-hidden py-0 shadow-[0_0_0_1px_color-mix(in_oklch,var(--ring)_25%,transparent),0_10px_28px_-22px_rgb(0_0_0/0.3)] animate-in fade-in zoom-in-[0.98] duration-200 motion-reduce:animate-none"
    >
      <CardContent className="flex flex-col gap-3 p-3">
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
          tabIndex={-1}
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? [])
            event.currentTarget.value = ''
            if (files.length === 0) return
            void stageCaptureImage(files[0])
          }}
        />
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
                  disabled={hasTransientWork}
                  onClick={() => void removeAttachment(attachment)}
                >
                  <IconX aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        <Textarea
          ref={editorRef}
          className="min-h-32 max-h-96 resize-none overflow-y-auto border-0 bg-transparent px-1 py-2 text-sm leading-6 shadow-none [field-sizing:content] placeholder:text-muted-foreground/70 focus-visible:ring-0"
          aria-label="Markdown note or link"
          placeholder={
            captureKind === 'image'
              ? 'Add text to turn this into a note…'
              : 'Write, paste a link, or drop an image…'
          }
          value={draft}
          disabled={hasTransientWork}
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
              onStatus(
                hasDraft ? 'Draft retained. Use Continue draft to return.' : 'New item closed.'
              )
            }
          }}
        />
        {stagingCount > 0 ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
            <Spinner /> Staging {stagingCount} {stagingCount === 1 ? 'image' : 'images'}…
          </p>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to add content</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>{error}</span>
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
        <div className="flex items-center justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="More new item actions"
                  disabled={hasTransientWork}
                />
              }
            >
              <IconDots aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <IconPhotoPlus aria-hidden="true" />
                  Add image
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
            className="transition-[scale,background-color,color] active:scale-[0.96]"
            disabled={captureKind === 'empty' || hasTransientWork}
            aria-keyshortcuts="Control+Enter Meta+Enter"
            onClick={() => void save()}
          >
            {saving ? <Spinner data-icon="inline-start" /> : null}
            {saving
              ? captureKind === 'image'
                ? 'Saving image…'
                : captureKind === 'link'
                  ? 'Saving link…'
                  : 'Saving note…'
              : captureKind === 'image'
                ? 'Save image'
                : captureKind === 'link'
                  ? 'Save link'
                  : 'Save note'}
            {!saving ? (
              <Kbd
                className="ml-1 hidden bg-primary-foreground/15 text-primary-foreground sm:inline-flex"
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
