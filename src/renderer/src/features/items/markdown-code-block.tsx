import { useEffect, useMemo, useState } from 'react'

import {
  codeLanguageLabel,
  copyMarkdownCode,
  ensureCodeLanguageLoaded,
  highlightedCodeRanges,
  isMermaidLanguage,
  markdownCodeUrlRanges
} from '@/features/items/markdown-code'
import { MarkdownMermaid } from '@/features/items/markdown-mermaid'

export function MarkdownCodeCardHeader({
  code,
  label
}: {
  code: string
  label: string
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  return (
    <div className="kuskus-code-block-header">
      <span>{label}</span>
      <button
        type="button"
        className="kuskus-code-copy"
        aria-label={`Copy ${label}`}
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
  )
}

export function MarkdownCodeBlock({
  code,
  language,
  diagrams = false,
  onOpenLink
}: {
  code: string
  language: string
  diagrams?: boolean
  onOpenLink?: (url: string) => void
}): React.JSX.Element {
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
    const highlights = highlightedCodeRanges(code, language)
    const links = onOpenLink ? markdownCodeUrlRanges(code) : []
    const boundaries = new Set([0, code.length])
    for (const range of [...highlights, ...links]) {
      boundaries.add(range.from)
      boundaries.add(range.to)
    }
    const offsets = [...boundaries].sort((a, b) => a - b)
    return offsets.slice(0, -1).map((from, index) => {
      const to = offsets[index + 1]
      const text = code.slice(from, to)
      const highlight = highlights.find((range) => range.from <= from && range.to >= to)
      const link = links.find((range) => range.from <= from && range.to >= to)
      const content = highlight ? <span className={highlight.classes}>{text}</span> : text
      return link ? (
        <a
          key={`${from}-${to}`}
          href={link.url}
          className="kuskus-code-link"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onOpenLink?.(link.url)
          }}
        >
          {content}
        </a>
      ) : (
        <span key={`${from}-${to}`}>{content}</span>
      )
    })
  }, [code, language, grammarTick, onOpenLink])

  if (diagrams && isMermaidLanguage(language)) return <MarkdownMermaid code={code} />

  return (
    <div className="kuskus-code-block not-typeset" data-not-typeset>
      <MarkdownCodeCardHeader code={code} label={codeLanguageLabel(language)} />
      <pre>
        <code>{highlighted}</code>
      </pre>
    </div>
  )
}
