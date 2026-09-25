import type { EditorView } from '@codemirror/view'

import { parseTableClipboard, serializeTable } from './markdown-table-model'

const TABLE_SNIPPET = [
  '| Heading | Heading | Heading |',
  '| ------- | ------- | ------- |',
  '| Cell    | Cell    | Cell    |',
  '| Cell    | Cell    | Cell    |'
].join('\n')

export function insertMarkdownTable(view: EditorView): boolean {
  const doc = view.state.doc
  const { from, to } = view.state.selection.main
  const prefix = from > 0 && doc.sliceString(from - 1, from) !== '\n' ? '\n' : ''
  const suffix = to < doc.length && doc.sliceString(to, to + 1) !== '\n' ? '\n' : ''
  const insert = `${prefix}${TABLE_SNIPPET}${suffix}`
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + prefix.length + 2 },
    userEvent: 'input'
  })
  view.focus()
  return true
}

export function convertTablePaste(text: string): string | null {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized.includes('\t') && !normalized.includes('\n')) return null
  const rows = parseTableClipboard(normalized)
  const columnCount = rows[0]?.length ?? 0
  if (columnCount < 2 || rows.some((row) => row.length !== columnCount)) return null
  return serializeTable({
    header: rows[0],
    rows: rows.slice(1),
    aligns: Array(columnCount).fill(null)
  })
}
