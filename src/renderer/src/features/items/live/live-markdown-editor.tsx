import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  undo
} from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { bracketMatching, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { GFM } from '@lezer/markdown'
import { classHighlighter } from '@lezer/highlight'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import {
  Compartment,
  EditorSelection,
  EditorState,
  StateEffect,
  Transaction,
  Prec,
  type Extension
} from '@codemirror/state'
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap
} from '@codemirror/view'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef
} from 'react'

import { markdownEditorBlocks } from '@/features/items/markdown-editor-blocks'
import { getPublishedMarkdownChange } from '@/features/items/markdown-editor-change'
import { toggleMarkdownMarker } from '@/features/items/markdown-formatting'
import { markdownFrontmatter } from '@/features/items/markdown-frontmatter'
import { markdownHighlightStyle } from '@/features/items/markdown-highlight-style'
import { markdownCodeLanguage } from '@/features/items/markdown-code'
import { markdownSearchTheme } from '@/features/items/markdown-search-theme'
import { liveFindExtensions, wireLiveFind, unwireLiveFind } from '@/features/items/live/live-find'
import {
  kuskusLiveExtensions,
  readOnlyFacet,
  type LiveEditorOptions
} from '@/features/items/live/live-preview'
import {
  markdownVim,
  registerMarkdownVimActions,
  unregisterMarkdownVimActions,
  unwireMarkdownVimCommandLine,
  unwireMarkdownVimMode,
  wireMarkdownVimCommandLine,
  wireMarkdownVimMode
} from '@/features/items/markdown-vim'
import type { NoteFindTargetRef, SourceNoteHandle } from '@/features/items/note-editor'
import type { NoteVimMode } from '@/features/items/note-vim-mode'
import { cn } from '@/lib/utils'

export interface LiveMarkdownEditorProps {
  value: string
  active: boolean
  editable: boolean
  className?: string
  presentation?: 'card' | 'detail'
  topContent?: React.ReactNode
  preserveScrollTopRef?: React.RefObject<number | null> | null
  liveOptions?: LiveEditorOptions
  findTarget?: NoteFindTargetRef
  vimEnabled?: boolean
  onVimModeChange?: (mode: NoteVimMode | null) => void
  onVimWrite?: () => void
  onVimQuit?: () => void
  vimCommandLineHost?: React.RefObject<HTMLElement | null>
  onChange: (value: string) => void
  onScroll?: (scroller: HTMLElement) => void
}

const editorTheme = EditorView.theme({
  '&': { height: '100%', color: 'var(--foreground)', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.875rem',
    lineHeight: '1.7'
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
    minHeight: '100%',
    maxWidth: 'var(--detail-document-max-width)',
    margin: '0 auto',
    padding: '2.5rem var(--typeset-detail-gutter)',
    caretColor: 'currentColor'
  },
  '.cm-line': { padding: '0' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8125rem',
    color: 'color-mix(in oklch, var(--muted-foreground) 60%, transparent)'
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--muted-foreground)' },
  '&::selection, & ::selection': {
    backgroundColor: 'color-mix(in oklch, var(--primary) 25%, transparent)'
  },
  '.cm-kuskus-live.cm-focused .cm-activeLine': {
    backgroundColor: 'color-mix(in oklab, var(--foreground) 7%, transparent)',
    borderRadius: '0.25rem'
  },
  '.cm-kuskus-find-match': {
    borderRadius: '0.125rem',
    backgroundColor: 'color-mix(in oklch, var(--primary) 28%, transparent)'
  },
  '.cm-kuskus-find-current': {
    boxShadow: 'inset 0 0 0 1px var(--primary)',
    backgroundColor: 'color-mix(in oklch, var(--primary) 45%, transparent)'
  }
})

const liveEditorTheme = EditorView.theme({
  '&.cm-kuskus-live': {
    color: 'var(--typeset-body-color)',
    fontFamily: 'var(--typeset-font-body)',
    fontSize: 'var(--typeset-size)',
    lineHeight: 'var(--typeset-leading)'
  },
  '&.cm-kuskus-live .cm-scroller': {
    fontFamily: 'var(--typeset-font-body)',
    fontSize: 'var(--typeset-size)',
    lineHeight: 'var(--typeset-leading)'
  },
  '&.cm-kuskus-live .cm-activeLine': {
    backgroundColor: 'transparent'
  }
})

