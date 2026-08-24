import { forwardRef, useImperativeHandle, useRef } from 'react'

import {
  RichMarkdownEditor,
  type RichMarkdownEditorHandle,
  type RichMarkdownEditorOptions
} from '@/features/items/rich-markdown-editor'
import type { NoteEditorHandle, NoteEditorProps } from '@/features/items/note-editor'
import { cn } from '@/lib/utils'

interface NoteRichEditorProps extends NoteEditorProps {
  editable: boolean
  options: RichMarkdownEditorOptions
  presentation?: 'card' | 'detail'
  preserveScrollTopRef?: React.RefObject<number> | null
  preserveCursorOffsetRef?: React.RefObject<number | null> | null
  onError?: (message: string) => void
}

/**
 * Rich adapter: exposes the seam surface over the Milkdown rich editor. The rich
 * editor owns its internal cursor/scroll restore and its image/link options; the
 * adapter only routes Vim through the single seam contract and narrows the handle.
 */
export const NoteRichEditor = forwardRef<NoteEditorHandle, NoteRichEditorProps>(
  function NoteRichEditor(
    {
      value,
      active,
      editable,
      vimEnabled,
      vim,
      onChange,
      onError,
      className,
      options,
      presentation = 'detail',
      preserveScrollTopRef,
      preserveCursorOffsetRef
    },
    forwardedRef
  ): React.JSX.Element {
    const editorRef = useRef<RichMarkdownEditorHandle>(null)

    useImperativeHandle(
      forwardedRef,
      (): NoteEditorHandle => ({
        focus: () => editorRef.current?.focus(),
        getCursorOffset: () => editorRef.current?.getCursorOffset() ?? null,
        setCursorOffset: (offset) => editorRef.current?.setCursorOffset(offset)
      }),
      []
    )

    return (
      <RichMarkdownEditor
        ref={editorRef}
        value={value}
        editable={editable}
        active={active}
        options={options}
        presentation={presentation}
        preserveScrollTopRef={preserveScrollTopRef}
        preserveCursorOffsetRef={preserveCursorOffsetRef}
        className={cn(className)}
        vimEnabled={vimEnabled}
        onVimModeChange={vim.onModeChange}
        onVimWrite={vim.onWrite}
        onVimQuit={vim.onQuit}
        vimCommandLineHost={vim.commandLineHost}
        onChange={onChange}
        onError={onError}
      />
    )
  }
)
