import { forwardRef, useImperativeHandle, useRef } from 'react'

import type { CaptureSurface } from '../../../../shared/capture-contract'
import { LiveMarkdownEditor } from '@/features/items/live/live-markdown-editor'
import type { LiveEditorOptions } from '@/features/items/live/live-preview'
import type { SourceNoteHandle } from '@/features/items/note-editor'
import { cn } from '@/lib/utils'

export interface ComposerLiveMarkdownEditorHandle {
  focus: () => void
}

export const ComposerLiveMarkdownEditor = forwardRef<
  ComposerLiveMarkdownEditorHandle,
  {
    value: string
    placeholder: string
    disabled: boolean
    surface: CaptureSurface
    options?: LiveEditorOptions
    className?: string
    onChange: (value: string) => void
    onPasteImage: (file: File, insertAtSelection: (src: string) => void) => void
    onSave: () => void
    onContinueInEditor?: () => void
    onEscape: () => void
  }
>(function ComposerLiveMarkdownEditor(
  {
    value,
    placeholder,
    disabled,
    surface,
    options,
    className,
    onChange,
    onPasteImage,
    onSave,
    onContinueInEditor,
    onEscape
  },
  forwardedRef
): React.JSX.Element {
  const editorRef = useRef<SourceNoteHandle>(null)
  useImperativeHandle(forwardedRef, () => ({ focus: () => editorRef.current?.focus() }), [])

  return (
    <div
      className={cn('relative min-w-0', surface === 'quick' ? 'h-full' : 'min-h-32', className)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onEscape()
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          if (event.shiftKey && onContinueInEditor) onContinueInEditor()
          else onSave()
        }
      }}
    >
      {!value ? (
        <span
          className="typeset kuskus-typeset pointer-events-none absolute inset-0 text-muted-foreground/70"
          data-typeset-presentation="card"
          aria-hidden="true"
        >
          {placeholder}
        </span>
      ) : null}
      <LiveMarkdownEditor
        ref={editorRef}
        value={value}
        editable={!disabled}
        active={!disabled}
        liveOptions={{ ...options, onPasteImage }}
        className="relative z-[1] h-full"
        onChange={onChange}
      />
    </div>
  )
})

export type { LiveEditorOptions }
