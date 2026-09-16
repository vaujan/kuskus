import { useMemo } from 'react'

import { MarkdownCodeBlock } from '@/features/items/markdown-code-block'
import { cn } from '@/lib/utils'
import { noteFrontmatterSource } from '../../../../shared/note-frontmatter'

/**
 * Read-mode rendering of a note's leading YAML frontmatter as a code
 * card — the same rounded, highlighted, copyable block as fenced code,
 * with a "YAML" header. The `---` delimiters are omitted; the block
 * shows the raw property body. Renders nothing when the note has no
 * valid frontmatter.
 *
 * In live mode the same visual is produced by the editor's own
 * frontmatter decorations; this component is for the static read /
 * split preview surface only.
 */
export function MarkdownFrontmatterBlock({
  markdown,
  className,
  onOpenLink
}: {
  markdown: string
  className?: string
  onOpenLink?: (url: string) => void
}): React.JSX.Element | null {
  const source = useMemo(() => noteFrontmatterSource(markdown), [markdown])
  if (!source) return null
  const yaml = source.yaml.replace(/\n$/, '')

  return (
    <div className={cn('typeset kuskus-typeset', className)} data-typeset-presentation="detail">
      <MarkdownCodeBlock code={yaml} language="yaml" onOpenLink={onOpenLink} />
    </div>
  )
}
