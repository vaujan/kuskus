import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  rootAttrsCtx,
  rootCtx
} from '@milkdown/core'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import type { Node as ProseNode } from '@milkdown/prose/model'
import type {
  EditorView as ProseEditorView,
  NodeView,
  NodeViewConstructor
} from '@milkdown/prose/view'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { replaceAll } from '@milkdown/utils'
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'

import { cn } from '@/lib/utils'
import { richMarkdownMath } from '@/features/items/rich-markdown-math'
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
}

export interface RichMarkdownEditorOptions {
  resolveImage?: (target: string) => RichMarkdownImage | null
  onOpenLink?: (url: string) => void
  onOpenVaultLink?: (target: string) => void
  onPasteImage?: (file: File) => void
}

export interface RichMarkdownEditorHandle {
  focus: () => void
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

function imageNodeView(node: ProseNode, getOptions: () => RichMarkdownEditorOptions): NodeView {
  const dom = document.createElement('span')
  dom.className = 'kuskus-rich-image-wrap'

  const render = (current: ProseNode): void => {
    const target = String(current.attrs.src ?? '')
    const alt = String(current.attrs.alt ?? '')
    const vaultTarget = target.startsWith('kuskus-embed:') ? decodeVaultTarget(target) : null
    const resolution = getOptions().resolveImage?.(vaultTarget ?? target) ?? null
    dom.replaceChildren()

    if (resolution?.src) {
      const image = document.createElement('img')
      image.className = 'kuskus-markdown-image'
      image.src = resolution.src
      image.alt = alt || resolution.label
      dom.append(image)
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

  render(node)
  return {
    dom,
    update: (next) => {
      if (next.type !== node.type) return false
      render(next)
      return true
    }
  }
}

function listItemNodeView(
  node: ProseNode,
  view: ProseEditorView,
  getPos: () => number | undefined
): NodeView {
  let currentNode = node
  const dom = document.createElement('li')
  if (node.attrs.checked == null) return { dom, contentDOM: dom }

  dom.dataset.itemType = 'task'
  dom.dataset.checked = String(node.attrs.checked)
  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = Boolean(node.attrs.checked)
  checkbox.className = 'kuskus-task-checkbox'
  checkbox.contentEditable = 'false'
  checkbox.setAttribute('aria-label', checkbox.checked ? 'Completed task' : 'Open task')
  const content = document.createElement('div')
  content.className = 'kuskus-rich-task-content'
  dom.append(checkbox, content)

  return {
    dom,
    contentDOM: content,
    update: (next) => {
      if (next.type !== node.type || next.attrs.checked == null) return false
      currentNode = next
      checkbox.checked = Boolean(next.attrs.checked)
      dom.dataset.checked = String(next.attrs.checked)
      return true
    },
    stopEvent: (event) => {
      if (event.target !== checkbox) return false
      if (event.type === 'change') {
        if (!view.editable) {
          checkbox.checked = Boolean(currentNode.attrs.checked)
          return true
        }
        const position = getPos()
        if (position !== undefined) {
          view.dispatch(
            view.state.tr.setNodeMarkup(position, undefined, {
              ...currentNode.attrs,
              checked: checkbox.checked
            })
          )
        }
      }
      return true
    }
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
    const editableRef = useRef(editable)
    const optionsRef = useRef(options ?? {})
    const onChangeRef = useRef(onChange)
    const onErrorRef = useRef(onError)
    const publishedRef = useRef<string | null>(null)

    valueRef.current = value
    editableRef.current = editable
    optionsRef.current = options ?? {}
    onChangeRef.current = onChange
    onErrorRef.current = onError

    useImperativeHandle(
      forwardedRef,
      () => ({ focus: () => editorRef.current?.action((ctx) => ctx.get(editorViewCtx).focus()) }),
      []
    )

    useLayoutEffect(() => {
      const host = hostRef.current
      const source = partitionRichMarkdownSource(valueRef.current)
      if (!host || !source || !supportsRichMarkdown(source.body)) return
      let disposed = false

      const imageView: NodeViewConstructor = (node) => imageNodeView(node, () => optionsRef.current)
      const taskView: NodeViewConstructor = (node, view, getPos) =>
        listItemNodeView(node, view, typeof getPos === 'function' ? getPos : () => undefined)

      const editor = Editor.make()
        .use(commonmark)
        .use(gfm)
        .use(richMarkdownMath)
        .use(history)
        .use(listener)
        .config((ctx) => {
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
            }
          })
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
            const current = partitionRichMarkdownSource(valueRef.current)
            if (!current) return
            const next = current.prefix + restoreRichMarkdown(markdown)
            publishedRef.current = next
            onChangeRef.current(next)
          })
        })

      const handlePaste = (event: ClipboardEvent): void => {
        const file = Array.from(event.clipboardData?.items ?? [])
          .find((entry) => entry.type.startsWith('image/'))
          ?.getAsFile()
        if (!file || !optionsRef.current.onPasteImage) return
        event.preventDefault()
        optionsRef.current.onPasteImage(file)
      }
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
      host.addEventListener('paste', handlePaste)

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
        })
        .catch((error: unknown) => {
          onErrorRef.current?.(
            error instanceof Error ? error.message : 'The rich Markdown editor could not be opened.'
          )
        })

      return () => {
        disposed = true
        host.removeEventListener('click', handleClick)
        host.removeEventListener('paste', handlePaste)
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
      })
      if (active && editable) editor.action((ctx) => ctx.get(editorViewCtx).focus())
    }, [active, editable])

    return <div ref={hostRef} className={cn('kuskus-rich-editor min-w-0', className)} />
  }
)
