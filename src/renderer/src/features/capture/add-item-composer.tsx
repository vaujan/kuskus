import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconBraces as Braces,
  IconCheck as Check,
  IconFileText as FileText,
  IconLink as Link2,
  IconPhoto as FileImage,
  IconPhotoPlus as ImagePlus,
  IconPlus as Plus,
  IconRefresh as RotateCcw,
  IconTrash as Trash2,
  IconX as X
} from '@tabler/icons-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import type { LibraryItemDto } from '../../../../shared/library-contract'

export type ImportRequest = { id: number; file: File } | { id: number; url: string }

function isSingleWebUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol) && url.toString() === value.trim()
  } catch {
    return false
  }
}

type ImportAttempt = {
  file: File
  name: string
  previewUrl: string
  status: 'importing' | 'failed'
  error: string
}

export function AddItemComposer({
  expanded,
  draftStorageKey,
  importRequest,
  onExpandedChange,
  onImportRequestHandled,
  onCreated,
  onStatus,
  onTransientWorkChange
}: {
  expanded: boolean
  draftStorageKey: string
  importRequest: ImportRequest | null
  onExpandedChange: (expanded: boolean) => void
  onImportRequestHandled: (id: number) => void
  onCreated: (item: LibraryItemDto) => void
  onStatus: (message: string) => void
  onTransientWorkChange: (hasTransientWork: boolean) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(() => localStorage.getItem(draftStorageKey) ?? '')
  const [saving, setSaving] = useState(false)
  const [composerError, setComposerError] = useState('')
  const [importAttempt, setImportAttempt] = useState<ImportAttempt | null>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const compactButtonRef = useRef<HTMLButtonElement>(null)
  const wasExpanded = useRef(expanded)
  const activeImport = useRef(0)
  const importAttemptRef = useRef<ImportAttempt | null>(null)
  const handledImportRequest = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (draft) localStorage.setItem(draftStorageKey, draft)
    else localStorage.removeItem(draftStorageKey)
  }, [draft, draftStorageKey])

  useEffect(() => {
    importAttemptRef.current = importAttempt
  }, [importAttempt])

  useEffect(
    () => () => {
      activeImport.current += 1
      if (importAttemptRef.current) URL.revokeObjectURL(importAttemptRef.current.previewUrl)
    },
    []
  )

  useEffect(() => {
    if (expanded && !importAttempt) editorRef.current?.focus()
    if (wasExpanded.current && !expanded) {
      window.requestAnimationFrame(() => compactButtonRef.current?.focus())
    }
    wasExpanded.current = expanded
  }, [expanded, importAttempt])

  const save = async (): Promise<void> => {
    if (!draft.trim() || saving) return
    setSaving(true)
    setComposerError('')
    const isUrl = isSingleWebUrl(draft)
    const result = isUrl
      ? await window.kuskus.createUrl(draft.trim())
      : await window.kuskus.createNote(draft)
    setSaving(false)
    if (!result.ok) {
      setComposerError(result.error)
      return
    }
    setDraft('')
    onCreated(result.data)
    onExpandedChange(false)
    onStatus(isUrl ? 'Link saved to Inbox. Loading page details…' : 'Note saved to Inbox.')
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault()
      void save()
    }
    if (event.key === 'Escape' && !saving && importAttempt?.status !== 'importing') {
      event.preventDefault()
      onExpandedChange(false)
      if (draft.trim()) onStatus('Draft saved. Reopen Add Item to continue editing.')
    }
  }

  const importImage = useCallback(
    async (file: File): Promise<void> => {
      if (saving || importAttempt?.status === 'importing') return
      if (!file.type.startsWith('image/')) {
        setComposerError('Only image files can be imported here right now.')
        return
      }
      const requestId = activeImport.current + 1
      activeImport.current = requestId
      setComposerError('')
      setImportAttempt((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl)
        return {
          file,
          name: file.name || 'Pasted image',
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
      if (activeImport.current !== requestId) return
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
      onCreated(result.data)
      onExpandedChange(false)
      onStatus('Image imported to Inbox.')
    },
    [importAttempt?.status, onCreated, onExpandedChange, onStatus, saving]
  )

  useEffect(() => {
    if (!importRequest || handledImportRequest.current === importRequest.id) return
    handledImportRequest.current = importRequest.id
    onImportRequestHandled(importRequest.id)
    const timeout = window.setTimeout(() => {
      if ('file' in importRequest) {
        void importImage(importRequest.file)
        return
      }
      void (async () => {
        const result = await window.kuskus.createUrl(importRequest.url)
        if (!result.ok) setComposerError(result.error)
        else {
          onCreated(result.data)
          onExpandedChange(false)
          onStatus('Link saved to Inbox. Loading page details…')
        }
      })()
    })
    return () => window.clearTimeout(timeout)
  }, [importImage, importRequest, onCreated, onExpandedChange, onImportRequestHandled, onStatus])

  const removeImport = (): void => {
    activeImport.current += 1
    setImportAttempt((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl)
      return null
    })
    onStatus('Image import removed. Your note draft is still available.')
    window.requestAnimationFrame(() => editorRef.current?.focus())
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const item = Array.from(event.clipboardData.items).find((entry) =>
      entry.type.startsWith('image/')
    )
    const file = item?.getAsFile()
    if (file) {
      event.preventDefault()
      void importImage(file)
      return
    }
    const text = event.clipboardData.getData('text/plain').trim()
    if (!draft.trim() && isSingleWebUrl(text)) {
      event.preventDefault()
      void (async () => {
        setSaving(true)
        const result = await window.kuskus.createUrl(text)
        setSaving(false)
        if (!result.ok) setComposerError(result.error)
        else {
          onCreated(result.data)
          onExpandedChange(false)
          onStatus('Link saved to Inbox. Loading page details…')
        }
      })()
    }
  }

  const draftIsUrl = isSingleWebUrl(draft)
  const importInProgress = importAttempt?.status === 'importing'
  const hasTransientWork = saving || importAttempt !== null

  useEffect(() => {
    onTransientWorkChange(hasTransientWork)
  }, [hasTransientWork, onTransientWorkChange])

  return (
    <>
      <Card className="group/add-item min-h-44 gap-0 overflow-hidden rounded-2xl border-0 bg-card py-0 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04)] ring-0 transition-[box-shadow,background-color] duration-150 ease-out hover:bg-card/95 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.08),0_8px_20px_-8px_rgba(0,0,0,0.14)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.14)]">
        <button
          ref={compactButtonRef}
          type="button"
          className="flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-[inherit] px-6 py-7 text-center outline-none transition-transform duration-150 ease-out active:scale-[0.96] focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/60"
          onClick={() => onExpandedChange(true)}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition-[scale,color,background-color] duration-200 ease-out group-hover/add-item:scale-105 group-hover/add-item:bg-primary group-hover/add-item:text-primary-foreground">
            {importAttempt?.status === 'failed' ? (
              <RotateCcw className="size-5" aria-hidden="true" />
            ) : (
              <Plus className="size-5" aria-hidden="true" />
            )}
          </span>
          <span className="space-y-1">
            <span className="block text-sm font-semibold text-foreground">
              {importAttempt?.status === 'failed'
                ? 'Fix image import'
                : draft.trim()
                  ? 'Continue writing'
                  : 'Add item'}
            </span>
            <span className="block max-w-60 text-pretty text-xs leading-5 text-muted-foreground">
              {importAttempt?.status === 'failed'
                ? 'The image is still here and ready to retry.'
                : draft.trim()
                  ? 'Your Markdown draft is saved on this device.'
                  : 'Write a note, paste a link, or drop an image.'}
            </span>
          </span>
          {!draft.trim() && !importAttempt ? (
            <span
              className="flex items-center gap-3 text-[11px] text-muted-foreground/75"
              aria-hidden="true"
            >
              <span className="flex items-center gap-1">
                <FileText className="size-3" /> Note
              </span>
              <span className="flex items-center gap-1">
                <Link2 className="size-3" /> Link
              </span>
              <span className="flex items-center gap-1">
                <FileImage className="size-3" /> Image
              </span>
            </span>
          ) : null}
        </button>
      </Card>
      <Dialog
        open={expanded}
        onOpenChange={(open) => {
          if (!open && draft.trim()) onStatus('Draft saved. Reopen Add Item to continue editing.')
          onExpandedChange(open)
        }}
      >
        <DialogContent>
          <Card className="max-h-[calc(100vh-2rem)] gap-0 overflow-auto rounded-2xl shadow-2xl">
            <CardHeader className="border-b">
              <DialogHeader>
                <DialogTitle>Add to Inbox</DialogTitle>
                <DialogDescription>
                  Write in Markdown, paste a link, or add an image. Kuskus recognizes the format for
                  you.
                </DialogDescription>
              </DialogHeader>
              <CardAction>
                <DialogClose
                  disabled={saving || importAttempt?.status === 'importing'}
                  render={<Button size="icon-sm" variant="ghost" aria-label="Close composer" />}
                >
                  <X aria-hidden="true" />
                </DialogClose>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 py-5">
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
                tabIndex={-1}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0]
                  event.currentTarget.value = ''
                  if (file) void importImage(file)
                }}
              />
              {importAttempt && (
                <Card size="sm" className="flex-row items-center gap-4 bg-muted/50 shadow-none">
                  <img
                    className="max-h-24 max-w-32 rounded-lg object-contain outline -outline-offset-1 outline-black/10 dark:outline-white/10"
                    src={importAttempt.previewUrl}
                    alt="Image waiting to import"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{importAttempt.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {importAttempt.status === 'importing'
                          ? 'Importing image…'
                          : 'Import failed'}
                      </p>
                    </div>
                    {importAttempt.status === 'failed' && (
                      <div className="flex flex-col gap-2">
                        <p className="text-pretty text-sm text-destructive">
                          {importAttempt.error}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => void importImage(importAttempt.file)}>
                            <RotateCcw data-icon="inline-start" aria-hidden="true" />
                            Retry
                          </Button>
                          <Button size="sm" variant="ghost" onClick={removeImport}>
                            <Trash2 data-icon="inline-start" aria-hidden="true" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}
              <div className="overflow-hidden rounded-xl bg-background shadow-[0_0_0_1px_var(--input)] transition-[box-shadow] duration-150 focus-within:shadow-[0_0_0_1px_var(--ring),0_0_0_4px_color-mix(in_oklch,var(--ring)_18%,transparent)] dark:bg-input/10">
                <Textarea
                  ref={editorRef}
                  className="min-h-64 resize-y rounded-none border-0 bg-transparent px-4 py-4 text-sm leading-6 shadow-none placeholder:text-muted-foreground/75 focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
                  aria-label="Markdown note or link"
                  aria-describedby="markdown-support composer-shortcuts"
                  placeholder={
                    'Start writing or paste a link…\n\nTry # headings, **bold text**, lists, and [links](https://example.com).'
                  }
                  value={draft}
                  disabled={saving}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                />
                <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-t px-2.5 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving || importInProgress}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus data-icon="inline-start" aria-hidden="true" />
                    Add image
                  </Button>
                  <p
                    id="markdown-support"
                    className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground"
                  >
                    <Braces className="size-4" aria-hidden="true" />
                    <span>
                      <strong className="font-medium text-foreground/80">Markdown supported</strong>
                      {' · # heading · **bold** · [link]'}
                    </span>
                  </p>
                </div>
              </div>
              <p id="composer-shortcuts" className="text-pretty text-xs text-muted-foreground">
                Press{' '}
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans text-[11px] text-foreground">
                  Ctrl + Enter
                </kbd>{' '}
                to save. Escape closes the composer and keeps your draft.
              </p>
              {composerError && (
                <Alert variant="destructive">
                  <AlertTitle>Unable to save</AlertTitle>
                  <AlertDescription>{composerError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="justify-between gap-3 border-t">
              <p className="hidden text-xs text-muted-foreground sm:block">
                {draftIsUrl ? 'This will be saved as a link.' : 'Saved locally to your library.'}
              </p>
              <div className="ml-auto flex items-center gap-2">
                <DialogClose
                  disabled={saving || importInProgress}
                  render={<Button variant="ghost" type="button" />}
                >
                  Cancel
                </DialogClose>
                <Button
                  disabled={!draft.trim() || saving || importInProgress}
                  onClick={() => void save()}
                >
                  {saving ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Check data-icon="inline-start" aria-hidden="true" />
                  )}
                  {saving ? 'Saving…' : draftIsUrl ? 'Save link' : 'Save note'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  )
}