const vimModeTheme = Prec.highest(
  EditorView.theme({
    '&.cm-kuskus-live .cm-vimMode .cm-line::selection, &.cm-kuskus-live .cm-vimMode .cm-line ::selection':
      {
        backgroundColor: 'color-mix(in oklch, var(--primary) 25%, transparent) !important'
      },
    '.cm-vimMode .cm-fat-cursor': {
      background: 'var(--foreground)',
      color: 'var(--background) !important',
      border: 'none'
    },
    '.cm-editor:not(.cm-focused) .cm-vimMode .cm-fat-cursor': {
      background: 'none',
      outlineColor: 'var(--foreground)',
      color: 'transparent !important'
    }
  })
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

export const LiveMarkdownEditor = forwardRef<SourceNoteHandle, LiveMarkdownEditorProps>(
  function LiveMarkdownEditor(
    {
      value,
      active,
      editable,
      className,
      presentation = 'detail',
      topContent,
      preserveScrollTopRef,
      liveOptions,
      findTarget,
      vimEnabled,
      onVimModeChange,
      onVimWrite,
      onVimQuit,
      vimCommandLineHost,
      onChange,
      onScroll
    },
    forwardedRef
  ): React.JSX.Element {
    const hostRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const initialValueRef = useRef(value)
    const publishedRef = useRef<string | null>(null)
    const onChangeRef = useRef(onChange)
    const onScrollRef = useRef(onScroll)
    const liveOptionsRef = useRef<LiveEditorOptions>(liveOptions ?? {})
    const liveCompartmentRef = useRef(new Compartment())
    const blocksCompartmentRef = useRef(new Compartment())
    const blocksOptionsRef = useRef<{ content: React.ReactNode }>({ content: topContent })
    const vimActiveRef = useRef(false)
    const initialVimEnabledRef = useRef(vimEnabled === true)
    const findTargetRef = useRef<NoteFindTargetRef | null>(findTarget ?? null)
    const baseExtensionsRef = useRef<Extension[]>([])

    const onVimWriteRef = useRef(onVimWrite)
    const onVimQuitRef = useRef(onVimQuit)
    const onVimModeChangeRef = useRef(onVimModeChange)
    const vimCommandLineHostRef = useRef<React.RefObject<HTMLElement | null> | null>(
      vimCommandLineHost ?? null
    )

    useLayoutEffect(() => {
      onChangeRef.current = onChange
      onScrollRef.current = onScroll
      liveOptionsRef.current = liveOptions ?? {}
      findTargetRef.current = findTarget ?? null
      blocksOptionsRef.current = { content: topContent }
    })

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
      (): SourceNoteHandle => ({
        focus: () => {
          const view = viewRef.current
          if (!view) return
          const { head } = view.state.selection.main
          view.dispatch({ selection: EditorSelection.cursor(head) })
          view.focus()
        },
        getCursorOffset: () => viewRef.current?.state.selection.main.head ?? null,
        setCursorOffset: (offset) => {
          const view = viewRef.current
          if (!view || offset == null) return
          const clamped = Math.max(0, Math.min(offset, view.state.doc.length))
          view.dispatch({ selection: EditorSelection.cursor(clamped), scrollIntoView: true })
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

      const baseExtensions: Extension[] = [
        history(),
        EditorView.lineWrapping,
        indentUnit.of('    '),
        EditorState.allowMultipleSelections.of(true),
        markdown({ extensions: [GFM, markdownFrontmatter], codeLanguages: markdownCodeLanguage }),
        bracketMatching(),
        highlightSpecialChars(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        highlightSelectionMatches(),
        EditorView.editorAttributes.of({
          class: 'cm-kuskus-live kuskus-typeset cm-kuskus-detail-editor',
          'data-typeset-presentation': presentation
        }),
        EditorView.scrollMargins.of(() => ({ bottom: 112 })),
        liveEditorTheme,
        vimModeTheme,
        editorTheme,
        markdownSearchTheme,
        syntaxHighlighting(classHighlighter),
        syntaxHighlighting(markdownHighlightStyle),
        liveFindExtensions(),
        keymap.of([
          { key: 'Mod-b', preventDefault: true, run: markerCommand('**') },
          { key: 'Mod-i', preventDefault: true, run: markerCommand('*') },
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
          paste: (event, editor) => {
            const file = Array.from(event.clipboardData?.items ?? [])
              .find((entry) => entry.type.startsWith('image/'))
              ?.getAsFile()
            const onPasteImage = liveOptionsRef.current.onPasteImage
            if (file && onPasteImage) {
              event.preventDefault()
              const { from, to } = editor.state.selection.main
              const pastedInto = editor.state.doc
              onPasteImage(file, (src) => {
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
            return false
          }
        }),
        liveCompartmentRef.current.of(kuskusLiveExtensions(() => liveOptionsRef.current)),
        blocksCompartmentRef.current.of(markdownEditorBlocks(() => blocksOptionsRef.current)),
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

      const handleScroll = (): void => {
        if (preserveScrollTopRef) preserveScrollTopRef.current = view.scrollDOM.scrollTop
        onScrollRef.current?.(view.scrollDOM)
      }
      view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true })

      if (preserveScrollTopRef?.current != null) {
        view.scrollDOM.scrollTop = preserveScrollTopRef.current
      }

      return () => {
        view.scrollDOM.removeEventListener('scroll', handleScroll)
        unwireMarkdownVimMode(view)
        unwireMarkdownVimCommandLine(view)
        unregisterMarkdownVimActions(view)
        if (findTargetRef.current) unwireLiveFind(findTargetRef.current)
        view.destroy()
        viewRef.current = null
        vimActiveRef.current = false
      }
    }, [activateMarkdownVim, preserveScrollTopRef, presentation])

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

    // Sync React → editor when the value changes from outside (mode switch,
    // conflict restore). Reuses the source editor's published-change guard.
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

    // Reconfigure the live compartment when editability or attachment
    // previews change (reconfiguring re-reads the options getter through
    // the facet, so late-arriving image previews repaint).
    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({
        effects: liveCompartmentRef.current.reconfigure([
          readOnlyFacet.of(!editable),
          kuskusLiveExtensions(() => liveOptionsRef.current)
        ])
      })
    }, [editable, liveOptions])

    // Rebuild the React title/properties block when its content changes.
    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({
        effects: blocksCompartmentRef.current.reconfigure(
          markdownEditorBlocks(() => blocksOptionsRef.current)
        )
      })
    }, [topContent])

    useEffect(() => {
      const view = viewRef.current
      if (!view || !active) return
      view.requestMeasure()
      view.focus()
    }, [active])

    return <div ref={hostRef} className={cn('size-full min-h-0', className)} />
  }
)
