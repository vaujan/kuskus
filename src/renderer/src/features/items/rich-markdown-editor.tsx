import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  parserCtx,
  rootAttrsCtx,
  rootCtx,
  serializerCtx
} from '@milkdown/core'
import { history } from '@milkdown/plugin-history'
import type { Node as ProseNode } from '@milkdown/prose/model'
import { Selection } from '@milkdown/prose/state'
import type {
  EditorView as ProseEditorView,
  NodeView,
  NodeViewConstructor
} from '@milkdown/prose/view'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { replaceAll } from '@milkdown/utils'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { cn } from '@/lib/utils'
import { richMarkdownActiveLine } from '@/features/items/rich-markdown-active-line'
import { richMarkdownCode } from '@/features/items/rich-markdown-code'
import { richMarkdownMath } from '@/features/items/rich-markdown-math'
import { richMarkdownPublisher } from '@/features/items/rich-markdown-publisher'
import { richMarkdownVim } from '@/features/items/rich-markdown-vim'
import type { NoteVimMode } from '@/features/items/note-vim-mode'
import { RichMarkdownSlashMenu } from '@/features/items/rich-markdown-slash-menu'
import {
  richMarkdownSlashMenu,
  runRichMarkdownSlashCommand,
  type RichMarkdownSlashState
} from '@/features/items/rich-markdown-slash-menu-plugin'
import {
  richMarkdownTableToolbar,
  runRichMarkdownTableAction,
  type RichMarkdownTableAction,
  type RichMarkdownTableToolbarState
} from '@/features/items/rich-markdown-table-toolbar-plugin'
import { RichMarkdownTableToolbar } from '@/features/items/rich-markdown-table-toolbar'
import { partitionRichMarkdownSource } from '@/features/items/rich-markdown-source'
import {
  prepareRichMarkdown,
  restoreRichMarkdown,
  supportsRichMarkdown
} from '@/features/items/rich-markdown-syntax'
import {
  clampCursorOffset,
  createCursorMarker,
  findCursorMarkerOffset
} from '@/features/items/note-cursor'

export interface RichMarkdownImage {
  src: string | null
  missing: boolean
  label: string
  width: number
  height: number
}

export interface RichMarkdownEditorOptions {
  resolveImage?: (target: string) => RichMarkdownImage | null
  onOpenLink?: (url: string) => void
  onOpenVaultLink?: (target: string) => void
  onPasteImage?: (file: File, insertAtSelection: (src: string) => void) => void
  tasksEditable?: boolean
}

export interface RichMarkdownEditorHandle {
  focus: () => void
  getCursorOffset: () => number | null
  setCursorOffset: (offset: number | null) => void
}

function richMarkdownScrollRestorePoint(view: ProseEditorView): number | null {
  const viewport = view.dom.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
  if (!viewport || viewport.scrollTop <= 0) return null
  const rect = viewport.getBoundingClientRect()
  const contentLeft = rect.left + Math.min(rect.width / 2, viewport.clientWidth / 2)
  const candidates: Array<[number, number]> = []
  for (const verticalFraction of [0.5, 0.25, 0.75, 0.15, 0.85]) {
    candidates.push([contentLeft, rect.top + rect.height * verticalFraction])
  }
  for (const horizontalFraction of [0.3, 0.5, 0.7]) {
    candidates.push([rect.left + rect.width * horizontalFraction, rect.top + rect.height / 2])
  }
  for (const [left, top] of candidates) {
    const at = view.posAtCoords({ left, top })
    if (at) return at.pos
  }
  return null
}

function focusRichMarkdownEditor(
  editor: Editor | null,
  restoreScrollPosition = false,
  preserveScrollTop: number | null = null,
  cursorOffset: number | null = null,
  sourceValue: string | null = null
): void {
  editor?.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    if (cursorOffset != null && sourceValue != null) {
      const target = richMarkdownCursorRestorePoint(ctx.get(parserCtx), cursorOffset, sourceValue)
      if (target != null) {
        const max = view.state.doc.content.size
        const resolved = Math.min(target, max)
        const selection = Selection.near(view.state.doc.resolve(resolved), 1)
        view.dispatch(view.state.tr.setSelection(selection).scrollIntoView())
        view.focus()
        return
      }
    }
    const viewport = view.dom.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
    if (viewport && preserveScrollTop != null) {
      const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
      viewport.scrollTop = Math.min(preserveScrollTop, maxScrollTop)
    }
    const restorePoint = restoreScrollPosition ? richMarkdownScrollRestorePoint(view) : null
    const target = restorePoint ?? view.state.selection.head
    view.dispatch(view.state.tr.setSelection(Selection.near(view.state.doc.resolve(target), 1)))
    view.focus()
  })
}

