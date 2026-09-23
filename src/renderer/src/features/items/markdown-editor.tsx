import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  undo
} from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { bracketMatching, indentUnit, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import {
  Compartment,
  EditorSelection,
  EditorState,
  Prec,
  RangeSetBuilder,
  StateEffect,
  Transaction,
  type Extension
} from '@codemirror/state'
import {
  Decoration,
  DecorationSet,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  ViewPlugin,
  type ViewUpdate,
  WidgetType
} from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import { classHighlighter } from '@lezer/highlight'
import { highlightSelectionMatches } from '@codemirror/search'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'

import { getPublishedMarkdownChange } from '@/features/items/markdown-editor-change'
import { toggleMarkdownMarker } from '@/features/items/markdown-formatting'
import { markdownCodeSpellcheck } from '@/features/items/markdown-code-spellcheck'
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
import type { NoteFindTargetRef } from '@/features/items/note-editor'
import { liveFindExtensions, unwireLiveFind, wireLiveFind } from '@/features/items/live/live-find'
import { slashMenu } from '@/features/items/live/slash-menu'
import {
  markdownVim,
  registerMarkdownVimActions,
  unwireMarkdownVimCommandLine,
  unregisterMarkdownVimActions,
  unwireMarkdownVimMode,
  wireMarkdownVimCommandLine,
  wireMarkdownVimMode
} from '@/features/items/markdown-vim'
import type { NoteVimMode } from '@/features/items/note-vim-mode'
import { clampNoteSelection, type NoteSelection } from '@/features/items/note-editor'
import { useSetting } from '@/settings/settings-context'

export interface MarkdownEditorHandle {
  focus: () => void
  getScroller: () => HTMLElement | null
  requestMeasure: () => void
  getSelection: () => NoteSelection | null
  setSelection: (selection: NoteSelection | null) => void
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
  vimEnabled?: boolean
  onVimModeChange?: (mode: NoteVimMode | null) => void
  onVimWrite?: () => void
  onVimQuit?: () => void
  vimCommandLineHost?: React.RefObject<HTMLElement | null>
  findTarget?: NoteFindTargetRef
}

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--foreground)',
    backgroundColor: 'transparent'
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    overflowY: 'auto',
    overflowX: 'hidden',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--markdown-source-font-size, 14px)',
    lineHeight: '1.7'
  },
  // Match the shared ScrollArea design (10px lane, 8px rounded border-colored thumb,
  // transparent track, no buttons) instead of Chromium's flat thin standard scrollbar.
  '.cm-scroller::-webkit-scrollbar': {
    width: 'var(--detail-editor-scrollbar-size, 0.625rem)',
    height: 'var(--detail-editor-scrollbar-size, 0.625rem)'
  },
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
    padding: 'var(--typeset-detail-padding-block) var(--typeset-detail-gutter)',
    caretColor: 'currentColor'
  },
  '.cm-line': { padding: '0' },
  // Line-number gutter follows the document surface: no panel background or
  // border, just quiet numbers that step aside for the active line.
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8125rem',
    color: 'color-mix(in oklch, var(--muted-foreground) 60%, transparent)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--muted-foreground)'
  },
  '.cm-markdown-header': {
    width: '100%',
    whiteSpace: 'normal',
    fontFamily: 'var(--font-sans)'
  },
  '.cm-markdown-header:not(:empty)': { paddingBottom: '1.5rem' },
  '.cm-kuskus-task-marker': {
    cursor: 'pointer',
    color: 'var(--primary)',
    fontWeight: '500'
  },
  '.cm-kuskus-list-level-0': {
    color: 'color-mix(in oklch, var(--primary) 78%, var(--foreground))'
  },
  '.cm-kuskus-list-level-1': {
    color: 'color-mix(in oklch, var(--primary) 58%, var(--foreground))'
  },
  '.cm-kuskus-list-level-2': {
    color: 'color-mix(in oklch, var(--primary) 42%, var(--foreground))'
  },
  '.cm-kuskus-list-level-3': {
    color: 'color-mix(in oklch, var(--primary) 30%, var(--foreground))'
  },
  // Text selection follows the primary theme instead of the neutral default.
  '&::selection, & ::selection': {
    backgroundColor: 'color-mix(in oklch, var(--primary) 25%, transparent)'
  },
  '&.cm-kuskus-detail-editor.cm-focused .cm-activeLine': {
    backgroundColor: 'color-mix(in oklab, var(--foreground) 7%, transparent)',
    borderRadius: '0.25rem'
  }
})

