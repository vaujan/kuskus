export function SearchHighlight({
  text,
  query
}: {
  text: string
  query: string
}): React.JSX.Element {
  const terms = [...new Set(query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean))]
  if (!terms.length) return <>{text}</>

  const normalized = text.toLocaleLowerCase()
  const pieces: React.ReactNode[] = []
  let position = 0
  while (position < text.length) {
    let next = text.length
    let match = ''
    for (const term of terms) {
      const index = normalized.indexOf(term, position)
      if (index >= 0 && (index < next || (index === next && term.length > match.length))) {
        next = index
        match = term
      }
    }
    if (!match) {
      pieces.push(text.slice(position))
      break
    }
    if (next > position) pieces.push(text.slice(position, next))
    pieces.push(
      <mark key={next} className="rounded-sm bg-amber-400/35 text-inherit">
        {text.slice(next, next + match.length)}
      </mark>
    )
    position = next + match.length
  }
  return <>{pieces}</>
}
