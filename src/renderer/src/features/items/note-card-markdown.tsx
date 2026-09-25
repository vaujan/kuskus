import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

import { closeUnbalancedCodeFences } from '@/features/items/markdown-fence-balance'
import { cn } from '@/lib/utils'

export const NoteCardMarkdown = memo(function NoteCardMarkdown({
  markdown,
  compact = false
}: {
  markdown: string
  compact?: boolean
}): React.JSX.Element {
  const balancedMarkdown = useMemo(() => closeUnbalancedCodeFences(markdown), [markdown])
  const previewRef = useRef<HTMLDivElement>(null)
  const [isClipped, setIsClipped] = useState(false)

  useLayoutEffect(() => {
    const preview = previewRef.current
    if (!preview) return

    const updateClipped = (): void => {
      const nextClipped = preview.scrollHeight > preview.clientHeight
      setIsClipped((current) => (current === nextClipped ? current : nextClipped))
    }
    const observer = new ResizeObserver(updateClipped)
    const frame = requestAnimationFrame(updateClipped)

    observer.observe(preview)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [balancedMarkdown, compact])

  const components = useMemo<Components>(
    () => ({
      a: ({ children }) => (
        <span className="underline decoration-foreground/30 underline-offset-2">{children}</span>
      ),
      input: ({ checked }) => (
        <input
          type="checkbox"
          checked={Boolean(checked)}
          disabled
          aria-label={checked ? 'Completed task' : 'Open task'}
        />
      ),
      img: ({ alt }) =>
        alt ? (
          <span className="not-typeset my-2 block px-4 text-center text-xs text-muted-foreground italic">
            {alt}
          </span>
        ) : null
    }),
    []
  )

  return (
    <div
      ref={previewRef}
      data-typeset-presentation={compact ? 'snippet-compact' : 'snippet'}
      className={cn(
        'kuskus-note-card-markdown typeset kuskus-typeset overflow-hidden [--typeset-body-color:var(--muted-foreground)]',
        compact ? 'max-h-[13rem]' : 'max-h-[20rem]',
        isClipped && 'kuskus-card-content-fade'
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {balancedMarkdown}
      </ReactMarkdown>
    </div>
  )
})
