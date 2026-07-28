import {
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
  type RefObject
} from 'react'
import remarkBreaks from 'remark-breaks'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { configureKuskusEditorOverlays } from '@/features/items/editor-overlays'
import { normalizeRichEditorMarkdown } from '@/features/items/markdown-preflight'
import { MarkdownPreview } from '@/features/items/markdown-preview'
import type { NoteAttachmentDto } from '../../../../shared/library-contract'

type CrepeInstance = import('@milkdown/crepe').Crepe
type EditorView = import('@milkdown/kit/prose/view').EditorView
type ProseMirrorNode = import('@milkdown/kit/prose/model').Node
type BlockService = import('@milkdown/kit/plugin/block').BlockService

export interface WysiwygMarkdownEditorHandle {
  replaceMarkdown: (markdown: string) => Promise<void>
  focus: () => void
}

interface WysiwygMarkdownEditorProps {
  ref?: Ref<WysiwygMarkdownEditorHandle>
  itemId: string
  initialMarkdown: string
  attachments: NoteAttachmentDto[]
  readOnly: boolean
  scrollViewportRef: RefObject<HTMLDivElement | null>
  onMarkdownChange: (markdown: string) => void
  onOpenLink: (url: string) => void
}

const HTTP_URL_PATTERN = /^https?:\/\//i
const EDITOR_CONTROL_SELECTOR = [
  '.milkdown-toolbar',
  '.milkdown-slash-menu',
  '.milkdown-block-handle',
  '.milkdown-link-preview',
  '.milkdown-link-edit',
  '.milkdown-code-block',
  '.milkdown-image-block',
  '.milkdown-image-inline',
  '.milkdown-table-block',
  '.milkdown-latex-inline-edit',
  '.milkdown-latex-block-edit'
].join(',')

interface ActiveTopLevelBlock {
  dom: HTMLElement
  index: number
  node: ProseMirrorNode
  pos: number
}

interface BlockControlRuntime {
  view: EditorView
  service: BlockService
  createFragment: (nodes: ProseMirrorNode[]) => ProseMirrorNode['content']
  createTextSelection: (doc: ProseMirrorNode, pos: number) => EditorView['state']['selection']
}

