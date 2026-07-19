import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconCheck,
  IconDots,
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
import { SavedItemCard } from '@/features/items/saved-item-card'
import type { LibraryView } from '@/features/items/item-view'
import type { LibraryItemDto, NoteDraftImageDto } from '../../../../shared/library-contract'

export type ImportRequest =
  { id: number; file: File } | { id: number; url: string } | { id: number; text: string }

type ImportAttempt = {
  file: File
  previewUrl: string
  status: 'importing' | 'failed'
  error: string
}

const MORPH_DURATION_MS = 180

function isSingleWebUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol) && url.toString() === value.trim()
  } catch {
    return false
  }
}

function markdownImage(attachment: NoteDraftImageDto): string {
  const alt = (attachment.sourceFilename ?? attachment.filename)
    .replace(/\.[^.]+$/, '')
    .replaceAll('[', '')
    .replaceAll(']', '')
  return `![${alt || 'Image'}](${attachment.relativePath})`
}

function DraftImage({ attachment }: { attachment: NoteDraftImageDto }): React.JSX.Element {
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (attachment.missingContent) return
    let active = true
    let objectUrl: string | null = null
    void window.kuskus.getNoteDraftImagePreview(attachment.id).then((result) => {
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
  onCreated: (item: LibraryItemDto) => boolean
  onStatus: (message: string) => void
  onDraftStateChange: (hasDraft: boolean) => void
  onTransientWorkChange: (hasTransientWork: boolean) => void
}): React.JSX.Element | null {
  const [draft, setDraft] = useState(() => localStorage.getItem(draftStorageKey) ?? '')
  const [attachments, setAttachments] = useState<NoteDraftImageDto[]>([])
  const [saving, setSaving] = useState(false)
  const [stagingCount, setStagingCount] = useState(0)
  const [error, setError] = useState('')
  const [failedStage, setFailedStage] = useState<File | null>(null)
  const [importAttempt, setImportAttempt] = useState<ImportAttempt | null>(null)
  const [morphedItem, setMorphedItem] = useState<LibraryItemDto | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handledImportRequest = useRef<number | null>(null)
  const handledDiscardRequest = useRef(discardRequest)
  const importAttemptRef = useRef<ImportAttempt | null>(null)

  useEffect(() => {
    if (draft) localStorage.setItem(draftStorageKey, draft)
    else localStorage.removeItem(draftStorageKey)
  }, [draft, draftStorageKey])

  useEffect(() => {
    let active = true
    void window.kuskus.listNoteDraftImages().then((result) => {
      if (!active) return
      if (result.ok) setAttachments(result.data)
      else setError(result.error)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    importAttemptRef.current = importAttempt
  }, [importAttempt])

  useEffect(
    () => () => {
      if (importAttemptRef.current) URL.revokeObjectURL(importAttemptRef.current.previewUrl)
    },
    []
  )

  const hasDraft =
    draft.trim().length > 0 ||
    attachments.length > 0 ||
    importAttempt !== null ||
    failedStage !== null
  const hasTransientWork = saving || stagingCount > 0 || importAttempt?.status === 'importing'

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

  const stageNoteImage = useCallback(
    async (file: File, selectionStart?: number, selectionEnd?: number): Promise<void> => {
      if (!file.type.startsWith('image/')) {
        setError('Only PNG, JPEG, GIF, WebP, and BMP images are supported.')
        return
      }
      setStagingCount((count) => count + 1)
      setError('')
      setFailedStage(null)
      const result = await window.kuskus.stageNoteDraftImage({
        bytes: await file.arrayBuffer(),
        mediaType: file.type,
        sourceFilename: file.name || null
      })
      setStagingCount((count) => Math.max(0, count - 1))
      if (!result.ok) {
        setFailedStage(file)
        setError(result.error)
        return
      }
      setAttachments((current) => [...current, result.data])
      insertAtSelection(markdownImage(result.data), selectionStart, selectionEnd)
      onStatus('Image added to the Markdown draft.')
    },
    [insertAtSelection, onStatus]
  )

  const finishCreate = useCallback(
    (item: LibraryItemDto, message: string): void => {
      setMorphedItem(item)
      setError('')
      window.setTimeout(() => {
        const remainsVisible = onCreated(item)
        setMorphedItem(null)
        onOpenChange(false)
        onStatus(
          remainsVisible ? message : 'Saved to Inbox, but hidden by the current search or filters.'
        )
      }, MORPH_DURATION_MS)
    },
    [onCreated, onOpenChange, onStatus]
  )

  const importStandaloneImage = useCallback(
    async (file: File): Promise<void> => {
      if (!file.type.startsWith('image/')) {
        setError('Only PNG, JPEG, GIF, WebP, and BMP images are supported.')
        return
      }
      setError('')
      setImportAttempt((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl)
        return {
          file,
          previewUrl: URL.createObjectURL(file),
          status: 'importing',
          error: ''
        }
      })
      const result = await window.kuskus.importImage({
        bytes: await file.arrayBuffer(),
        mediaType: file.type,
        sourceFilename: file.name || null
      })
      if (!result.ok) {
        setImportAttempt((current) =>
          current ? { ...current, status: 'failed', error: result.error } : current
        )
        return
      }
      setImportAttempt((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl)
        return null
      })
      finishCreate(result.data, 'Image imported to Inbox.')
    },
    [finishCreate]
  )

  const save = async (): Promise<void> => {
    if (!draft.trim() || saving || hasTransientWork) return
    setSaving(true)
    setError('')
    const urlOnly = attachments.length === 0 && isSingleWebUrl(draft)
    const result = urlOnly
      ? await window.kuskus.createUrl(draft.trim())
      : await window.kuskus.createNote({
          markdown: draft,
          attachmentIds: attachments.map((attachment) => attachment.id)
        })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDraft('')
    setAttachments([])
    finishCreate(
      result.data,
      urlOnly ? 'Link saved to Inbox. Loading page details…' : 'Note saved to Inbox.'
    )
  }

  const discard = useCallback(async (): Promise<void> => {
    if (hasTransientWork) return
    const result = await window.kuskus.discardNoteDraft()
    if (!result.ok) {
      setError(result.error)
      onOpenChange(true)
      return
    }
    setDraft('')
    setAttachments([])
    setFailedStage(null)
    setImportAttempt((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl)
      return null
    })
    setError('')
    onOpenChange(false)
    onStatus('Draft discarded.')
  }, [hasTransientWork, onOpenChange, onStatus])

  useEffect(() => {
    if (discardRequest === handledDiscardRequest.current) return
    handledDiscardRequest.current = discardRequest
    void discard()
  }, [discard, discardRequest])

  const removeAttachment = async (attachment: NoteDraftImageDto): Promise<void> => {
    const result = await window.kuskus.removeNoteDraftImage(attachment.id)
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
        if (hasDraft) void stageNoteImage(importRequest.file)
        else void importStandaloneImage(importRequest.file)
        return
      }
      if ('url' in importRequest && !hasDraft) {
        void window.kuskus.createUrl(importRequest.url).then((result) => {
          if (!result.ok) setError(result.error)
          else finishCreate(result.data, 'Link saved to Inbox. Loading page details…')
        })
        return
      }
      insertAtSelection('url' in importRequest ? importRequest.url : importRequest.text)
    })
    void timeout
  }, [
    finishCreate,
    hasDraft,
    importRequest,
    importStandaloneImage,
    insertAtSelection,
    onImportRequestHandled,
    stageNoteImage
  ])

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const image = Array.from(event.clipboardData.items)
      .find((entry) => entry.type.startsWith('image/'))
      ?.getAsFile()
    if (image) {
      event.preventDefault()
      const noteIntent = draft.trim().length > 0 || attachments.length > 0
      if (noteIntent) {
        void stageNoteImage(
          image,
          event.currentTarget.selectionStart,
          event.currentTarget.selectionEnd
        )
      } else {
        void importStandaloneImage(image)
      }
      return
    }
    const text = event.clipboardData.getData('text/plain').trim()
    if (!hasDraft && isSingleWebUrl(text)) {
      event.preventDefault()
      void window.kuskus.createUrl(text).then((result) => {
        if (!result.ok) setError(result.error)
        else finishCreate(result.data, 'Link saved to Inbox. Loading page details…')
      })
    }
  }

  if (!open && !morphedItem) return null

  if (morphedItem) {
    return (
      <div className="animate-in fade-in zoom-in-[0.98] duration-200 motion-reduce:animate-none">
        <SavedItemCard
          item={morphedItem}
          view={view === 'visual' ? 'visual' : 'grid'}
          onError={setError}
          onOpen={() => undefined}
        />
      </div>
    )
  }

  return (
    <Card
      ref={rootRef}
      className="gap-0 overflow-hidden py-0 shadow-[0_0_0_1px_color-mix(in_oklch,var(--ring)_25%,transparent),0_10px_28px_-22px_rgb(0_0_0/0.3)] animate-in fade-in zoom-in-[0.98] duration-200 motion-reduce:animate-none"
    >
      <CardContent className="flex flex-col gap-3 py-3">
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
          tabIndex={-1}
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? [])
            event.currentTarget.value = ''
            if (files.length === 0) return
            if (!hasDraft) void importStandaloneImage(files[0])
            else
              files.reduce(
                (previous, file) => previous.then(() => stageNoteImage(file)),
                Promise.resolve()
              )
          }}
        />
        {importAttempt ? (
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
            <img
              src={importAttempt.previewUrl}
              alt="Image being imported"
              className="size-20 rounded-lg object-cover outline -outline-offset-1 outline-black/10 dark:outline-white/10"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="truncate text-sm font-medium">
                {importAttempt.file.name || 'Pasted image'}
              </p>
              <p className="text-xs text-muted-foreground">
                {importAttempt.status === 'importing' ? 'Importing image…' : importAttempt.error}
              </p>
              {importAttempt.status === 'failed' ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void importStandaloneImage(importAttempt.file)}>
                    <IconRefresh data-icon="inline-start" aria-hidden="true" />
                    Retry
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      URL.revokeObjectURL(importAttempt.previewUrl)
                      setImportAttempt(null)
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>
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
                    {attachment.missingContent ? 'Staged file is missing' : 'Embedded in Markdown'}
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
          placeholder="Write, paste a link, or drop an image…"
          value={draft}
          disabled={saving || importAttempt?.status === 'importing'}
          onChange={(event) => setDraft(event.target.value)}
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
                  onClick={() => void stageNoteImage(failedStage)}
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
            disabled={!draft.trim() || hasTransientWork}
            aria-keyshortcuts="Control+Enter Meta+Enter"
            onClick={() => void save()}
          >
            {saving ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <IconCheck data-icon="inline-start" aria-hidden="true" />
            )}
            {saving
              ? 'Saving…'
              : isSingleWebUrl(draft) && attachments.length === 0
                ? 'Save link'
                : 'Save'}
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
