import { Fragment, type ReactNode, useLayoutEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import { useNoteAttachmentPreviews } from '@/features/items/use-note-attachment-previews'
import type { NoteAttachmentDto } from '../../../../shared/library-contract'

function renderInlineMarkdown(
  value: string,
  keyPrefix: string,
  onOpenLink: ((url: string) => void) | undefined,
  localImages: Map<string, { attachment: NoteAttachmentDto; preview: string | null }>
): ReactNode[] {
  return value
    .split(/(!\[[^\]]*\]\([^\s)]+\)|\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((token, index) => {
      const key = `${keyPrefix}-${index}`
      const image = token.match(/^!\[([^\]]*)\]\(([^\s)]+)\)$/)
      if (image) {
        const local = localImages.get(image[2])
        if (local) {
          if (local.attachment.missingContent) {
            return (
              <span
                key={key}
                className="my-2 flex min-h-24 items-center justify-center rounded-lg bg-muted px-4 text-center text-xs text-muted-foreground"
              >
                Image missing: {image[1] || local.attachment.filename}
              </span>
            )
          }
          if (!local.preview) {
            return (
              <span
                key={key}
                className="my-2 flex min-h-24 items-center justify-center rounded-lg bg-muted px-4 text-xs text-muted-foreground"
                role="status"
              >
                Loading image…
              </span>
            )
          }
          return (
            <img
              key={key}
              src={local.preview}
              alt={image[1] || local.attachment.filename}
              className="my-2 max-h-[32rem] w-auto max-w-full rounded-lg object-contain outline -outline-offset-1 outline-black/10 dark:outline-white/10"
            />
          )
        }
        if (/^https?:\/\//i.test(image[2])) {
          return (
            <button
              key={key}
              type="button"
              className="relative z-20 text-primary underline underline-offset-2"
              onClick={(event) => {
                event.stopPropagation()
                onOpenLink?.(image[2])
              }}
            >
              {image[1] || 'Open remote image'}
            </button>
          )
        }
        return <Fragment key={key}>{token}</Fragment>
      }
      const link = token.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/)
      if (link)
        return (
          <button
            key={key}
            type="button"
            className="relative z-20 text-primary underline underline-offset-2"
            onClick={(event) => {
              event.stopPropagation()
              onOpenLink?.(link[2])
            }}
          >
            {link[1]}
          </button>
        )
      if (token.startsWith('**')) return <strong key={key}>{token.slice(2, -2)}</strong>
      if (token.startsWith('`'))
        return (
          <code key={key} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
            {token.slice(1, -1)}
          </code>
        )
      if (token.startsWith('*')) return <em key={key}>{token.slice(1, -1)}</em>
      return <Fragment key={key}>{token}</Fragment>
    })
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

  return (
    <div
      ref={previewRef}
      className={cn('relative', presentation === 'card' && 'max-h-80 overflow-hidden')}
    >
      <div
        className={cn(
          'flex flex-col break-words text-foreground/78',
          presentation === 'detail' ? 'gap-3 text-[0.9375rem] leading-7' : 'gap-2 text-sm leading-6'
        )}
      >
        {value.split(/\r?\n/).map((line, index) => {
          const heading = line.match(/^(#{1,3})\s+(.+)$/)
          if (heading)
            return (
              <h3 key={index} className="text-balance font-semibold text-foreground">
                {renderInlineMarkdown(heading[2], `heading-${index}`, onOpenLink, localImages)}
              </h3>
            )
          const list = line.match(/^[-*]\s+(.+)$/)
          if (list)
            return (
              <p key={index} className="flex gap-2 text-pretty">
                <span aria-hidden="true">•</span>
                <span className="min-w-0">
                  {renderInlineMarkdown(list[1], `list-${index}`, onOpenLink, localImages)}
                </span>
              </p>
            )
          if (!line.trim()) return <br key={index} />
          return (
            <p key={index} className="text-pretty">
              {renderInlineMarkdown(line, `text-${index}`, onOpenLink, localImages)}
            </p>
          )
        })}
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
