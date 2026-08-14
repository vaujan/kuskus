import { useEffect, useId, useState } from 'react'

import { copyMarkdownCode } from '@/features/items/markdown-code'

let renderQueue = Promise.resolve()
let renderSequence = 0

function renderMermaid(id: string, code: string, dark: boolean): Promise<string> {
  const render = async (): Promise<string> => {
    const mermaid = (await import('mermaid')).default
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: dark ? 'dark' : 'neutral'
    })
    return (await mermaid.render(id, code)).svg
  }
  const result = renderQueue.then(render)
  renderQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

export function MarkdownMermaid({ code }: { code: string }): React.JSX.Element {
  const id = `kuskus-mermaid-${useId().replace(/[^a-z0-9]/gi, '')}`
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const renderKey = `${dark}:${code}`
  const [result, setResult] = useState<{ key: string; svg: string; error: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
  const current = result?.key === renderKey ? result : null

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => setDark(root.classList.contains('dark')))
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true
    void renderMermaid(`${id}-${++renderSequence}`, code, dark).then(
      (svg) => {
        if (active) setResult({ key: renderKey, svg, error: false })
      },
      () => {
        if (active) setResult({ key: renderKey, svg: '', error: true })
      }
    )
    return () => {
      active = false
    }
  }, [code, dark, id, renderKey])

  return (
    <div className="kuskus-code-block kuskus-mermaid not-typeset" data-not-typeset>
      <div className="kuskus-code-block-header">
        <span>{current?.error ? 'Mermaid · Invalid diagram' : 'Mermaid'}</span>
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
      {current?.error ? (
        <pre>
          <code>{code}</code>
        </pre>
      ) : current?.svg ? (
        <div
          className="kuskus-mermaid-diagram"
          role="img"
          aria-label="Mermaid diagram"
          dangerouslySetInnerHTML={{ __html: current.svg }}
        />
      ) : (
        <div className="kuskus-mermaid-loading" role="status">
          Rendering diagram…
        </div>
      )}
    </div>
  )
}
