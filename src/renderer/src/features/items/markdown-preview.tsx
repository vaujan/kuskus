import { Fragment, type ReactNode } from 'react'

function renderInlineMarkdown(value: string, keyPrefix: string): ReactNode[] {
  return value
    .split(/(\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((token, index) => {
      const key = `${keyPrefix}-${index}`
      const link = token.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/)
      if (link)
        return (
          <span key={key} className="text-primary underline underline-offset-2">
            {link[1]}
          </span>
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

export function MarkdownPreview({ value }: { value: string }): React.JSX.Element {
  return (
    <div className="markdown-preview line-clamp-7 flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
      {value
        .split(/\r?\n/)
        .slice(0, 10)
        .map((line, index) => {
          const heading = line.match(/^(#{1,3})\s+(.+)$/)
          if (heading)
            return (
              <h3 key={index} className="text-balance font-semibold text-foreground">
                {renderInlineMarkdown(heading[2], `heading-${index}`)}
              </h3>
            )
          const list = line.match(/^[-*]\s+(.+)$/)
          if (list)
            return (
              <p key={index} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{renderInlineMarkdown(list[1], `list-${index}`)}</span>
              </p>
            )
          if (!line.trim()) return <br key={index} />
          return <p key={index}>{renderInlineMarkdown(line, `text-${index}`)}</p>
        })}
    </div>
  )
}
