import { forwardRef, useImperativeHandle, useRef } from 'react'

import { MarkdownEditor } from '@/features/items/markdown-editor'
import type { MarkdownEditorHandle } from '@/features/items/markdown-editor'
import type {
  NoteEditorProps,
  NoteFindTargetRef,
  SourceNoteHandle
} from '@/features/items/note-editor'
import { cn } from '@/lib/utils'

interface NoteSourceEditorProps extends NoteEditorProps {
  header?: React.ReactNode
  onPasteImage?: (file: File, insertAtSelection: (src: string) => void) => void
  onScroll?: (scroller: HTMLElement) => void
  findTarget?: NoteFindTargetRef
}

/**
 * Source adapter: exposes the seam surface over the CodeMirror Markdown editor and
 * adds the split/undo surface that only the source engine provides. Vim callbacks
 * are routed through the single seam contract.
 */
export const NoteSourceEditor = forwardRef<SourceNoteHandle, NoteSourceEditorProps>(
  function NoteSourceEditor(
    {
      value,
      active,
      vimEnabled,
      vim,
      onChange,
      className,
      header,
      onPasteImage,
      onScroll,
      findTarget
    },
    forwardedRef
  ): React.JSX.Element {
    const editorRef = useRef<MarkdownEditorHandle>(null)

    useImperativeHandle(
      forwardedRef,
      (): SourceNoteHandle => ({
        focus: () => editorRef.current?.focus(),
        getSelection: () => editorRef.current?.getSelection() ?? null,
        setSelection: (selection) => editorRef.current?.setSelection(selection),
        getScroller: () => editorRef.current?.getScroller() ?? null,
        requestMeasure: () => editorRef.current?.requestMeasure(),
        redo: () => editorRef.current?.redo() ?? false,
        undo: () => editorRef.current?.undo() ?? false
      }),
      []
    )

    return (
      <MarkdownEditor
        ref={editorRef}
        value={value}
        active={active}
        className={cn('flex-1', className)}
        header={header}
        onChange={onChange}
        onPasteImage={onPasteImage}
        onScroll={onScroll}
        vimEnabled={vimEnabled}
        onVimModeChange={vim.onModeChange}
        onVimWrite={vim.onWrite}
        onVimQuit={vim.onQuit}
        vimCommandLineHost={vim.commandLineHost}
        findTarget={findTarget}
      />
    )
  }
)
