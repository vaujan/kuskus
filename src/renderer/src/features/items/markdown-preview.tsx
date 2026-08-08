import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import '@/assets/katex-woff2.css'
import rehypeKatex from 'rehype-katex'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { cn } from '@/lib/utils'
import { useNoteAttachmentPreviews } from '@/features/items/use-note-attachment-previews'
import type { NoteAttachmentDto } from '../../../../shared/library-contract'
import { markdownImageTargetKey } from '../../../../shared/markdown-image-references'
import { prepareObsidianMarkdown } from '@/features/items/obsidian-markdown'

const REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkMath]
const REHYPE_PLUGINS = [rehypeKatex]

function EmbeddedImageState({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span
      className="not-typeset my-3 flex min-h-24 items-center justify-center rounded-lg bg-muted px-4 text-center text-xs text-muted-foreground"
      data-not-typeset
    >
      {children}
    </span>
  )
}

export const MarkdownPreview = memo(function MarkdownPreview({
  value,
  itemId,
  attachments = [],
  attachmentPreviews,
  onOpenLink,
  onOpenVaultLink,
  presentation = 'card'
}: {
  value: string
  itemId?: string
  attachments?: NoteAttachmentDto[]
  attachmentPreviews?: Record<string, string>
  onOpenLink?: (url: string) => void
  onOpenVaultLink?: (target: string) => void
  presentation?: 'card' | 'compact' | 'detail'
}): React.JSX.Element {
  const previewRef = useRef<HTMLDivElement>(null)
  const [isClipped, setIsClipped] = useState(false)
  const loadedPreviews = useNoteAttachmentPreviews(
    itemId ?? '',
    itemId ? attachments : [],
    attachmentPreviews === undefined
  )
  const previews = attachmentPreviews ?? loadedPreviews
  const localImages = useMemo(() => {
    const images = new Map<string, { attachment: NoteAttachmentDto; preview: string | null }>()
    for (const attachment of attachments) {
      const value = { attachment, preview: previews[attachment.id] ?? null }
      images.set(markdownImageTargetKey(attachment.relativePath), value)
      images.set(markdownImageTargetKey(attachment.filename), value)
    }
    return images
  }, [attachments, previews])

  useLayoutEffect(() => {
    if (presentation === 'detail') return

    const preview = previewRef.current
    if (!preview) return

    const updateClipped = (): void => {
      setIsClipped(preview.scrollHeight > preview.clientHeight)
    }
    const observer = new ResizeObserver(updateClipped)
    const frame = requestAnimationFrame(updateClipped)

    observer.observe(preview)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [presentation, value])

  const components: Components = {
    a: ({ href, children, ...props }) => {
      if (href?.startsWith('kuskus-note:')) {
        const target = decodeURIComponent(href.slice('kuskus-note:'.length))
        return (
          <a
            {...props}
            href={href}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onOpenVaultLink?.(target)
            }}
          >
            {children}
          </a>
        )
      }
      if (!href || !/^https?:\/\//i.test(href)) return <span>{children}</span>
      return (
        <a
          {...props}
          href={href}
          className="transition-[opacity] [transition-duration:var(--motion-duration-press)] [transition-timing-function:var(--motion-ease-out)] active:opacity-60"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onOpenLink?.(href)
          }}
        >
          {children}
        </a>
      )
    },
    img: ({ src, alt }) => {
      const source = typeof src === 'string' ? src : ''
      const local = localImages.get(markdownImageTargetKey(source))
      if (local) {
        if (local.attachment.missingContent) {
          return (
            <EmbeddedImageState>
              Image missing: {alt || local.attachment.filename}
            </EmbeddedImageState>
          )
        }
        if (!local.preview) return <EmbeddedImageState>Loading image…</EmbeddedImageState>
        return (
          <img
            src={local.preview}
            alt={alt ?? local.attachment.filename}
            className="kuskus-markdown-image"
          />
        )
      }
      if (/^https?:\/\//i.test(source)) {
        return (
          <a
            href={source}
            className="transition-[opacity] [transition-duration:var(--motion-duration-press)] [transition-timing-function:var(--motion-ease-out)] active:opacity-60"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onOpenLink?.(source)
            }}
          >
            {alt || 'Open remote image'}
          </a>
        )
      }
      return <code>{source || alt || 'Invalid image'}</code>
    },
    table: ({ children, ...props }) => (
      <div className="typeset-scroll">
        <table {...props}>{children}</table>
      </div>
    )
  }

  return (
    <div
      ref={previewRef}
      className={cn(
        'relative',
        presentation === 'card' && 'max-h-80 overflow-hidden',
        presentation === 'compact' && 'max-h-[13.25rem] overflow-hidden',
        presentation !== 'detail' && isClipped && 'kuskus-card-content-fade'
      )}
    >
      <div className="typeset kuskus-typeset" data-typeset-presentation={presentation}>
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS}
          components={components}
        >
          {prepareObsidianMarkdown(value, attachments)}
        </ReactMarkdown>
      </div>
    </div>
  )
})
