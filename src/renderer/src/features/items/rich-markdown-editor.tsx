import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  rootAttrsCtx,
  rootCtx
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
import { RichMarkdownSlashMenu } from '@/features/items/rich-markdown-slash-menu'
import {
  richMarkdownSlashMenu,
  runRichMarkdownSlashCommand,
  type RichMarkdownSlashState
} from '@/features/items/rich-markdown-slash-menu-plugin'
import { partitionRichMarkdownSource } from '@/features/items/rich-markdown-source'
import {
  prepareRichMarkdown,
  restoreRichMarkdown,
  supportsRichMarkdown
} from '@/features/items/rich-markdown-syntax'

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
}

function focusRichMarkdownEditor(editor: Editor | null): void {
  editor?.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    view.dispatch(
      view.state.tr.setSelection(Selection.near(view.state.doc.resolve(view.state.selection.head)))
    )
    view.focus()
  })
}

interface RichMarkdownEditorProps {
  value: string
  editable: boolean
  active: boolean
  options?: RichMarkdownEditorOptions
  presentation?: 'card' | 'detail'
  className?: string
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
      const image = document.createElement('img')
      image.className = 'kuskus-markdown-image'
      image.src = resolution?.src ?? target
      image.alt = alt || resolution?.label || ''
      image.loading = 'lazy'
      image.referrerPolicy = 'no-referrer'
      if (resolution) {
        image.width = resolution.width
        image.height = resolution.height
        dom.append(image)
      } else {
        const link = document.createElement('a')
        link.href = target
        link.setAttribute('aria-label', `Open image${alt ? `: ${alt}` : ''}`)
        link.append(image)
        dom.append(link)
      }
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
    { value, editable, active, options, presentation = 'detail', className, onChange, onError },
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
    const publishedRef = useRef<string | null>(null)
    const [failed, setFailed] = useState(false)
    const [slashState, setSlashState] = useState<RichMarkdownSlashState | null>(null)

    useLayoutEffect(() => {
      valueRef.current = value
      activeRef.current = active
      editableRef.current = editable
      onChangeRef.current = onChange
      onErrorRef.current = onError
    }, [active, editable, onChange, onError, value])

    useLayoutEffect(() => {
      optionsRef.current = options ?? {}
      imageRefreshersRef.current.forEach((refresh) => refresh())
    }, [options])

    useImperativeHandle(
      forwardedRef,
      () => ({ focus: () => focusRichMarkdownEditor(editorRef.current) }),
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
            runRichMarkdownSlashCommand(ctx.get(editorViewCtx), state, id)
          ),
        () => editableRef.current
      )
      const editor = Editor.make()
        .use(commonmark)
        .use(gfm)
        .use(richMarkdownCode)
        .use(slashMenu)
        .use(richMarkdownMath)
        .use(publisher)
        .use(history)
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
          }
          if (activeRef.current && editableRef.current) focusRichMarkdownEditor(editor)
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
    }, [presentation])

    useEffect(() => {
      const editor = editorRef.current
      if (!editor || publishedRef.current === value) {
        publishedRef.current = null
        return
      }
      const source = partitionRichMarkdownSource(value)
      if (!source || !supportsRichMarkdown(source.body)) return
      editor.action(replaceAll(prepareRichMarkdown(source.body), true))
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
                runRichMarkdownSlashCommand(ctx.get(editorViewCtx), slashState, id)
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
