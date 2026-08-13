import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { bracketMatching, syntaxHighlighting } from '@codemirror/language'
import { Compartment, EditorState, Transaction } from '@codemirror/state'
import { EditorView, highlightSpecialChars, keymap } from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'

import type { CaptureSurface } from '../../../../shared/capture-contract'
import { markdownLiveHighlightStyle } from '@/features/items/markdown-highlight-style'
import {
  liveMarkdownPreview,
  livePreviewInvalidation,
  type LivePreviewOptions
} from '@/features/items/markdown-live-preview'
import { cn } from '@/lib/utils'
import { markdownCodeLanguage } from '@/features/items/markdown-code'
import { markdownSearchTheme } from '@/features/items/markdown-search-theme'

export interface ComposerMarkdownEditorHandle {
  focus: () => void
  getSelection: () => { from: number; to: number }
}

interface ComposerMarkdownEditorProps {
  value: string
  placeholder: string
  disabled: boolean
  surface: CaptureSurface
  liveOptions?: LivePreviewOptions
  className?: string
  onChange: (value: string) => void
  transformInput?: (before: string, after: string) => string | null
  onPasteImage: (file: File, from: number, to: number) => void
  onSave: () => void
  onContinueInEditor?: () => void
  onEscape: () => void
}

function composerTheme(surface: CaptureSurface): ReturnType<typeof EditorView.theme> {
  return EditorView.theme({
    '&':
      surface === 'quick'
        ? { height: '100%', backgroundColor: 'transparent', color: 'var(--foreground)' }
        : {
            minHeight: '8rem',
            maxHeight: '24rem',
            backgroundColor: 'transparent',
            color: 'var(--foreground)'
          },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: 'var(--font-sans)',
      fontSize: '0.875rem',
      lineHeight: '1.5'
    },
    '.cm-scroller::-webkit-scrollbar': { width: '0.625rem', height: '0.625rem' },
    '.cm-scroller::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
    '.cm-scroller::-webkit-scrollbar-thumb': {
      backgroundColor: 'var(--border)',
      backgroundClip: 'padding-box',
      border: '1px solid transparent',
      borderRadius: '9999px'
    },
    '.cm-scroller::-webkit-scrollbar-button': { display: 'none', width: '0', height: '0' },
    '.cm-scroller::-webkit-scrollbar-corner': { backgroundColor: 'transparent' },
    '.cm-content': {
      boxSizing: 'border-box',
      minHeight: surface === 'quick' ? '100%' : 'auto',
      padding: '0.5rem 0.25rem',
      caretColor: 'currentColor'
    },
    '.cm-line': { padding: '0' }
  })
}

export const ComposerMarkdownEditor = forwardRef<
  ComposerMarkdownEditorHandle,
  ComposerMarkdownEditorProps
>(function ComposerMarkdownEditor(
  {
    value,
    placeholder: placeholderText,
    disabled,
    surface,
    liveOptions,
    className,
    onChange,
    transformInput,
    onPasteImage,
    onSave,
    onContinueInEditor,
    onEscape
  },
  forwardedRef
): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const initialValueRef = useRef(value)
  const initialDisabledRef = useRef(disabled)
  const initialSurfaceRef = useRef(surface)
  const onChangeRef = useRef(onChange)
  const transformRef = useRef(transformInput)
  const liveOptionsRef = useRef<LivePreviewOptions>(liveOptions ?? {})
  const actionsRef = useRef({ onPasteImage, onSave, onContinueInEditor, onEscape })
  const editableCompartmentRef = useRef(new Compartment())

  useLayoutEffect(() => {
    onChangeRef.current = onChange
    transformRef.current = transformInput
    liveOptionsRef.current = liveOptions ?? {}
    actionsRef.current = { onPasteImage, onSave, onContinueInEditor, onEscape }
  })

  useImperativeHandle(
    forwardedRef,
    () => ({
      focus: () => viewRef.current?.focus(),
      getSelection: () => {
        const selection = viewRef.current?.state.selection.main
        return { from: selection?.from ?? 0, to: selection?.to ?? 0 }
      }
    }),
    []
  )

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          history(),
          EditorView.lineWrapping,
          markdown({ extensions: GFM, codeLanguages: markdownCodeLanguage }),
          bracketMatching(),
          highlightSpecialChars(),
          highlightSelectionMatches(),
          syntaxHighlighting(markdownLiveHighlightStyle),
          composerTheme(initialSurfaceRef.current),
          markdownSearchTheme,
          editableCompartmentRef.current.of([
            EditorView.editable.of(!initialDisabledRef.current),
            EditorState.readOnly.of(initialDisabledRef.current)
          ]),
          liveMarkdownPreview(() => liveOptionsRef.current, 'card'),
          keymap.of([
            {
              key: 'Mod-Shift-Enter',
              run: () => {
                const action = actionsRef.current.onContinueInEditor
                if (!action) return false
                action()
                return true
              }
            },
            {
              key: 'Mod-Enter',
              preventDefault: true,
              run: () => {
                actionsRef.current.onSave()
                return true
              }
            },
            {
              key: 'Escape',
              run: () => {
                actionsRef.current.onEscape()
                return true
              }
            },
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap
          ]),
          EditorView.domEventHandlers({
            paste(event, view) {
              const file = Array.from(event.clipboardData?.items ?? [])
                .find((entry) => entry.type.startsWith('image/'))
                ?.getAsFile()
              if (!file) return false
              event.preventDefault()
              const selection = view.state.selection.main
              actionsRef.current.onPasteImage(file, selection.from, selection.to)
              return true
            }
          }),
          EditorView.contentAttributes.of({
            'aria-label': 'Markdown note or link',
            autocapitalize: 'off',
            autocomplete: 'off',
            spellcheck: 'true'
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return
            const after = update.state.doc.toString()
            const userEdited = update.transactions.some(
              (transaction) =>
                transaction.docChanged &&
                (transaction.isUserEvent('input') || transaction.isUserEvent('delete'))
            )
            if (userEdited && transformRef.current) {
              const transformed = transformRef.current(update.startState.doc.toString(), after)
              if (transformed !== null && transformed !== after) {
                update.view.dispatch({
                  changes: { from: 0, to: after.length, insert: transformed },
                  selection: { anchor: transformed.length }
                })
                return
              }
            }
            onChangeRef.current(after)
          })
        ]
      })
    })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view || view.state.doc.toString() === value) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      annotations: Transaction.addToHistory.of(false)
    })
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: editableCompartmentRef.current.reconfigure([
        EditorView.editable.of(!disabled),
        EditorState.readOnly.of(disabled)
      ])
    })
  }, [disabled])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: livePreviewInvalidation.of(null) })
  }, [liveOptions])

  return (
    <div className={cn('relative min-w-0', className)}>
      {value.length === 0 ? (
        <span
          className="pointer-events-none absolute inset-x-1 top-2 z-0 font-sans text-[15px] leading-[1.75] text-muted-foreground/70"
          aria-hidden="true"
        >
          {placeholderText}
        </span>
      ) : null}
      <div ref={hostRef} className="relative z-[1] h-full min-w-0" />
    </div>
  )
})
