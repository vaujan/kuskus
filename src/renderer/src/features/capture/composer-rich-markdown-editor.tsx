import { forwardRef, useImperativeHandle, useRef } from 'react'

import type { CaptureSurface } from '../../../../shared/capture-contract'
import {
  RichMarkdownEditor,
  type RichMarkdownEditorHandle,
  type RichMarkdownEditorOptions
} from '@/features/items/rich-markdown-editor'
import { cn } from '@/lib/utils'

export interface ComposerRichMarkdownEditorHandle {
  focus: () => void
}

export const ComposerRichMarkdownEditor = forwardRef<
  ComposerRichMarkdownEditorHandle,
  {
    value: string
    placeholder: string
    disabled: boolean
    surface: CaptureSurface
    options?: RichMarkdownEditorOptions
    className?: string
    onChange: (value: string) => void
    onPasteImage: (file: File, insertAtSelection: (src: string) => void) => void
    onSave: () => void
    onContinueInEditor?: () => void
    onEscape: () => void
  }
>(function ComposerRichMarkdownEditor(
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
  const editorRef = useRef<RichMarkdownEditorHandle>(null)
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
      <RichMarkdownEditor
        ref={editorRef}
        value={value}
        editable={!disabled}
        active={!disabled}
        options={{ ...options, onPasteImage }}
        presentation="card"
        className="relative z-[1] h-full"
        onChange={onChange}
      />
    </div>
  )
})
