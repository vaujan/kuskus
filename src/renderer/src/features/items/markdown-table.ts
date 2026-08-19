import { syntaxTree } from '@codemirror/language'
import type { EditorState, Line, Text } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

const PIPE = /(?<!\\)\|/g
const SEPARATOR = /^:?-{3,}:?$/

type Align = 'left' | 'center' | 'right'

function splitTableLine(line: string): string[] {
  const cells = line.split(PIPE).map((cell) => cell.trim())
  if (cells[0] === '') cells.shift()
  if (cells[cells.length - 1] === '') cells.pop()
  return cells
}

function isSeparatorCell(cell: string): boolean {
  return SEPARATOR.test(cell)
}

function isTableLine(line: string): boolean {
  return line.includes('|')
}

function separatorAlign(cell: string): Align | null {
  if (!isSeparatorCell(cell)) return null
  const left = cell.startsWith(':')
  const right = cell.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  return 'left'
}

function pad(cell: string, width: number, align: Align | null): string {
  const gap = width - [...cell].length
  if (gap <= 0) return cell
  if (align === 'right') return ' '.repeat(gap) + cell
  if (align === 'center') {
    const left = Math.floor(gap / 2)
    return ' '.repeat(left) + cell + ' '.repeat(gap - left)
  }
  return cell + ' '.repeat(gap)
}

function separatorCell(align: Align | null, width: number): string {
  const dashes = '-'.repeat(Math.max(width, 3))
  if (align === 'center') return `:${dashes}:`
  if (align === 'right') return `${dashes}:`
  if (align === 'left') return `:${dashes}`
  return dashes
}

function alignTableRows(lines: string[]): string | null {
  const rows = lines.map((line) => splitTableLine(line))
  if (!rows.length || !rows[0].length) return null
  const separatorIndex = rows[1]?.every(isSeparatorCell) === true ? 1 : -1
  const columnCount = Math.max(...rows.map((row) => row.length))
  const widths = Array.from({ length: columnCount }, (_, col) =>
    Math.max(...rows.map((row) => [...(row[col] ?? '')].length))
  )
  const aligns: (Align | null)[] = Array.from({ length: columnCount }, (_, col) =>
    separatorIndex >= 0 ? separatorAlign(rows[1][col] ?? '') : null
  )

  const rendered: string[] = []
  for (let row = 0; row < rows.length; row += 1) {
    const cells = rows[row]
    if (row === separatorIndex) {
      rendered.push(cells.map((_cell, col) => separatorCell(aligns[col], widths[col])).join(' | '))
      continue
    }
    const padded = Array.from({ length: columnCount }, (_, col) =>
      pad(cells[col] ?? '', widths[col], aligns[col])
    )
    rendered.push(padded.join(' | '))
  }
  return rendered.join('\n')
}

export function alignMarkdownTable(markdown: string): string | null {
  const aligned = alignTableRows(markdown.split('\n'))
  return aligned === null ? null : `| ${aligned.replaceAll('\n', '\n| ')} |`
}

export function findMarkdownTableRange(
  doc: Text,
  pos: number
): { from: number; to: number } | null {
  if (pos < 0 || pos > doc.length) return null
  const line = doc.lineAt(pos)
  if (!isTableLine(line.text)) return null
  let first = line.number
  while (first > 1 && isTableLine(doc.line(first - 1).text)) first -= 1
  let last = line.number
  while (last < doc.lines && isTableLine(doc.line(last + 1).text)) last += 1
  return { from: doc.line(first).from, to: doc.line(last).to }
}

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
  const cursor = from + prefix.length + 2
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: cursor },
    userEvent: 'input'
  })
  view.focus()
  return true
}

export function insideMarkdownFence(state: EditorState, pos: number): boolean {
  let hit = false
  syntaxTree(state).iterate({
    from: Math.max(0, pos - 1),
    to: Math.min(state.doc.length, pos + 1),
    enter: (node) => {
      if (node.type.name === 'FencedCode' || node.type.name === 'CodeBlock') {
        hit = true
        return true
      }
      return false
    }
  })
  return hit
}

