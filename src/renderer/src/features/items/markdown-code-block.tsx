import { useEffect, useRef, useState } from 'react'

import {
  codeLanguageLabel,
  copyMarkdownCode,
  isMermaidLanguage,
  renderHighlightedCode
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
  const codeRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (codeRef.current) renderHighlightedCode(codeRef.current, code, language)
  }, [code, language])

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
        <code ref={codeRef} />
      </pre>
    </div>
  )
}
