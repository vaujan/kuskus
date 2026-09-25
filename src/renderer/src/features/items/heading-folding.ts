import type { Tree } from '@lezer/common'

export interface HeadingFoldTarget {
  line: number
  level: number
  from: number
  to: number
}

export function headingFoldTargets(
  tree: Tree,
  lineAt: (position: number) => { number: number; from: number; to: number },
  documentLength: number
): HeadingFoldTarget[] {
  const headings: { line: number; level: number; end: number; start: number }[] = []
  tree.iterate({
    enter(node) {
      const match = /^(?:ATXHeading([1-6])|SetextHeading([12]))$/.exec(node.name)
      if (!match || node.node.parent?.name !== 'Document') return
      headings.push({
        line: lineAt(node.from).number,
        level: Number(match[1] ?? match[2]),
        start: node.from,
        end: node.to
      })
    }
  })

  return headings.flatMap((heading, index) => {
    const next = headings.slice(index + 1).find((entry) => entry.level <= heading.level)
    const from = lineAt(heading.end).to
    const to = next ? lineAt(next.start).from - 1 : documentLength
    return to > from ? [{ line: heading.line, level: heading.level, from, to }] : []
  })
}
