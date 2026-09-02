import { memo, useMemo } from 'react'
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

  const components = useMemo<Components>(
    () => ({
      a: ({ children }) => (
        <span className="underline decoration-foreground/30 underline-offset-2">{children}</span>
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
      data-typeset-presentation={compact ? 'snippet-compact' : 'snippet'}
      className={cn(
        'kuskus-note-card-markdown typeset kuskus-typeset overflow-hidden [--typeset-body-color:var(--muted-foreground)]',
        compact ? 'max-h-[13rem]' : 'max-h-[20rem]'
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {balancedMarkdown}
      </ReactMarkdown>
    </div>
  )
})
