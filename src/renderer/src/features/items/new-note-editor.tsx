import { useCallback, useEffect, useMemo, useState } from 'react'

import type {
  ActiveItemLocation,
  LibraryItemDto,
  NoteItemDto,
  UpdateNoteInput,
  UpdateNoteResult
} from '../../../../shared/library-contract'
import { encodeMarkdownImageTarget } from '../../../../shared/markdown-image-references'

export interface NewNoteRenderState {
  item: NoteItemDto
  persisted: boolean
  saveNote: (input: UpdateNoteInput) => Promise<UpdateNoteResult>
  onPasteImage: (file: File, insertAtSelection: (src: string) => void) => Promise<void>
  onItemUpdated: (item: LibraryItemDto) => void
}

class NewNotePersistence {
  private item: NoteItemDto | null = null
  private stagedAttachmentIds: string[] = []

  constructor(
    private readonly destination: ActiveItemLocation,
    private readonly onCreated: (
      note: NoteItemDto,
      destination: ActiveItemLocation
    ) => Promise<NoteItemDto> | NoteItemDto,
    private readonly onStatus: (message: string) => void
  ) {}

  accept(item: NoteItemDto): void {
    this.item = item
  }

  discardStagedAttachments(): void {
    for (const attachmentId of this.stagedAttachmentIds) {
      void window.kuskus.removeCaptureDraftImage(attachmentId)
    }
    this.stagedAttachmentIds = []
  }

  save = async (input: UpdateNoteInput): Promise<UpdateNoteResult> => {
    if (this.item) {
      return window.kuskus.updateNote({ ...input, itemId: this.item.id })
    }

    const created = await window.kuskus.createNote({
      markdown: input.markdown,
      attachmentIds: [...this.stagedAttachmentIds]
    })
    if (!created.ok) {
      return {
        ok: false,
        error: created.error,
        code: created.code === 'conflict' ? 'io-error' : created.code
      }
    }

    const placed = await this.onCreated(created.data, this.destination)
    this.item = placed
    this.stagedAttachmentIds = []
    this.onStatus('Note created.')
    return { ok: true, data: placed }
  }

  pasteImage = async (file: File, insertAtSelection: (src: string) => void): Promise<void> => {
    if (this.item) {
      const result = await window.kuskus.importNoteImage({
        itemId: this.item.id,
        bytes: await file.arrayBuffer(),
        mediaType: file.type,
        sourceFilename: file.name || null,
        origin: 'clipboard'
      })
      if (!result.ok) throw new Error(result.error)
      insertAtSelection(encodeMarkdownImageTarget(result.data.relativePath))
      return
    }

    const result = await window.kuskus.stageCaptureDraftImage({
      bytes: await file.arrayBuffer(),
      mediaType: file.type,
      sourceFilename: file.name || null,
      origin: 'clipboard'
    })
    if (!result.ok) throw new Error(result.error)
    this.stagedAttachmentIds = [...this.stagedAttachmentIds, result.data.id]
    insertAtSelection(encodeMarkdownImageTarget(result.data.relativePath))
  }
}

export function NewNoteEditor({
  initialItem,
  destination,
  onCreated,
  onStatus,
  onItemChange,
  children
}: {
  initialItem: NoteItemDto
  destination: ActiveItemLocation
  onCreated: (
    note: NoteItemDto,
    destination: ActiveItemLocation
  ) => Promise<NoteItemDto> | NoteItemDto
  onStatus: (message: string) => void
  onItemChange: (item: NoteItemDto) => void
  children: (state: NewNoteRenderState) => React.ReactNode
}): React.JSX.Element {
  const [item, setItem] = useState(initialItem)
  const [persisted, setPersisted] = useState(false)
  const [persistence] = useState(() => new NewNotePersistence(destination, onCreated, onStatus))

  useEffect(() => () => persistence.discardStagedAttachments(), [persistence])

  const onItemUpdated = useCallback(
    (nextItem: LibraryItemDto): void => {
      if (nextItem.type !== 'note') return
      persistence.accept(nextItem)
      setPersisted(true)
      setItem(nextItem)
      onItemChange(nextItem)
    },
    [onItemChange, persistence]
  )

  const saveNote = persistence.save
  const onPasteImage = persistence.pasteImage

  const renderState = useMemo<NewNoteRenderState>(
    () => ({
      item,
      persisted,
      saveNote,
      onPasteImage,
      onItemUpdated
    }),
    [item, onItemUpdated, onPasteImage, persisted, saveNote]
  )

  return <>{children(renderState)}</>
}
