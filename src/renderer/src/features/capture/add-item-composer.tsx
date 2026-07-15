import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ImagePlus, Plus, RotateCcw, Trash2, X } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup } from '@/components/ui/field'
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
  onStatus
}: {
  expanded: boolean
  draftStorageKey: string
  importRequest: ImportRequest | null
  onExpandedChange: (expanded: boolean) => void
  onImportRequestHandled: (id: number) => void
  onCreated: (item: LibraryItemDto) => void
  onStatus: (message: string) => void
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

  return (
    <>
      <Card className="min-h-36 border border-dashed bg-card shadow-xs transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md">
        <CardHeader>
          <CardTitle>Add something new</CardTitle>
          <CardDescription>
            {importAttempt?.status === 'failed'
              ? 'An image import needs your attention.'
              : draft.trim()
                ? 'Your unfinished draft is saved on this device.'
                : 'Capture a note, link, or image without leaving your Inbox.'}
          </CardDescription>
          <CardAction>
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plus aria-hidden="true" />
            </span>
          </CardAction>
        </CardHeader>
        <CardFooter>
          <Button ref={compactButtonRef} type="button" onClick={() => onExpandedChange(true)}>
            <ImagePlus data-icon="inline-start" aria-hidden="true" />
            {importAttempt?.status === 'failed' ? 'Fix import' : draft.trim() ? 'Continue draft' : 'Add item'}
          </Button>
        </CardFooter>
      </Card>
      <Dialog
        open={expanded}
        onOpenChange={(open) => {
          if (!open && draft.trim()) onStatus('Draft saved. Reopen Add Item to continue editing.')
          onExpandedChange(open)
        }}
      >
        <DialogContent>
          <Card className="max-h-[calc(100vh-2rem)] gap-0 overflow-auto shadow-2xl">
            <CardHeader className="border-b">
              <DialogHeader>
                <DialogTitle>Add to Inbox</DialogTitle>
                <DialogDescription>
                  Paste or write first. Kuskus will recognize a link or image automatically.
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
              {importAttempt && (
                <Card size="sm" className="flex-row items-center gap-4 bg-muted/50 shadow-none">
                  <img
                    className="max-h-24 max-w-32 rounded-md object-contain ring-1 ring-inset ring-foreground/10"
                    src={importAttempt.previewUrl}
                    alt="Image waiting to import"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{importAttempt.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {importAttempt.status === 'importing' ? 'Importing image…' : 'Import failed'}
                      </p>
                    </div>
                    {importAttempt.status === 'failed' && (
                      <div className="flex flex-col gap-2">
                        <p className="text-pretty text-sm text-destructive">{importAttempt.error}</p>
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
              <FieldGroup>
                <Field>
                  <Textarea
                    ref={editorRef}
                    className="min-h-72 resize-y"
                    aria-label="New note content"
                    placeholder="Paste a link, paste an image, or start writing…"
                    value={draft}
                    disabled={saving}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                  />
                  <FieldDescription>Ctrl+Enter saves. Escape closes this window and keeps your draft.</FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
            {composerError && (
              <Alert className="mx-6 mb-5" variant="destructive">
                <AlertTitle>Unable to Save</AlertTitle>
                <AlertDescription>{composerError}</AlertDescription>
              </Alert>
            )}
            <CardFooter className="justify-end gap-2 border-t">
              <DialogClose render={<Button variant="ghost" type="button" />}>Cancel</DialogClose>
              <Button
                disabled={!draft.trim() || saving || importAttempt?.status === 'importing'}
                onClick={() => void save()}
              >
                {saving ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" aria-hidden="true" />}
                {saving ? 'Saving…' : 'Save Note'}
              </Button>
            </CardFooter>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  )
}
