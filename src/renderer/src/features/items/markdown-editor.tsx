import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting } from '@codemirror/language'
import {
  Compartment,
  EditorSelection,
  EditorState,
  Transaction,
  type Extension
} from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'

import { getPublishedMarkdownChange } from '@/features/items/markdown-editor-change'
import { toggleMarkdownMarker } from '@/features/items/markdown-formatting'
import {
  markdownHighlightStyle,
  markdownLiveHighlightStyle
} from '@/features/items/markdown-highlight-style'
import {
  liveMarkdownPreview,
  livePreviewInvalidation,
  type LivePreviewOptions
} from '@/features/items/markdown-live-preview'
import { cn } from '@/lib/utils'

export interface MarkdownEditorHandle {
  focus: () => void
  getScroller: () => HTMLElement | null
  requestMeasure: () => void
}

interface MarkdownEditorProps {
  value: string
  invalid: boolean
  active: boolean
  live?: boolean
  liveOptions?: LivePreviewOptions
  className?: string
  onChange: (value: string) => void
  onScroll?: (scroller: HTMLElement) => void
}

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--foreground)',
    backgroundColor: 'transparent'
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.875rem',
    lineHeight: '1.7'
  },
  // Match the shared ScrollArea design (10px lane, 8px rounded border-colored thumb,
  // transparent track, no buttons) instead of Chromium's flat thin standard scrollbar.
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
    minHeight: '100%',
    // Center the text column inside the full-width scroller so the scrollbar stays
    // at the pane edge, matching the Read mode article (max-w-3xl).
    maxWidth: '48rem',
    margin: '0 auto',
    padding: '2.5rem var(--typeset-detail-gutter)',
    caretColor: 'currentColor'
  },
  '.cm-line': { padding: '0' }
})

function markdownPresentation(live: boolean, getLiveOptions: () => LivePreviewOptions): Extension {
  return [
    syntaxHighlighting(live ? markdownLiveHighlightStyle : markdownHighlightStyle),
    live ? liveMarkdownPreview(getLiveOptions, 'detail') : []
  ]
}

function markerCommand(marker: '*' | '**'): (view: EditorView) => boolean {
  return (view) => {
    const selection = view.state.selection.main
    const edit = toggleMarkdownMarker(
      view.state.doc.toString(),
      selection.from,
      selection.to,
      marker
    )
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: edit.value },
      selection: EditorSelection.single(edit.selectionStart, edit.selectionEnd),
      userEvent: 'input'
    })
    return true
  }
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    { value, invalid, active, live = false, liveOptions, className, onChange, onScroll },
    forwardedRef
  ): React.JSX.Element {
    const hostRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const initialValueRef = useRef(value)
    const initialLiveRef = useRef(live)
    const onChangeRef = useRef(onChange)
    const onScrollRef = useRef(onScroll)
    const liveOptionsRef = useRef<LivePreviewOptions>(liveOptions ?? {})
    const liveCompartmentRef = useRef(new Compartment())
    const liveMountedRef = useRef(false)

    onChangeRef.current = onChange
    onScrollRef.current = onScroll
    liveOptionsRef.current = liveOptions ?? {}

    useImperativeHandle(
      forwardedRef,
      () => ({
        focus: () => viewRef.current?.focus(),
        getScroller: () => viewRef.current?.scrollDOM ?? null,
        requestMeasure: () => viewRef.current?.requestMeasure()
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
            markdown({ extensions: GFM }),
            EditorView.editorAttributes.of({ class: 'cm-kuskus-detail-editor' }),
            editorTheme,
            liveCompartmentRef.current.of(
              markdownPresentation(initialLiveRef.current, () => liveOptionsRef.current)
            ),
            keymap.of([
              { key: 'Mod-b', preventDefault: true, run: markerCommand('**') },
              { key: 'Mod-i', preventDefault: true, run: markerCommand('*') },
              ...defaultKeymap,
              ...historyKeymap
            ]),
            EditorView.contentAttributes.of({
              'aria-label': 'Markdown editor',
              autocapitalize: 'off',
              autocomplete: 'off',
              spellcheck: 'false'
            }),
            EditorView.updateListener.of((update) => {
              const markdownChange = getPublishedMarkdownChange(
                update.docChanged,
                update.state.doc.toString()
              )
              if (markdownChange !== null) onChangeRef.current(markdownChange)
            })
          ]
        })
      })
      viewRef.current = view

      const handleScroll = (): void => onScrollRef.current?.(view.scrollDOM)
      view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true })

      return () => {
        view.scrollDOM.removeEventListener('scroll', handleScroll)
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
      view.contentDOM.setAttribute('aria-invalid', String(invalid))
    }, [invalid])

    useEffect(() => {
      const view = viewRef.current
      if (!view || !active) return
      view.requestMeasure()
      view.focus()
    }, [active])

    useEffect(() => {
      if (!liveMountedRef.current) {
        liveMountedRef.current = true
        return
      }
      const view = viewRef.current
      if (!view) return
      view.dispatch({
        effects: liveCompartmentRef.current.reconfigure(
          markdownPresentation(live, () => liveOptionsRef.current)
        )
      })
    }, [live])

    useEffect(() => {
      const view = viewRef.current
      if (!view || !live) return
      view.dispatch({ effects: livePreviewInvalidation.of(null) })
    }, [live, liveOptions])

    return <div ref={hostRef} className={cn('size-full min-h-0', className)} />
  }
)