export function formatMarkdownTable(view: EditorView): boolean {
  const { state } = view
  const { from, to } = state.selection.main
  if (insideMarkdownFence(state, from)) return false
  const range = findMarkdownTableRange(state.doc, from)
  if (!range) return false
  const aligned = alignMarkdownTable(state.doc.sliceString(range.from, range.to))
  if (aligned === null || aligned === state.doc.sliceString(range.from, range.to)) return false
  const delta = aligned.length - (range.to - range.from)
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: aligned },
    selection: {
      anchor: Math.min(from, range.from + aligned.length),
      head: Math.min(to + delta, range.from + aligned.length)
    },
    userEvent: 'input'
  })
  view.focus()
  return true
}

interface MarkdownTableCell {
  start: number
  end: number
  contentStart: number
  contentEnd: number
}

interface MarkdownTableRow {
  line: Line
  lineNumber: number
  spans: MarkdownTableCell[]
}

function tableRowSpans(doc: Text, pos: number): MarkdownTableRow | null {
  const line = doc.lineAt(pos)
  if (!isTableLine(line.text)) return null
  const pipeIndexes = [...line.text.matchAll(PIPE)].map((match) => match.index)
  const starts: number[] = []
  if (!line.text.startsWith('|')) starts.push(0)
  for (const pipe of pipeIndexes) starts.push(pipe + 1)
  const ends: number[] = [...pipeIndexes.slice(1)]
  if (pipeIndexes.length === 0 || pipeIndexes[pipeIndexes.length - 1] !== line.text.length - 1) {
    ends.push(line.text.length)
  }
  const spans: MarkdownTableCell[] = []
  for (let i = 0; i < Math.min(starts.length, ends.length); i += 1) {
    const start = starts[i]
    const end = ends[i]
    if (end <= start) continue
    const raw = line.text.slice(start, end)
    spans.push({
      start: line.from + start,
      end: line.from + end,
      contentStart: line.from + start + (raw.length - raw.trimStart().length),
      contentEnd: line.from + end - (raw.length - raw.trimEnd().length)
    })
  }
  return { line, lineNumber: line.number, spans }
}

function caretCellIndex(row: MarkdownTableRow, pos: number): number {
  const offset = pos - row.line.from
  const index = row.spans.findIndex(
    (span) => offset >= span.start - row.line.from && offset <= span.end - row.line.from
  )
  return index === -1 ? 0 : index
}

function tableRowText(columnCount: number): string {
  return `| ${Array.from({ length: columnCount }, () => '').join(' | ')} |`
}

function cellContentStart(line: string, column: number): number {
  const pipes = [...line.matchAll(PIPE)].map((match) => match.index)
  let start: number
  if (pipes.length === 0) start = 0
  else if (column === 0 && !line.startsWith('|')) start = 0
  else start = pipes[Math.min(column, pipes.length - 1)] + 1
  while (start < line.length && line[start] === ' ') start += 1
  return start
}

function insertTableRow(view: EditorView, columnIndex: number): boolean {
  const { state } = view
  const head = state.selection.main.head
  const row = tableRowSpans(state.doc, head)
  if (!row) return false
  const range = findMarkdownTableRange(state.doc, head)
  if (!range) return false
  const lines = state.doc.sliceString(range.from, range.to).split('\n')
  const columnCount = Math.max(...lines.map((line) => splitTableLine(line).length))
  const rowIndex = row.lineNumber - state.doc.lineAt(range.from).number
  lines.splice(rowIndex + 1, 0, tableRowText(columnCount))
  const aligned = alignMarkdownTable(lines.join('\n')) ?? lines.join('\n')
  const alignedLines = aligned.split('\n')
  const lineStart = alignedLines.slice(0, rowIndex + 1).join('\n').length
  const newLine = alignedLines[rowIndex + 1]
  const caret =
    range.from +
    lineStart +
    cellContentStart(newLine, Math.min(columnIndex, splitTableLine(newLine).length - 1))
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: aligned },
    selection: { anchor: caret },
    userEvent: 'input'
  })
  view.focus()
  return true
}

