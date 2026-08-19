import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  undo
} from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { bracketMatching, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { EditorSelection, EditorState, RangeSetBuilder, Transaction } from '@codemirror/state'
import {
  Decoration,
  DecorationSet,
  EditorView,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  ViewPlugin,
  type ViewUpdate,
  WidgetType
} from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'

import { getPublishedMarkdownChange } from '@/features/items/markdown-editor-change'
import { toggleMarkdownMarker } from '@/features/items/markdown-formatting'
import { markdownFrontmatter } from '@/features/items/markdown-frontmatter'
import { markdownHighlightStyle } from '@/features/items/markdown-highlight-style'
import {
  continueTable,
  convertTablePaste,
  formatMarkdownTable,
  insertMarkdownTable,
  insertTableRowBelow,
  moveTableCursor,
  moveTableRow
} from '@/features/items/markdown-table'
import { markdownTableGuides } from '@/features/items/markdown-table-guides'
import { cn } from '@/lib/utils'
import { markdownCodeLanguage } from '@/features/items/markdown-code'
import { markdownSearchTheme } from '@/features/items/markdown-search-theme'

export interface MarkdownEditorHandle {
  focus: () => void
  getScroller: () => HTMLElement | null
  requestMeasure: () => void
  redo: () => boolean
  undo: () => boolean
}

interface MarkdownEditorProps {
  value: string
  active: boolean
  className?: string
  header?: React.ReactNode
  onChange: (value: string) => void
  onPasteImage?: (file: File, insertAtSelection: (src: string) => void) => void
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
    // Keep every note mode on the same centered document frame while the
    // full-width scroller leaves its scrollbar at the pane edge.
    maxWidth: 'var(--detail-document-max-width)',
    margin: '0 auto',
    padding: '2.5rem var(--typeset-detail-gutter)',
    caretColor: 'currentColor'
  },
  '.cm-line': { padding: '0' },
  '.cm-markdown-header': {
    width: '100%',
    whiteSpace: 'normal',
    fontFamily: 'var(--font-sans)'
  },
  '.cm-markdown-header:not(:empty)': { paddingBottom: '1.5rem' },
  '.cm-kuskus-task-marker': { cursor: 'pointer' },
  '&.cm-kuskus-detail-editor.cm-focused .cm-activeLine': {
    backgroundColor: 'color-mix(in oklab, var(--foreground) 7%, transparent)',
    borderRadius: '0.25rem'
  }
})

class MarkdownHeaderWidget extends WidgetType {
  toDOM(): HTMLElement {
    const host = document.createElement('div')
    host.className = 'cm-markdown-header'
    return host
  }
}

const markdownHeader = EditorView.decorations.of(
  Decoration.set([
    Decoration.widget({ widget: new MarkdownHeaderWidget(), block: true, side: -1 }).range(0)
  ])
)

function toggleTaskCheckbox(view: EditorView, position: number): void {
  const doc = view.state.doc
  if (position < 0 || position + 3 > doc.length) return
  const marker = doc.sliceString(position, position + 3)
  if (!/^\[[ xX]\]$/.test(marker)) return
  const checked = marker[1] !== ' '
  view.dispatch({
    changes: { from: position, to: position + 3, insert: checked ? '[ ]' : '[x]' },
    annotations: Transaction.addToHistory.of(true),
    userEvent: 'input'
  })
  view.focus()
}

function taskMarkerAt(view: EditorView, position: number): number {
  let marker = -1
  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (marker !== -1) return false
      if (node.name !== 'Task') return true
      const markerNode = node.node.firstChild
      if (
        markerNode &&
        markerNode.name === 'TaskMarker' &&
        position >= markerNode.from &&
        position <= markerNode.to
      ) {
        marker = markerNode.from
      }
      return false
    }
  })
  return marker
}

function taskMarkerDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (node.name !== 'Task') return true
      const marker = node.node.firstChild
      if (marker && marker.name === 'TaskMarker') {
        builder.add(marker.from, marker.to, Decoration.mark({ class: 'cm-kuskus-task-marker' }))
      }
      return false
    }
  })
  return builder.finish()
}

const taskMarkerPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = taskMarkerDecorations(view)
    }
    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = taskMarkerDecorations(update.view)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations }
)

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
    { value, active, className, header, onChange, onPasteImage, onScroll },
    forwardedRef
  ): React.JSX.Element {
    const hostRef = useRef<HTMLDivElement>(null)
    const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null)
    const viewRef = useRef<EditorView | null>(null)
    const initialValueRef = useRef(value)
    const publishedRef = useRef<string | null>(null)
    const onChangeRef = useRef(onChange)
    const onPasteImageRef = useRef(onPasteImage)
    const onScrollRef = useRef(onScroll)
    useLayoutEffect(() => {
      onChangeRef.current = onChange
      onPasteImageRef.current = onPasteImage
      onScrollRef.current = onScroll
    })

    useImperativeHandle(
      forwardedRef,
      () => ({
        focus: () => {
          const view = viewRef.current
          if (!view) return
          const { head } = view.state.selection.main
          view.dispatch({ selection: EditorSelection.cursor(head) })
          view.focus()
        },
        getScroller: () => viewRef.current?.scrollDOM ?? null,
        requestMeasure: () => viewRef.current?.requestMeasure(),
        redo: () => (viewRef.current ? redo(viewRef.current) : false),
        undo: () => (viewRef.current ? undo(viewRef.current) : false)
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
            markdown({ extensions: [GFM, markdownFrontmatter], codeLanguages: markdownCodeLanguage }),
            bracketMatching(),
            highlightSpecialChars(),
            highlightActiveLine(),
            highlightSelectionMatches(),
            EditorView.editorAttributes.of({ class: 'cm-kuskus-detail-editor' }),
            // Keep the cursor roughly four lines above the pane bottom while
            // typing instead of letting it settle at the last line.
            EditorView.scrollMargins.of(() => ({ bottom: 112 })),
            markdownHeader,
            taskMarkerPlugin,
            markdownTableGuides,
            editorTheme,
            markdownSearchTheme,
            syntaxHighlighting(markdownHighlightStyle),
            keymap.of([
              { key: 'Mod-b', preventDefault: true, run: markerCommand('**') },
              { key: 'Mod-i', preventDefault: true, run: markerCommand('*') },
              { key: 'Mod-Shift-T', preventDefault: true, run: insertMarkdownTable },
              { key: 'Mod-Alt-T', preventDefault: true, run: formatMarkdownTable },
              { key: 'Tab', run: (view) => moveTableCursor(view, 1) },
              { key: 'Shift-Tab', run: (view) => moveTableCursor(view, -1) },
              { key: 'Enter', run: continueTable },
              { key: 'Ctrl-Enter', run: insertTableRowBelow },
              { key: 'Alt-ArrowUp', run: (view) => moveTableRow(view, -1) },
              { key: 'Alt-ArrowDown', run: (view) => moveTableRow(view, 1) },
              indentWithTab,
              ...defaultKeymap,
              ...historyKeymap,
              ...searchKeymap
            ]),
            EditorView.contentAttributes.of({
              'aria-label': 'Markdown editor',
              autocapitalize: 'off',
              autocomplete: 'off',
              spellcheck: 'true'
            }),
            EditorView.domEventHandlers({
              mousedown: (event, editor) => {
                if (event.button !== 0) return false
                const position = editor.posAtCoords({ x: event.clientX, y: event.clientY })
                if (position === null) return false
                const marker = taskMarkerAt(editor, position)
                if (marker === -1) return false
                event.preventDefault()
                toggleTaskCheckbox(editor, marker)
                return true
              },
              paste: (event, editor) => {
                const file = Array.from(event.clipboardData?.items ?? [])
                  .find((entry) => entry.type.startsWith('image/'))
                  ?.getAsFile()
                const pasteImage = onPasteImageRef.current
                if (file && pasteImage) {
                  event.preventDefault()
                  const { from, to } = editor.state.selection.main
                  const pastedInto = editor.state.doc
                  pasteImage(file, (src) => {
                    if (viewRef.current !== editor) return
                    const range =
                      editor.state.doc === pastedInto ? { from, to } : editor.state.selection.main
                    const image = `![image](${src})`
                    editor.dispatch({
                      changes: { from: range.from, to: range.to, insert: image },
                      selection: { anchor: range.from + image.length },
                      userEvent: 'input.paste'
                    })
                    editor.focus()
                  })
                  return true
                }
                const text = event.clipboardData?.getData('text/plain') ?? ''
                const table = convertTablePaste(text)
                if (!table) return false
                event.preventDefault()
                const { from, to } = editor.state.selection.main
                const prefix =
                  from > 0 && editor.state.doc.sliceString(from - 1, from) !== '\n' ? '\n' : ''
                const suffix =
                  to < editor.state.doc.length && editor.state.doc.sliceString(to, to + 1) !== '\n'
                    ? '\n'
                    : ''
                const insert = `${prefix}${table}${suffix}`
                editor.dispatch({
                  changes: { from, to, insert },
                  selection: { anchor: from + prefix.length },
                  userEvent: 'input.paste'
                })
                editor.focus()
                return true
              }
            }),
            EditorView.updateListener.of((update) => {
              const markdownChange = getPublishedMarkdownChange(
                update.docChanged,
                update.state.doc.toString()
              )
              if (markdownChange !== null) {
                publishedRef.current = markdownChange
                onChangeRef.current(markdownChange)
              }
            })
          ]
        })
      })
      viewRef.current = view
      setHeaderHost(view.dom.querySelector<HTMLElement>('.cm-markdown-header'))

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
      if (!view || publishedRef.current === value || view.state.doc.toString() === value) return
      const { anchor, head } = view.state.selection.main
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
        selection: EditorSelection.range(
          Math.min(anchor, value.length),
          Math.min(head, value.length)
        ),
        annotations: Transaction.addToHistory.of(true)
      })
    }, [value])

    useEffect(() => {
      const view = viewRef.current
      if (!view || !active) return
      view.requestMeasure()
      view.focus()
    }, [active])

    return (
      <>
        <div ref={hostRef} className={cn('size-full min-h-0', className)} />
        {header && headerHost ? createPortal(header, headerHost) : null}
      </>
    )
  }
)
