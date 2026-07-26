import { useLayoutEffect, useRef, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { cn } from '@/lib/utils'
import { useNoteAttachmentPreviews } from '@/features/items/use-note-attachment-previews'
import type { NoteAttachmentDto } from '../../../../shared/library-contract'

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

export function MarkdownPreview({
  value,
  itemId,
  attachments = [],
  onOpenLink,
  presentation = 'card'
}: {
  value: string
  itemId?: string
  attachments?: NoteAttachmentDto[]
  onOpenLink?: (url: string) => void
  presentation?: 'card' | 'detail'
}): React.JSX.Element {
  const previewRef = useRef<HTMLDivElement>(null)
  const [isClipped, setIsClipped] = useState(false)
  const previews = useNoteAttachmentPreviews(itemId ?? '', itemId ? attachments : [])
  const localImages = new Map(
    attachments.map((attachment) => [
      attachment.relativePath,
      { attachment, preview: previews[attachment.id] ?? null }
    ])
  )

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
      const local = localImages.get(source)
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
            className="not-typeset max-h-[32rem] w-auto max-w-full rounded-lg object-contain outline -outline-offset-1 outline-black/10 dark:outline-white/10"
            data-not-typeset
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
      className={cn('relative', presentation === 'card' && 'max-h-80 overflow-hidden')}
    >
      <div className="typeset typeset-docs max-w-[37em] text-foreground/85">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={components}
        >
          {value}
        </ReactMarkdown>
      </div>
      {presentation === 'card' && isClipped ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-b from-transparent to-card"
        />
      ) : null}
    </div>
  )
}
