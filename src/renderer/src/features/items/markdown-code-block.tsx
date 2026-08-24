import { useEffect, useMemo, useState } from 'react'

import {
  codeLanguageLabel,
  copyMarkdownCode,
  ensureCodeLanguageLoaded,
  highlightedCodeRanges,
  isMermaidLanguage
} from '@/features/items/markdown-code'
import { MarkdownMermaid } from '@/features/items/markdown-mermaid'

export function MarkdownCodeBlock({
  code,
  language,
  diagrams = false
}: {
  code: string
  language: string
  diagrams?: boolean
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const [grammarTick, setGrammarTick] = useState(0)

  // Registry languages lazy-load their grammar; re-highlight once it arrives.
  useEffect(() => {
    const loading = ensureCodeLanguageLoaded(language)
    if (!loading) return
    let cancelled = false
    void loading.then(() => {
      if (!cancelled) setGrammarTick((tick) => tick + 1)
    })
    return () => {
      cancelled = true
    }
  }, [language])

  const highlighted = useMemo(() => {
    // Re-runs when a lazy registry grammar finishes loading.
    void grammarTick
    const nodes: React.ReactNode[] = []
    let position = 0
    for (const range of highlightedCodeRanges(code, language)) {
      if (range.from > position) nodes.push(code.slice(position, range.from))
      nodes.push(
        <span key={`${range.from}-${range.to}`} className={range.classes}>
          {code.slice(range.from, range.to)}
        </span>
      )
      position = range.to
    }
    if (position < code.length) nodes.push(code.slice(position))
    return nodes
  }, [code, language, grammarTick])

  if (diagrams && isMermaidLanguage(language)) return <MarkdownMermaid code={code} />

  return (
    <div className="kuskus-code-block not-typeset" data-not-typeset>
      <div className="kuskus-code-block-header">
        <span>{codeLanguageLabel(language)}</span>
        <button
          type="button"
          className="kuskus-code-copy"
          onClick={async () => {
            if (await copyMarkdownCode(code)) {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            }
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code>{highlighted}</code>
      </pre>
    </div>
  )
}