export function moveTableCursor(view: EditorView, dir: -1 | 1): boolean {
  const { state } = view
  const head = state.selection.main.head
  if (insideMarkdownFence(state, head)) return false
  const row = tableRowSpans(state.doc, head)
  if (!row) return false
  const range = findMarkdownTableRange(state.doc, head)
  if (!range) return false
  const index = caretCellIndex(row, head)
  const nextIndex = index + dir
  if (nextIndex >= 0 && nextIndex < row.spans.length) {
    view.dispatch({
      selection: { anchor: row.spans[nextIndex].contentStart },
      userEvent: 'select'
    })
    return true
  }
  const inTable =
    row.lineNumber + dir >= state.doc.lineAt(range.from).number &&
    row.lineNumber + dir <= state.doc.lineAt(range.to).number
  if (inTable) {
    let targetLine = row.lineNumber + dir
    while (
      targetLine >= state.doc.lineAt(range.from).number &&
      targetLine <= state.doc.lineAt(range.to).number &&
      splitTableLine(state.doc.line(targetLine).text).every(isSeparatorCell)
    ) {
      targetLine += dir
    }
    if (
      targetLine >= state.doc.lineAt(range.from).number &&
      targetLine <= state.doc.lineAt(range.to).number
    ) {
      const target = tableRowSpans(state.doc, state.doc.line(targetLine).from)
      if (target) {
        const column = dir === 1 ? 0 : target.spans.length - 1
        view.dispatch({
          selection: { anchor: target.spans[column].contentStart },
          userEvent: 'select'
        })
        return true
      }
    }
  }
  if (dir === 1) return insertTableRow(view, 0)
  return true
}

export function continueTable(view: EditorView): boolean {
  const { state } = view
  const head = state.selection.main.head
  if (insideMarkdownFence(state, head)) return false
  const row = tableRowSpans(state.doc, head)
  if (!row) return false
  const isEmptyRow = row.spans.every(
    (span) => state.doc.sliceString(span.contentStart, span.contentEnd) === ''
  )
  if (isEmptyRow) {
    const to = row.line.to < state.doc.length ? row.line.to + 1 : row.line.to
    view.dispatch({
      changes: { from: row.line.from, to, insert: '' },
      selection: { anchor: row.line.from },
      userEvent: 'input'
    })
    view.focus()
    return true
  }
  return insertTableRow(view, caretCellIndex(row, head))
}

export function insertTableRowBelow(view: EditorView): boolean {
  const { state } = view
  const head = state.selection.main.head
  const row = tableRowSpans(state.doc, head)
  if (!row) return false
  return insertTableRow(view, caretCellIndex(row, head))
}

export function moveTableRow(view: EditorView, dir: -1 | 1): boolean {
  const { state } = view
  const head = state.selection.main.head
  if (insideMarkdownFence(state, head)) return false
  const row = tableRowSpans(state.doc, head)
  if (!row) return false
  const range = findMarkdownTableRange(state.doc, head)
  if (!range) return false
  const lines = state.doc.sliceString(range.from, range.to).split('\n')
  const rowIndex = row.lineNumber - state.doc.lineAt(range.from).number
  const targetIndex = rowIndex + dir
  if (targetIndex < 0 || targetIndex >= lines.length) return false
  const isSeparator = (index: number): boolean =>
    splitTableLine(lines[index]).every(isSeparatorCell)
  if (isSeparator(rowIndex) || isSeparator(targetIndex)) return false
  const column = caretCellIndex(row, head)
  ;[lines[rowIndex], lines[targetIndex]] = [lines[targetIndex], lines[rowIndex]]
  const aligned = alignMarkdownTable(lines.join('\n')) ?? lines.join('\n')
  const alignedLines = aligned.split('\n')
  const lineStart = alignedLines.slice(0, targetIndex).join('\n').length
  const movedLine = alignedLines[targetIndex]
  const caret =
    range.from +
    lineStart +
    cellContentStart(movedLine, Math.min(column, splitTableLine(movedLine).length - 1))
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: aligned },
    selection: { anchor: caret },
    userEvent: 'input'
  })
  view.focus()
  return true
}

export function convertTablePaste(text: string): string | null {
  const normalized = text.replace(/\r\n/g, '\n').trimEnd()
  if (!normalized) return null
  let rows: string[][]
  if (normalized.includes('\t')) {
    rows = normalized.split('\n').map((line) => line.split('\t').map((cell) => cell.trim()))
  } else if (normalized.includes('\n')) {
    rows = normalized.split('\n').map((line) => line.split(',').map((cell) => cell.trim()))
    const count = rows[0].length
    if (count < 2 || rows.some((row) => row.length !== count)) return null
  } else {
    return null
  }
  const markdown = rows.map((row) => `| ${row.join(' | ')} |`).join('\n')
  return alignMarkdownTable(markdown) ?? markdown
}