function richMarkdownCursorOffset(editor: Editor, sourceValue: string): number | null {
  let offset: number | null = null
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const source = partitionRichMarkdownSource(sourceValue)
    if (!source) return
    const marker = createCursorMarker()
    const head = view.state.selection.head
    let markerDoc: ProseNode
    try {
      markerDoc = view.state.tr.insertText(marker, head, head).doc
    } catch {
      return
    }
    const serialized = ctx.get(serializerCtx)(markerDoc)
    const published = source.prefix + restoreRichMarkdown(serialized)
    const index = findCursorMarkerOffset(published, marker)
    if (index != null) offset = index
  })
  return offset
}

function richMarkdownCursorRestorePoint(
  parser: (value: string) => ProseNode,
  offset: number,
  sourceValue: string
): number | null {
  const source = partitionRichMarkdownSource(sourceValue)
  if (!source) return null
  const bodyOffset = clampCursorOffset(source.body, offset - source.prefix.length)
  const marker = createCursorMarker()
  const bodyWithMarker = source.body.slice(0, bodyOffset) + marker + source.body.slice(bodyOffset)
  const doc = parser(prepareRichMarkdown(bodyWithMarker))
  let pos: number | null = null
  doc.descendants((node, nodePos) => {
    if (!node.isText) return true
    const text = node.text ?? ''
    const index = text.indexOf(marker)
    if (index < 0) return true
    pos = nodePos + index
    return false
  })
  return pos
}

interface RichMarkdownEditorProps {
  value: string
  editable: boolean
  active: boolean
  options?: RichMarkdownEditorOptions
  presentation?: 'card' | 'detail'
  preserveScrollTopRef?: React.RefObject<number> | null
  preserveCursorOffsetRef?: React.RefObject<number | null> | null
  className?: string
  vimEnabled?: boolean
  onVimModeChange?: (mode: NoteVimMode | null) => void
  onVimWrite?: () => void
  onVimQuit?: () => void
  onChange: (value: string) => void
  onError?: (message: string) => void
}

function decodeVaultTarget(value: string): string | null {
  const separator = value.indexOf(':')
  if (separator < 0) return null
  try {
    return decodeURIComponent(value.slice(separator + 1))
  } catch {
    return null
  }
}

function imageNodeView(
  node: ProseNode,
  getOptions: () => RichMarkdownEditorOptions,
  registerRefresh: (refresh: () => void) => () => void
): NodeView {
  let currentNode = node
  const dom = document.createElement('span')
  dom.className = 'kuskus-rich-image-wrap'

  const render = (): void => {
    const current = currentNode
    const target = String(current.attrs.src ?? '')
    const alt = String(current.attrs.alt ?? '')
    const vaultTarget = target.startsWith('kuskus-embed:') ? decodeVaultTarget(target) : null
    const resolution = getOptions().resolveImage?.(vaultTarget ?? target) ?? null
    dom.replaceChildren()

    const remote = /^https?:\/\//i.test(target)
    if (resolution?.src || remote) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'kuskus-markdown-image-button'
      button.contentEditable = 'false'
      button.dataset.zoomed = 'false'
      button.setAttribute('aria-label', `Zoom image${alt ? `: ${alt}` : ''}`)
      button.setAttribute('aria-pressed', 'false')
      button.addEventListener('click', () => {
        const zoomed = button.dataset.zoomed !== 'true'
        button.dataset.zoomed = String(zoomed)
        button.setAttribute(
          'aria-label',
          `${zoomed ? 'Close' : 'Zoom'} image${alt ? `: ${alt}` : ''}`
        )
        button.setAttribute('aria-pressed', String(zoomed))
      })
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || button.dataset.zoomed !== 'true') return
        event.preventDefault()
        button.dataset.zoomed = 'false'
        button.setAttribute('aria-label', `Zoom image${alt ? `: ${alt}` : ''}`)
        button.setAttribute('aria-pressed', 'false')
      })

      const image = document.createElement('img')
      image.className = 'kuskus-markdown-image'
      image.src = resolution?.src ?? target
      image.alt = ''
      image.loading = 'lazy'
      image.referrerPolicy = 'no-referrer'
      if (resolution) {
        image.width = resolution.width
        image.height = resolution.height
      }
      button.append(image)
      if (alt) {
        const caption = document.createElement('span')
        caption.className = 'kuskus-markdown-image-caption'
        caption.textContent = alt
        button.append(caption)
      }
      dom.append(button)
      return
    }

    const chip = document.createElement('span')
    chip.className = 'kuskus-rich-image-state'
    chip.textContent = resolution?.missing
      ? `Image missing: ${alt || resolution.label}`
      : resolution
        ? 'Loading image…'
        : vaultTarget
          ? `Embedded note: ${alt || vaultTarget}`
          : /^https?:\/\//i.test(target)
            ? alt || 'Remote image'
            : alt || target || 'Invalid image'
    dom.append(chip)
  }

  const unregisterRefresh = registerRefresh(render)
  render()
  return {
    dom,
    update: (next) => {
      if (next.type !== node.type) return false
      currentNode = next
      render()
      return true
    },
    stopEvent: (event) =>
      event.target instanceof Element &&
      Boolean(event.target.closest('.kuskus-markdown-image-button')),
    destroy: unregisterRefresh
  }
}

