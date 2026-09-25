import { forwardRef, useImperativeHandle, useRef } from 'react'

import type {
  NoteEditorProps,
  NoteFindTargetRef,
  SourceNoteHandle
} from '@/features/items/note-editor'
import {
  LiveMarkdownEditor,
  type LiveMarkdownEditorProps
} from '@/features/items/live/live-markdown-editor'
import type { LiveEditorOptions } from '@/features/items/live/live-preview'
import { cn } from '@/lib/utils'

interface NoteLiveEditorProps extends NoteEditorProps {
  editable: boolean
  contentFoldingEnabled: boolean
  liveOptions: LiveEditorOptions
  topContent?: React.ReactNode
  preserveScrollTopRef?: React.RefObject<number | null> | null
  findTarget?: NoteFindTargetRef
  onScroll?: (scroller: HTMLElement) => void
}

/**
 * Live adapter: exposes the seam surface over the CodeMirror live editor.
 * Mirrors NoteRichEditor so the detail dialog can select the live engine
 * without knowing which one is mounted.
 */
export const NoteLiveEditor = forwardRef<SourceNoteHandle, NoteLiveEditorProps>(
  function NoteLiveEditor(
    {
      value,
      active,
      editable,
      contentFoldingEnabled,
      vimEnabled,
      vim,
      onChange,
      className,
      liveOptions,
      topContent,
      preserveScrollTopRef,
      findTarget,
      onScroll
    },
    forwardedRef
  ): React.JSX.Element {
    const editorRef = useRef<SourceNoteHandle>(null)

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
      <LiveMarkdownEditor
        ref={editorRef}
        value={value}
        active={active}
        editable={editable}
        contentFoldingEnabled={contentFoldingEnabled}
        liveOptions={liveOptions}
        topContent={topContent}
        preserveScrollTopRef={preserveScrollTopRef}
        findTarget={findTarget}
        className={cn('flex-1', className)}
        onChange={onChange}
        onScroll={onScroll}
        vimEnabled={vimEnabled}
        onVimModeChange={vim.onModeChange}
        onVimWrite={vim.onWrite}
        onVimQuit={vim.onQuit}
        vimCommandLineHost={vim.commandLineHost}
      />
    )
  }
)

export type { LiveMarkdownEditorProps }