function placeholderImage(message: string): string {
  const escaped = message.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;'
    }
    return entities[character]
  })
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="180" viewBox="0 0 720 180"><rect width="720" height="180" rx="16" fill="#888" fill-opacity=".10"/><text x="360" y="92" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#888">${escaped}</text></svg>`
  )}`
}

function markEditorControls(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(EDITOR_CONTROL_SELECTOR).forEach((element) => {
    element.classList.add('not-typeset')
    element.dataset.notTypeset = ''
  })
}

function focusEditorWithoutScrolling(
  root: HTMLElement | null,
  scrollViewport: HTMLDivElement | null
): void {
  const editor = root?.querySelector<HTMLElement>('.ProseMirror')
  if (!editor) return

  const scrollLeft = scrollViewport?.scrollLeft
  const scrollTop = scrollViewport?.scrollTop
  editor.focus({ preventScroll: true })

  // Keep the viewport stable even if the embedded Chromium version ignores
  // preventScroll for a contenteditable element.
  if (scrollViewport && scrollLeft !== undefined && scrollTop !== undefined) {
    scrollViewport.scrollLeft = scrollLeft
    scrollViewport.scrollTop = scrollTop
  }
}

function getActiveTopLevelBlock(view: EditorView): ActiveTopLevelBlock | null {
  const { doc, selection } = view.state
  if (doc.childCount === 0 || selection.$from.depth === 0) return null

  const index = selection.$from.index(0)
  if (index < 0 || index >= doc.childCount) return null

  let pos = 0
  for (let childIndex = 0; childIndex < index; childIndex += 1) {
    pos += doc.child(childIndex).nodeSize
  }

  const node = doc.child(index)
  const dom = view.nodeDOM(pos)
  if (!(dom instanceof HTMLElement)) return null
  return { dom, index, node, pos }
}

function moveActiveBlock(runtime: BlockControlRuntime, direction: -1 | 1): boolean {
  const { view } = runtime
  const active = getActiveTopLevelBlock(view)
  if (!active) return false

  const siblingIndex = active.index + direction
  if (siblingIndex < 0 || siblingIndex >= view.state.doc.childCount) return false

  const sibling = view.state.doc.child(siblingIndex)
  const rangeStart = direction < 0 ? active.pos - sibling.nodeSize : active.pos
  const rangeEnd =
    direction < 0
      ? active.pos + active.node.nodeSize
      : active.pos + active.node.nodeSize + sibling.nodeSize
  const replacement =
    direction < 0
      ? runtime.createFragment([active.node, sibling])
      : runtime.createFragment([sibling, active.node])
  const nextPos = direction < 0 ? rangeStart : active.pos + sibling.nodeSize
  const transaction = view.state.tr.replaceWith(rangeStart, rangeEnd, replacement)
  transaction.setSelection(runtime.createTextSelection(transaction.doc, nextPos + 1))
  view.dispatch(transaction.scrollIntoView())
  view.focus()
  return true
}

function installAccessibleBlockControls(
  root: HTMLElement,
  runtime: BlockControlRuntime
): () => void {
  let frame = 0

  const prepareControls = (): void => {
    const handle = root.querySelector<HTMLElement>('.milkdown-block-handle')
    if (!handle) return

    handle.dataset.notTypeset = ''
    handle.classList.add('not-typeset')
    const [addControl, dragControl] = [
      ...handle.querySelectorAll<HTMLElement>('.operation-item')
    ]

    if (addControl && addControl.dataset.kuskusControl !== 'add-block') {
      addControl.dataset.kuskusControl = 'add-block'
      addControl.setAttribute('role', 'button')
      addControl.setAttribute('aria-label', 'Add block below')
      addControl.setAttribute('title', 'Add block below')
      addControl.tabIndex = 0
      addControl.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        event.stopPropagation()
        addControl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        addControl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
      })
    }

    if (dragControl) {
      const active = getActiveTopLevelBlock(runtime.view)
      const canMove = Boolean(
        active && (active.index > 0 || active.index < runtime.view.state.doc.childCount - 1)
      )
      dragControl.setAttribute('aria-disabled', String(!canMove))

      if (dragControl.dataset.kuskusControl !== 'move-block') {
        dragControl.dataset.kuskusControl = 'move-block'
        dragControl.setAttribute('role', 'button')
        dragControl.setAttribute('aria-label', 'Move block')
        dragControl.setAttribute('aria-keyshortcuts', 'Alt+ArrowUp Alt+ArrowDown')
        dragControl.setAttribute(
          'title',
          'Drag to reorder. Press Alt+Up or Alt+Down to move this block.'
        )
        dragControl.tabIndex = 0
        dragControl.addEventListener('keydown', (event) => {
          if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
          event.preventDefault()
          event.stopPropagation()
          moveActiveBlock(runtime, event.key === 'ArrowUp' ? -1 : 1)
          scheduleSync()
        })
      }
    }
  }

  const sync = (): void => {
    frame = 0
    prepareControls()
    if (!runtime.view.editable) {
      runtime.service.keydownCallback(runtime.view)
      return
    }
    if (!runtime.view.hasFocus() && !root.contains(document.activeElement)) return

    const active = getActiveTopLevelBlock(runtime.view)
    if (!active) return
    const rect = active.dom.getBoundingClientRect()
    runtime.service.mousemoveCallback(
      runtime.view,
      new MouseEvent('pointermove', {
        bubbles: true,
        clientY: rect.top + rect.height / 2
      })
    )
    requestAnimationFrame(prepareControls)
  }

  const scheduleSync = (): void => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(sync)
  }
  const handleFocusOut = (): void => {
    requestAnimationFrame(() => {
      if (runtime.view.hasFocus() || root.contains(document.activeElement)) return
      runtime.service.keydownCallback(runtime.view)
    })
  }

  root.addEventListener('focusin', scheduleSync)
  root.addEventListener('focusout', handleFocusOut)
  root.addEventListener('keydown', scheduleSync)
  root.addEventListener('keyup', scheduleSync)
  root.addEventListener('pointerup', scheduleSync)
  document.addEventListener('selectionchange', scheduleSync)
  scheduleSync()

  return () => {
    cancelAnimationFrame(frame)
    root.removeEventListener('focusin', scheduleSync)
    root.removeEventListener('focusout', handleFocusOut)
    root.removeEventListener('keydown', scheduleSync)
    root.removeEventListener('keyup', scheduleSync)
    root.removeEventListener('pointerup', scheduleSync)
    document.removeEventListener('selectionchange', scheduleSync)
  }
}

const WysiwygMarkdownEditor = memo(function WysiwygMarkdownEditor({
  ref,
  itemId,
  initialMarkdown,
  attachments,
  readOnly,
  scrollViewportRef,
  onMarkdownChange,
  onOpenLink
}: WysiwygMarkdownEditorProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<CrepeInstance | null>(null)
  const readOnlyRef = useRef(readOnly)
  const onMarkdownChangeRef = useRef(onMarkdownChange)
  const suppressChangesRef = useRef(false)
  const readyForUserChangesRef = useRef(false)
  const initialMarkdownRef = useRef(normalizeRichEditorMarkdown(initialMarkdown))
  const attachmentsRef = useRef(attachments)
  const objectUrlsRef = useRef(new Set<string>())
  const imageUrlCacheRef = useRef(new Map<string, string>())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  readOnlyRef.current = readOnly
  onMarkdownChangeRef.current = onMarkdownChange

  useImperativeHandle(
    ref,
    () => ({
      replaceMarkdown: (markdown) => {
        const crepe = crepeRef.current
        if (!crepe) return Promise.resolve()
        suppressChangesRef.current = true
        return import('@milkdown/kit/utils').then(({ replaceAll }) => {
          crepe.editor.action(replaceAll(normalizeRichEditorMarkdown(markdown)))
          queueMicrotask(() => {
            suppressChangesRef.current = false
          })
        })
      },
      focus: () => focusEditorWithoutScrolling(rootRef.current, scrollViewportRef.current)
    }),
    [scrollViewportRef]
  )

  useEffect(() => {
    crepeRef.current?.setReadonly(readOnly)
    if (!readOnly) focusEditorWithoutScrolling(rootRef.current, scrollViewportRef.current)
  }, [readOnly, scrollViewportRef])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const imageUrlCache = imageUrlCacheRef.current
    const objectUrls = objectUrlsRef.current
    let active = true
    let observer: MutationObserver | null = null
    let disposeBlockControls = (): void => undefined

    void Promise.all([
      import('@milkdown/crepe'),
      import('@milkdown/kit/utils'),
      import('@milkdown/kit/preset/commonmark')
    ])
      .then(async ([{ Crepe }, { $remark }, { remarkPreserveEmptyLinePlugin }]) => {
        if (!active) return
        const attachmentByPath = new Map(
          attachmentsRef.current.map((attachment) => [attachment.relativePath, attachment])
        )
        const unavailableUpload = async (): Promise<string> => {
          throw new Error('Adding attachments while editing a saved note is not available yet.')
        }
        const crepe = new Crepe({
          root,
          defaultValue: initialMarkdownRef.current,
          features: {
            [Crepe.Feature.TopBar]: false,
            [Crepe.Feature.AI]: false,
            [Crepe.Feature.Toolbar]: false
          },
          featureConfigs: {
            [Crepe.Feature.Placeholder]: { text: 'Start writing…', mode: 'block' },
            [Crepe.Feature.BlockEdit]: {
              textGroup: null,
              listGroup: null,
              advancedGroup: null
            },
            [Crepe.Feature.ImageBlock]: {
              onUpload: unavailableUpload,
              inlineOnUpload: unavailableUpload,
              blockOnUpload: unavailableUpload,
              maxWidth: 720,
              maxHeight: 512,
              proxyDomURL: async (source) => {
                const cached = imageUrlCacheRef.current.get(source)
                if (cached) return cached
                const attachment = attachmentByPath.get(source)
                if (!attachment) {
                  const placeholder = placeholderImage(
                    HTTP_URL_PATTERN.test(source)
                      ? 'Remote image blocked — open its link separately'
                      : 'Image source is unavailable'
                  )
                  imageUrlCacheRef.current.set(source, placeholder)
                  return placeholder
                }
                if (attachment.missingContent) {
                  const placeholder = placeholderImage(`Image missing: ${attachment.filename}`)
                  imageUrlCacheRef.current.set(source, placeholder)
                  return placeholder
                }
                const result = await window.kuskus.getNoteAttachmentPreview(itemId, attachment.id)
                if (!result.ok) return placeholderImage(`Image unavailable: ${attachment.filename}`)
                const objectUrl = URL.createObjectURL(
                  new Blob([result.data.bytes], { type: result.data.mediaType })
                )
                objectUrlsRef.current.add(objectUrl)
                imageUrlCacheRef.current.set(source, objectUrl)
                return objectUrl
              }
            }
          }
        })
        await crepe.editor.remove(remarkPreserveEmptyLinePlugin)
        configureKuskusEditorOverlays(crepe.editor)
        crepe.editor.use($remark('kuskus-soft-breaks', () => remarkBreaks))
        crepe.setReadonly(readOnlyRef.current)
        crepe.on((listener) => {
          listener.markdownUpdated((_ctx, markdown, previousMarkdown) => {
            const normalizedMarkdown = normalizeRichEditorMarkdown(markdown)
            const normalizedPreviousMarkdown = normalizeRichEditorMarkdown(previousMarkdown)
            if (
              !readyForUserChangesRef.current ||
              suppressChangesRef.current ||
              normalizedMarkdown === normalizedPreviousMarkdown
            )
              return
            onMarkdownChangeRef.current(normalizedMarkdown)
          })
        })
        crepeRef.current = crepe
        await crepe.create()
        if (!active) {
          await crepe.destroy()
          return
        }
        const [{ editorViewCtx }, { blockServiceInstance }, { Fragment }, { TextSelection }] =
          await Promise.all([
            import('@milkdown/kit/core'),
            import('@milkdown/kit/plugin/block'),
            import('@milkdown/kit/prose/model'),
            import('@milkdown/kit/prose/state')
          ])
        if (!active) return
        const view = crepe.editor.ctx.get(editorViewCtx)
        disposeBlockControls = installAccessibleBlockControls(root, {
          view,
          service: crepe.editor.ctx.get(blockServiceInstance.key),
          createFragment: (nodes) => Fragment.fromArray(nodes),
          createTextSelection: (doc, pos) => TextSelection.near(doc.resolve(pos))
        })
        markEditorControls(root)
        observer = new MutationObserver(() => markEditorControls(root))
        observer.observe(root, { childList: true, subtree: true })
        readyForUserChangesRef.current = true
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (!active) return
        setLoadError(
          error instanceof Error ? error.message : 'The rich editor could not be loaded.'
        )
        setLoading(false)
      })

    return () => {
      active = false
      readyForUserChangesRef.current = false
      observer?.disconnect()
      disposeBlockControls()
      const crepe = crepeRef.current
      crepeRef.current = null
      if (crepe) void crepe.destroy()
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
      objectUrls.clear()
      imageUrlCache.clear()
    }
  }, [itemId])

  if (loadError) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="destructive">
          <AlertTitle>Rich editing is unavailable</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <MarkdownPreview
          value={initialMarkdownRef.current}
          itemId={itemId}
          attachments={attachmentsRef.current}
          presentation="detail"
          onOpenLink={onOpenLink}
        />
      </div>
    )
  }

  return (
    <div
      className="kuskus-markdown-editor typeset kuskus-typeset"
      data-readonly={readOnly}
      data-typeset-presentation="detail"
      onClickCapture={(event) => {
        const target = event.target as HTMLElement
        const anchor = target.closest<HTMLAnchorElement>('a[href]')
        if (!anchor) return
        const href = anchor.getAttribute('href') ?? ''
        if (!HTTP_URL_PATTERN.test(href)) return
        event.preventDefault()
        if (readOnly) onOpenLink(href)
      }}
      onPasteCapture={(event) => {
        if ([...event.clipboardData.files].some((file) => file.type.startsWith('image/'))) {
          event.preventDefault()
        }
      }}
      onDropCapture={(event) => {
        if ([...event.dataTransfer.files].some((file) => file.type.startsWith('image/'))) {
          event.preventDefault()
        }
      }}
    >
      {loading ? (
        <div className="not-typeset flex flex-col gap-3 py-2" data-not-typeset>
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : null}
      <div ref={rootRef} className={loading ? 'sr-only' : undefined} />
    </div>
  )
})

export { WysiwygMarkdownEditor }
