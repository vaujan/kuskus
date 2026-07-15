import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Plus, RotateCcw, Trash2, X } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { LibraryItemDto } from '../../../../shared/library-contract'

export type ImportRequest = { id: number; file: File }

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
    const result = await window.kuskus.createNote(draft)
    setSaving(false)
    if (!result.ok) {
      setComposerError(result.error)
      return
    }
    setDraft('')
    onCreated(result.data)
    onExpandedChange(false)
    onStatus('Note saved to Inbox.')
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
    void importImage(importRequest.file)
  }, [importImage, importRequest, onImportRequestHandled])

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
    if (!file) return
    event.preventDefault()
    void importImage(file)
  }

  if (!expanded) {
    return (
      <Button
        ref={compactButtonRef}
        className="add-item-card min-h-28 w-full flex-col items-start justify-between text-left"
        variant="outline"
        type="button"
        onClick={() => onExpandedChange(true)}
      >
        <span className="add-item-icon rounded-md bg-primary/10 p-2 text-primary">
          <Plus aria-hidden="true" />
        </span>
        <span className="flex flex-col gap-1">
          <span>{importAttempt?.status === 'failed' ? 'Import needs attention' : 'Add Item'}</span>
          <span className="text-xs text-muted-foreground">
            {importAttempt?.status === 'failed'
              ? 'Reopen to retry or remove'
              : draft.trim()
                ? 'Draft saved · Continue editing'
                : 'Paste, drop, or start typing'}
          </span>
        </span>
      </Button>
    )
  }

  return (
    <Card className="composer-card relative min-h-(--composer-card-height) shadow-lg">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b py-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Add Item</Badge>
          <span className="text-xs text-muted-foreground">
            {draft.trim() ? 'Draft saved locally' : 'Note or image'}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                type="button"
                aria-label="Close composer"
                disabled={saving || importAttempt?.status === 'importing'}
                onClick={() => {
                  onExpandedChange(false)
                  if (draft.trim()) onStatus('Draft saved. Reopen Add Item to continue editing.')
                }}
              >
                <X aria-hidden="true" />
              </Button>
            }
          />
          <TooltipContent>Close and keep draft</TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-0">
        {importAttempt && (
          <div className="flex min-h-32 items-center gap-4 border-b bg-muted/30 p-4">
            <img
              className="import-preview max-h-24 max-w-32 rounded-md object-contain"
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
          </div>
        )}
        <Textarea
          ref={editorRef}
          className="min-h-(--composer-editor-height) resize-none border-0 p-5 shadow-none"
          aria-label="New note content"
          placeholder="Paste or Start Typing…"
          value={draft}
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />
      </CardContent>
      {composerError && (
        <Alert className="mx-4 mb-4" variant="destructive">
          <AlertTitle>Unable to Save</AlertTitle>
          <AlertDescription>{composerError}</AlertDescription>
        </Alert>
      )}
      <CardFooter className="justify-between border-t py-3">
        <span className="text-xs text-muted-foreground">
          Ctrl+Enter saves · Escape retains draft
        </span>
        <Button
          size="sm"
          disabled={!draft.trim() || saving || importAttempt?.status === 'importing'}
          onClick={() => void save()}
        >
          {saving ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Check data-icon="inline-start" aria-hidden="true" />
          )}
          {saving ? 'Saving…' : 'Save Note'}
        </Button>
      </CardFooter>
    </Card>
  )
}
