import { EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'

export const slashCommands = [
  { id: 'text', label: 'Text', syntax: '', insert: '' },
  { id: 'heading-1', label: 'Heading 1', syntax: '#', insert: '# ' },
  { id: 'heading-2', label: 'Heading 2', syntax: '##', insert: '## ' },
  { id: 'heading-3', label: 'Heading 3', syntax: '###', insert: '### ' },
  { id: 'bullet-list', label: 'Bulleted list', syntax: '-', insert: '- ' },
  { id: 'numbered-list', label: 'Numbered list', syntax: '1.', insert: '1. ' },
  { id: 'quote', label: 'Quote', syntax: '>', insert: '> ' },
  { id: 'code', label: 'Code block', syntax: '```', insert: '```\n\n```', cursor: 4 },
  { id: 'divider', label: 'Divider', syntax: '---', insert: '---' },
  {
    id: 'table',
    label: 'Table',
    syntax: '',
    insert: '| Column 1 | Column 2 |\n| --- | --- |\n|  |  |',
    cursor: 37
  }
] as const

export interface SlashQuery {
  query: string
  from: number
  to: number
}

export function findSlashQuery(textBeforeCursor: string): string | null {
  return textBeforeCursor.match(/^\s*\/([^\s/]*)$/)?.[1] ?? null
}

export function canStartSlashQuery(textBeforeCursor: string): boolean {
  return /^\s*$/.test(textBeforeCursor)
}

export function fitSlashMenuPosition(
  anchor: { left: number; bottom: number },
  viewport: { width: number; height: number },
  menu: { width: number; height: number }
): { left: number; top: number } {
  return {
    left: Math.max(8, Math.min(anchor.left, viewport.width - menu.width - 8)),
    top: Math.max(8, Math.min(anchor.bottom + 6, viewport.height - menu.height - 8))
  }
}

export function currentSlashQuery(state: EditorState): SlashQuery | null {
  const selection = state.selection.main
  if (!selection.empty) return null
  const line = state.doc.lineAt(selection.head)
  const query = findSlashQuery(state.sliceDoc(line.from, selection.head))
  if (query === null || state.sliceDoc(selection.head, line.to).trim()) return null
  const from = selection.head - query.length - 1
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(from, 1)
  while (node) {
    if (node.name === 'FencedCode' || node.name === 'CodeBlock' || node.name === 'Frontmatter') {
      return null
    }
    node = node.parent
  }
  return { query, from, to: selection.head }
}