// Vim mode reuses the native text selection instead of CodeMirror's padded
// selection rectangles, so the highlight hugs the glyphs like the other note
// modes. Both libraries hide native selection via `Prec.highest` themes that
// are mounted AFTER ours (order is reversed), so these rules must beat them
// with a higher-specificity selector, not with ordering. The `&` keeps the
// scope class on the same editor element as `cm-kuskus-detail-editor`, since
// a descendant combinator would never match when both land on `view.dom`.
const vimModeTheme = Prec.highest(
  EditorView.theme({
    '&.cm-kuskus-detail-editor .cm-vimMode .cm-line::selection, &.cm-kuskus-detail-editor .cm-vimMode .cm-line ::selection':
      {
        backgroundColor: 'color-mix(in oklch, var(--primary) 25%, transparent) !important'
      },
    '.cm-vimMode .cm-fat-cursor': {
      background: 'var(--primary)',
      color: 'var(--primary-foreground) !important',
      border: 'none'
    },
    '.cm-editor:not(.cm-focused) .cm-vimMode .cm-fat-cursor': {
      background: 'none',
      outlineColor: 'var(--primary)',
      color: 'transparent !important'
    }
  })
)

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

type MarkdownSyntaxParent = {
  name: string
  parent: MarkdownSyntaxParent | null
}

function markdownListDepth(node: MarkdownSyntaxParent): number {
  let depth = 0
  let parent = node.parent
  while (parent) {
    if (parent.name === 'BulletList' || parent.name === 'OrderedList') depth += 1
    parent = parent.parent
  }
  return Math.max(0, depth - 1)
}

// Prefix widths are measured in visual columns (tabs jump to the state's tab
// stops, which CodeMirror also emits as the tab-size CSS it applies).
function visualColumns(text: string, tabSize: number): number {
  let columns = 0
  for (const char of text) {
    if (char === '\t') columns += tabSize - (columns % tabSize)
    else columns += 1
  }
  return columns
}

function markdownListMarkerWidth(line: string, tabSize: number): number | null {
  const marker = /^(\s*)(?:[*+-]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/.exec(line)
  if (!marker) return null
  // The hanging indent must span the whole prefix, leading indentation
  // included, so wrapped lines align under the item text. Measuring only the
  // marker would align nested items' wraps under their marker instead.
  return visualColumns(marker[0], tabSize)
}

function taskMarkerDecorations(view: EditorView): DecorationSet {
  const ranges: Array<{ from: number; to: number; decoration: Decoration }> = []
  const listLines = new Map<number, number>()
  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (node.name === 'ListItem') {
        const marker = node.node.firstChild
        if (!marker || marker.name !== 'ListMark') return true
        const depth = markdownListDepth(node.node)
        ranges.push({
          from: marker.from,
          to: marker.to,
          decoration: Decoration.mark({
            class: 'cm-kuskus-list-mark cm-kuskus-list-level-' + Math.min(depth, 3)
          })
        })
        const line = view.state.doc.lineAt(marker.from)
        const width = markdownListMarkerWidth(line.text, view.state.tabSize)
        if (width !== null) listLines.set(line.from, width)
        return true
      }
      if (node.name === 'TaskMarker') {
        const depth = markdownListDepth(node.node)
        ranges.push({
          from: node.from,
          to: node.to,
          decoration: Decoration.mark({
            class: 'cm-kuskus-task-marker cm-kuskus-list-level-' + Math.min(depth, 3)
          })
        })
      }
      return true
    }
  })
  for (const [from, width] of listLines) {
    ranges.push({
      from,
      to: from,
      decoration: Decoration.line({
        attributes: {
          class: 'cm-kuskus-list-line',
          style: 'padding-inline-start: ' + width + 'ch; text-indent: -' + width + 'ch'
        }
      })
    })
  }
  ranges.sort((left, right) => left.from - right.from || left.to - right.to)
  const builder = new RangeSetBuilder<Decoration>()
  for (const range of ranges) builder.add(range.from, range.to, range.decoration)
  return builder.finish()
}

const taskMarkerPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    private tree: ReturnType<typeof syntaxTree>
    constructor(view: EditorView) {
      this.tree = syntaxTree(view.state)
      this.decorations = taskMarkerDecorations(view)
    }
    update(update: ViewUpdate): void {
      // The Lezer parse advances asynchronously, so decorations must also
      // refresh when the tree object changes — list lines far from the last
      // edit would otherwise keep missing hanging indents after a note is
      // opened, until some unrelated edit happened to re-run this.
      const tree = syntaxTree(update.state)
      if (update.docChanged || update.viewportChanged || tree !== this.tree) {
        this.tree = tree
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
    {
      value,
      active,
      className,
      header,
      onChange,
      onPasteImage,
      onScroll,
      vimEnabled,
      onVimModeChange,
      onVimWrite,
      onVimQuit,
      vimCommandLineHost,
      findTarget
    },
    forwardedRef
  ): React.JSX.Element {
    const hostRef = useRef<HTMLDivElement>(null)
    const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null)
    const viewRef = useRef<EditorView | null>(null)
    const lineNumbersCompartment = useRef(new Compartment()).current
    const [showLineNumbers] = useSetting<boolean>('sourceLineNumbers')
    const initialShowLineNumbersRef = useRef(showLineNumbers)
    const initialValueRef = useRef(value)
    const publishedRef = useRef<string | null>(null)
    const onChangeRef = useRef(onChange)
    const onPasteImageRef = useRef(onPasteImage)
    const onScrollRef = useRef(onScroll)
    const onVimModeChangeRef = useRef(onVimModeChange)
    const onVimWriteRef = useRef(onVimWrite)
    const onVimQuitRef = useRef(onVimQuit)
    const vimCommandLineHostRef = useRef<React.RefObject<HTMLElement | null> | null>(
      vimCommandLineHost ?? null
    )
    const baseExtensionsRef = useRef<Extension[]>([])
    const vimActiveRef = useRef(false)
    const initialVimEnabledRef = useRef(vimEnabled === true)
    const findTargetRef = useRef<NoteFindTargetRef | null>(findTarget ?? null)
    useLayoutEffect(() => {
      onChangeRef.current = onChange
      onPasteImageRef.current = onPasteImage
      onScrollRef.current = onScroll
      onVimModeChangeRef.current = onVimModeChange
      onVimWriteRef.current = onVimWrite
      onVimQuitRef.current = onVimQuit
      vimCommandLineHostRef.current = vimCommandLineHost ?? null
      findTargetRef.current = findTarget ?? null
    })

    // Single activation path for vim, used both when the editor is created
    // (so a freshly mounted source pane is born in vim mode — StrictMode's
    // simulated remounts recreate the view, and a post-mount activation guard
    // would leave the new view without vim) and when the setting is toggled
    // while the editor is open.
    const activateMarkdownVim = useCallback((view: EditorView): void => {
      registerMarkdownVimActions(view, {
        write: () => onVimWriteRef.current?.(),
        quit: () => onVimQuitRef.current?.()
      })
      view.dispatch({
        effects: StateEffect.reconfigure.of([markdownVim, ...baseExtensionsRef.current])
      })
      wireMarkdownVimMode(view, (mode) => onVimModeChangeRef.current?.(mode))
      wireMarkdownVimCommandLine(view, vimCommandLineHostRef.current)
      onVimModeChangeRef.current?.('normal')
      vimActiveRef.current = true
    }, [])

    useImperativeHandle(
      forwardedRef,
      () => ({
        focus: () => {
          const view = viewRef.current
          if (!view) return
          view.focus()
        },
        getScroller: () => viewRef.current?.scrollDOM ?? null,
        requestMeasure: () => viewRef.current?.requestMeasure(),
        getSelection: () => {
          const selection = viewRef.current?.state.selection.main
          return selection ? { anchor: selection.anchor, head: selection.head } : null
        },
        setSelection: (selection) => {
          const view = viewRef.current
          if (!view || selection == null) return
          const { anchor, head } = clampNoteSelection(selection, view.state.doc.length)
          view.dispatch({
            selection: EditorSelection.range(anchor, head),
            scrollIntoView: true
          })
          view.focus()
        },
        redo: () => (viewRef.current ? redo(viewRef.current) : false),
        undo: () => (viewRef.current ? undo(viewRef.current) : false)
      }),
      []
    )

    useLayoutEffect(() => {
      const host = hostRef.current
      if (!host) return

      const baseExtensions: Extension[] = [
        history(),
        EditorView.lineWrapping,
        indentUnit.of('    '),
        // Multi-range selections power the vim plugin's visual block mode and
        // Alt-click extra cursors; CodeMirror clamps to one range without it.
        EditorState.allowMultipleSelections.of(true),
        markdown({ extensions: [GFM, markdownFrontmatter], codeLanguages: markdownCodeLanguage }),
        bracketMatching(),
        highlightSpecialChars(),
        highlightActiveLine(),
        lineNumbersCompartment.of(
          initialShowLineNumbersRef.current ? [lineNumbers(), highlightActiveLineGutter()] : []
        ),
        highlightSelectionMatches(),
        EditorView.editorAttributes.of({ class: 'cm-kuskus-detail-editor' }),
        // Keep the cursor roughly four lines above the pane bottom while
        // typing instead of letting it settle at the last line.
        EditorView.scrollMargins.of(() => ({ bottom: 112 })),
        markdownHeader,
        taskMarkerPlugin,
        markdownCodeSpellcheck,
        markdownTableGuides,
        editorTheme,
        vimModeTheme,
        liveFindExtensions(),
        slashMenu(),
        // Token classes for fenced code (tok-keyword, tok-string, …) shared with
        // the live editor and preview; the app's markdownHighlightStyle still
        // wins for Markdown markup itself.
        syntaxHighlighting(classHighlighter),
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
          ...historyKeymap
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
      baseExtensionsRef.current = baseExtensions

      const view = new EditorView({
        parent: host,
        state: EditorState.create({
          doc: initialValueRef.current,
          extensions: baseExtensions
        })
      })
      viewRef.current = view
      if (initialVimEnabledRef.current) activateMarkdownVim(view)
      if (findTargetRef.current) wireLiveFind(view, findTargetRef.current)
      setHeaderHost(view.dom.querySelector<HTMLElement>('.cm-markdown-header'))

      const handleScroll = (): void => onScrollRef.current?.(view.scrollDOM)
      view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true })

      return () => {
        view.scrollDOM.removeEventListener('scroll', handleScroll)
        unwireMarkdownVimMode(view)
        unwireMarkdownVimCommandLine(view)
        unregisterMarkdownVimActions(view)
        if (findTargetRef.current) unwireLiveFind(findTargetRef.current)
        view.destroy()
        viewRef.current = null
        // The flag describes vim state of THIS view; StrictMode's simulated
        // remount destroys and recreates the view while keeping refs, so the
        // re-run activation effect must see vim as off for the new view.
        vimActiveRef.current = false
      }
    }, [activateMarkdownVim, lineNumbersCompartment])

    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({
        effects: lineNumbersCompartment.reconfigure(
          showLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []
        )
      })
    }, [lineNumbersCompartment, showLineNumbers])

    useEffect(() => {
      const view = viewRef.current
      if (!view || vimEnabled === vimActiveRef.current) return
      if (!vimEnabled) {
        unwireMarkdownVimMode(view)
        unwireMarkdownVimCommandLine(view)
        unregisterMarkdownVimActions(view)
        onVimModeChangeRef.current?.(null)
        view.dispatch({ effects: StateEffect.reconfigure.of(baseExtensionsRef.current) })
        vimActiveRef.current = false
        return
      }
      registerMarkdownVimActions(view, {
        write: () => onVimWriteRef.current?.(),
        quit: () => onVimQuitRef.current?.()
      })
      view.dispatch({
        effects: StateEffect.reconfigure.of([markdownVim, ...baseExtensionsRef.current])
      })
      wireMarkdownVimMode(view, (mode) => onVimModeChangeRef.current?.(mode))
      wireMarkdownVimCommandLine(view, vimCommandLineHostRef.current)
      onVimModeChangeRef.current?.('normal')
      vimActiveRef.current = true
    }, [vimEnabled])

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
