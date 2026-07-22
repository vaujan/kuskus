import { memo, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import remarkBreaks from 'remark-breaks'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { configureKuskusEditorOverlays } from '@/features/items/editor-overlays'
import { MarkdownPreview } from '@/features/items/markdown-preview'
import type { NoteAttachmentDto } from '../../../../shared/library-contract'

type CrepeInstance = import('@milkdown/crepe').Crepe

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

const WysiwygMarkdownEditor = memo(function WysiwygMarkdownEditor({
  ref,
  itemId,
  initialMarkdown,
  attachments,
  readOnly,
  onMarkdownChange,
  onOpenLink
}: WysiwygMarkdownEditorProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<CrepeInstance | null>(null)
  const readOnlyRef = useRef(readOnly)
  const onMarkdownChangeRef = useRef(onMarkdownChange)
  const suppressChangesRef = useRef(false)
  const readyForUserChangesRef = useRef(false)
  const initialMarkdownRef = useRef(initialMarkdown)
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
          crepe.editor.action(replaceAll(markdown))
          queueMicrotask(() => {
            suppressChangesRef.current = false
          })
        })
      },
      focus: () => rootRef.current?.querySelector<HTMLElement>('.ProseMirror')?.focus()
    }),
    []
  )

  useEffect(() => {
    crepeRef.current?.setReadonly(readOnly)
    if (!readOnly) rootRef.current?.querySelector<HTMLElement>('.ProseMirror')?.focus()
  }, [readOnly])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const imageUrlCache = imageUrlCacheRef.current
    const objectUrls = objectUrlsRef.current
    let active = true
    let observer: MutationObserver | null = null

    void Promise.all([import('@milkdown/crepe'), import('@milkdown/kit/utils')])
      .then(async ([{ Crepe }, { $remark }]) => {
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
        configureKuskusEditorOverlays(crepe.editor)
        crepe.editor.use($remark('kuskus-soft-breaks', () => remarkBreaks))
        crepe.setReadonly(readOnlyRef.current)
        crepe.on((listener) => {
          listener.markdownUpdated((_ctx, markdown, previousMarkdown) => {
            if (
              !readyForUserChangesRef.current ||
              suppressChangesRef.current ||
              markdown === previousMarkdown
            )
              return
            onMarkdownChangeRef.current(markdown)
          })
        })
        crepeRef.current = crepe
        await crepe.create()
        if (!active) {
          await crepe.destroy()
          return
        }
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
      className="kuskus-markdown-editor typeset typeset-docs max-w-[37em] text-foreground/85"
      data-readonly={readOnly}
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