function listItemNodeView(
  node: ProseNode,
  view: ProseEditorView,
  getPos: () => number | undefined,
  getOptions: () => RichMarkdownEditorOptions
): NodeView {
  let currentNode = node
  const dom = document.createElement('li')
  if (node.attrs.checked == null) return { dom, contentDOM: dom }

  dom.dataset.itemType = 'task'
  dom.dataset.checked = String(node.attrs.checked)
  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.className = 'kuskus-task-checkbox'
  checkbox.contentEditable = 'false'
  const content = document.createElement('div')
  content.className = 'kuskus-rich-task-content'
  dom.append(checkbox, content)

  const renderCheckbox = (): void => {
    checkbox.checked = Boolean(currentNode.attrs.checked)
    checkbox.disabled = !view.editable && !getOptions().tasksEditable
    checkbox.setAttribute('aria-label', checkbox.checked ? 'Completed task' : 'Open task')
  }
  checkbox.addEventListener('change', () => {
    const position = getPos()
    if (position === undefined || checkbox.disabled) return renderCheckbox()
    view.dispatch(
      view.state.tr.setNodeMarkup(position, undefined, {
        ...currentNode.attrs,
        checked: checkbox.checked
      })
    )
  })
  renderCheckbox()

  return {
    dom,
    contentDOM: content,
    update: (next) => {
      if (next.type !== node.type || next.attrs.checked == null) return false
      currentNode = next
      dom.dataset.checked = String(next.attrs.checked)
      renderCheckbox()
      return true
    },
    stopEvent: (event) => event.target === checkbox
  }
}

