import { Fragment, type ReactNode, useLayoutEffect, useRef, useState } from 'react'

function renderInlineMarkdown(
  value: string,
  keyPrefix: string,
  onOpenLink?: (url: string) => void
): ReactNode[] {
  return value
    .split(/(\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((token, index) => {
      const key = `${keyPrefix}-${index}`
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
  onOpenLink
}: {
  value: string
  onOpenLink?: (url: string) => void
}): React.JSX.Element {
  const previewRef = useRef<HTMLDivElement>(null)
  const [isClipped, setIsClipped] = useState(false)

  useLayoutEffect(() => {
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
  }, [value])

  return (
    <div ref={previewRef} className="relative max-h-80 overflow-hidden">
      <div className="flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
        {value.split(/\r?\n/).map((line, index) => {
          const heading = line.match(/^(#{1,3})\s+(.+)$/)
          if (heading)
            return (
              <h3 key={index} className="text-balance font-semibold text-foreground">
                {renderInlineMarkdown(heading[2], `heading-${index}`, onOpenLink)}
              </h3>
            )
          const list = line.match(/^[-*]\s+(.+)$/)
          if (list)
            return (
              <p key={index} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{renderInlineMarkdown(list[1], `list-${index}`, onOpenLink)}</span>
              </p>
            )
          if (!line.trim()) return <br key={index} />
          return <p key={index}>{renderInlineMarkdown(line, `text-${index}`, onOpenLink)}</p>
        })}
      </div>
      {isClipped ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-b from-transparent to-card"
        />
      ) : null}
    </div>
  )
}