export const RichMarkdownEditor = forwardRef<RichMarkdownEditorHandle, RichMarkdownEditorProps>(
  function RichMarkdownEditor(
    {
      value,
      editable,
      active,
      options,
      presentation = 'detail',
      preserveScrollTopRef = null,
      preserveCursorOffsetRef = null,
      className,
      vimEnabled = false,
      onVimModeChange,
      onVimWrite,
      onVimQuit,
      onChange,
      onError
    },
    forwardedRef
  ): React.JSX.Element {
    const hostRef = useRef<HTMLDivElement>(null)
    const editorRef = useRef<Editor | null>(null)
    const valueRef = useRef(value)
    const activeRef = useRef(active)
    const editableRef = useRef(editable)
    const optionsRef = useRef(options ?? {})
    const imageRefreshersRef = useRef(new Set<() => void>())
    const onChangeRef = useRef(onChange)
    const onErrorRef = useRef(onError)
    const onVimModeChangeRef = useRef(onVimModeChange)
    const onVimWriteRef = useRef(onVimWrite)
    const onVimQuitRef = useRef(onVimQuit)
    const publishedRef = useRef<string | null>(value)
    const [failed, setFailed] = useState(false)
    const [slashState, setSlashState] = useState<RichMarkdownSlashState | null>(null)
    const [tableToolbarState, setTableToolbarState] =
      useState<RichMarkdownTableToolbarState | null>(null)

    useLayoutEffect(() => {
      valueRef.current = value
      activeRef.current = active
      editableRef.current = editable
      onChangeRef.current = onChange
      onErrorRef.current = onError
      onVimModeChangeRef.current = onVimModeChange
      onVimWriteRef.current = onVimWrite
      onVimQuitRef.current = onVimQuit
    }, [active, editable, onChange, onError, onVimModeChange, onVimWrite, onVimQuit, value])

    useLayoutEffect(() => {
      optionsRef.current = options ?? {}
      imageRefreshersRef.current.forEach((refresh) => refresh())
    }, [options])

    useImperativeHandle(
      forwardedRef,
      () => ({
        focus: () => focusRichMarkdownEditor(editorRef.current),
        getCursorOffset: () =>
          editorRef.current ? richMarkdownCursorOffset(editorRef.current, valueRef.current) : null,
        setCursorOffset: (offset) =>
          focusRichMarkdownEditor(editorRef.current, false, null, offset, valueRef.current)
      }),
      []
    )

    useLayoutEffect(() => {
      const host = hostRef.current
      const source = partitionRichMarkdownSource(valueRef.current)
      if (!host || !source || !supportsRichMarkdown(source.body)) return
      let disposed = false
      setFailed(false)

      const imageView: NodeViewConstructor = (node) =>
        imageNodeView(
          node,
          () => optionsRef.current,
          (refresh) => {
            imageRefreshersRef.current.add(refresh)
            return () => imageRefreshersRef.current.delete(refresh)
          }
        )
      const taskView: NodeViewConstructor = (node, view, getPos) =>
        listItemNodeView(
          node,
          view,
          typeof getPos === 'function' ? getPos : () => undefined,
          () => optionsRef.current
        )

      const publisher = richMarkdownPublisher((markdown) => {
        const current = partitionRichMarkdownSource(valueRef.current)
        if (!current) return
        const next = current.prefix + restoreRichMarkdown(markdown)
        publishedRef.current = next
        valueRef.current = next
        onChangeRef.current(next)
      })
      const slashMenu = richMarkdownSlashMenu(
        setSlashState,
        (state, id) =>
          editorRef.current?.action((ctx) =>
            runRichMarkdownSlashCommand(ctx, ctx.get(editorViewCtx), state, id)
          ),
        () => editableRef.current
      )
      const tableToolbar = richMarkdownTableToolbar(setTableToolbarState, () => editableRef.current)
      const editor = Editor.make()
        .use(commonmark)
        .use(gfm)
        .use(richMarkdownCode)
        .use(slashMenu)
        .use(tableToolbar)
        .use(richMarkdownMath)
        .use(publisher)
        .use(history)
      if (vimEnabled)
        editor.use(
          richMarkdownVim((mode) => onVimModeChangeRef.current?.(mode), {
            write: () => onVimWriteRef.current?.(),
            quit: () => onVimQuitRef.current?.()
          })
        )
      if (presentation === 'detail') editor.use(richMarkdownActiveLine)
      editor.config((ctx) => {
        ctx.set(rootCtx, host)
        ctx.set(defaultValueCtx, prepareRichMarkdown(source.body))
        ctx.set(rootAttrsCtx, {
          class: 'typeset kuskus-typeset kuskus-rich-document',
          'data-typeset-presentation': presentation
        })
        ctx.set(editorViewOptionsCtx, {
          editable: () => editableRef.current,
          nodeViews: { image: imageView, list_item: taskView },
          // Start scrolling before the cursor touches the pane edge and keep
          // it roughly four lines above the bottom while typing.
          scrollThreshold: { top: 0, right: 0, bottom: 24, left: 0 },
          scrollMargin: { top: 5, right: 5, bottom: 112, left: 5 },
          attributes: {
            'aria-label': editableRef.current ? 'Rich Markdown editor' : 'Markdown document',
            spellcheck: 'true'
          },
          handlePaste: (view, event) => {
            const file = Array.from(event.clipboardData?.items ?? [])
              .find((entry) => entry.type.startsWith('image/'))
              ?.getAsFile()
            const onPasteImage = optionsRef.current.onPasteImage
            if (!file || !onPasteImage) return false
            event.preventDefault()
            const { from, to } = view.state.selection
            const pastedInto = view.state.doc
            onPasteImage(file, (src) => {
              const image = view.state.schema.nodes.image?.create({ src, alt: '', title: '' })
              if (!image || view.isDestroyed) return
              try {
                const transaction = view.state.tr
                if (view.state.doc === pastedInto) transaction.replaceRangeWith(from, to, image)
                else transaction.replaceSelectionWith(image)
                view.dispatch(transaction.scrollIntoView())
              } catch {
                onErrorRef.current?.('The image could not be inserted at the current position.')
              }
            })
            return true
          }
        })
      })

      const handleClick = (event: MouseEvent): void => {
        const anchor = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href]')
        if (!anchor) return
        const href = anchor.getAttribute('href') ?? ''
        if (href.startsWith('kuskus-wiki:')) {
          const target = decodeVaultTarget(href)
          if (target) optionsRef.current.onOpenVaultLink?.(target)
        } else if (/^https?:\/\//i.test(href)) {
          optionsRef.current.onOpenLink?.(href)
        } else {
          return
        }
        event.preventDefault()
      }
      host.addEventListener('click', handleClick)

      void editor
        .create()
        .then(() => {
          if (disposed) {
            void editor.destroy()
            return
          }
          editorRef.current = editor
          const current = partitionRichMarkdownSource(valueRef.current)
          if (current && current.prefix + current.body !== source.prefix + source.body) {
            editor.action(replaceAll(prepareRichMarkdown(current.body), true))
            publishedRef.current = current.prefix + current.body
          }
          if (activeRef.current && editableRef.current) {
            const cursorOffset = preserveCursorOffsetRef?.current ?? null
            if (cursorOffset != null) {
              focusRichMarkdownEditor(editor, false, null, cursorOffset, valueRef.current)
            } else {
              focusRichMarkdownEditor(editor, true, preserveScrollTopRef?.current ?? null)
            }
          }
        })
        .catch((error: unknown) => {
          setFailed(true)
          onErrorRef.current?.(
            error instanceof Error ? error.message : 'The rich Markdown editor could not be opened.'
          )
        })

      return () => {
        disposed = true
        host.removeEventListener('click', handleClick)
        if (editorRef.current === editor) editorRef.current = null
        void editor.destroy()
      }
    }, [presentation, preserveScrollTopRef, preserveCursorOffsetRef, vimEnabled])

    useEffect(() => {
      const editor = editorRef.current
      if (!editor) return
      if (publishedRef.current === value) return
      const source = partitionRichMarkdownSource(value)
      if (!source || !supportsRichMarkdown(source.body)) return
      editor.action(replaceAll(prepareRichMarkdown(source.body), true))
      publishedRef.current = value
    }, [value])

    useEffect(() => {
      const editor = editorRef.current
      if (!editor) return
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        view.setProps({
          editable: () => editable,
          attributes: {
            ...view.props.attributes,
            'aria-label': editable ? 'Rich Markdown editor' : 'Markdown document'
          }
        })
        view.dom.querySelectorAll<HTMLInputElement>('.kuskus-task-checkbox').forEach((checkbox) => {
          checkbox.disabled = !editable && !optionsRef.current.tasksEditable
        })
      })
      if (active && editable) focusRichMarkdownEditor(editor)
    }, [active, editable])

    return (
      <div className={cn('kuskus-rich-editor min-w-0', className)}>
        <div ref={hostRef} className={failed ? 'hidden' : undefined} />
        {slashState && editable ? (
          <RichMarkdownSlashMenu
            state={slashState}
            onSelect={(id) =>
              editorRef.current?.action((ctx) =>
                runRichMarkdownSlashCommand(ctx, ctx.get(editorViewCtx), slashState, id)
              )
            }
          />
        ) : null}
        {tableToolbarState && editable ? (
          <RichMarkdownTableToolbar
            state={tableToolbarState}
            onAction={(action: RichMarkdownTableAction) =>
              editorRef.current?.action((ctx) =>
                runRichMarkdownTableAction(ctx.get(editorViewCtx), ctx, action)
              )
            }
          />
        ) : null}
        {failed ? (
          <pre className="whitespace-pre-wrap font-mono text-sm" role="alert">
            {value}
          </pre>
        ) : null}
      </div>
    )
  }
)
