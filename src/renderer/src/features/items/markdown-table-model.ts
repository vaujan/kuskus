// Shared GFM table model — the single source of truth for parsing,
// serializing, and mutating Markdown tables across every surface that
// renders or edits them (Live's WYSIWYG widget, Read's preview, and
// source-mode helpers). Keeping parse/serialize here means alignment,
// cell escaping, and column/row structure can never diverge between
// Read, Live, and what hits disk.
//
// Alignment lives in the delimiter row: `:---` left, `:--:` center,
// `--:` right, `---` default. `serializeTable` re-emits colons so
// alignment survives every edit round-trip.

export type TableAlign = 'left' | 'center' | 'right'

export interface TableModel {
  header: string[]
  rows: string[][]
  /** Per-column alignment parsed from the delimiter row (null = default). */
  aligns: (TableAlign | null)[]
}

export interface TableCellPoint {
  /** Visual row: 0 is the header, 1+ are body rows. */
  row: number
  column: number
}

export interface TableSelection {
  anchor: TableCellPoint
  head: TableCellPoint
}

export interface TableSelectionBounds {
  top: number
  bottom: number
  left: number
  right: number
}

function copyTable(model: TableModel): TableModel {
  return {
    header: [...model.header],
    rows: model.rows.map((row) => [...row]),
    aligns: [...model.aligns]
  }
}

export function tableRowCount(model: TableModel): number {
  return model.rows.length + 1
}

export function normalizeTableSelection(
  model: TableModel,
  selection: TableSelection
): TableSelectionBounds {
  const lastRow = Math.max(0, tableRowCount(model) - 1)
  const lastColumn = Math.max(0, model.header.length - 1)
  const anchorRow = Math.min(lastRow, Math.max(0, selection.anchor.row))
  const headRow = Math.min(lastRow, Math.max(0, selection.head.row))
  const anchorColumn = Math.min(lastColumn, Math.max(0, selection.anchor.column))
  const headColumn = Math.min(lastColumn, Math.max(0, selection.head.column))
  return {
    top: Math.min(anchorRow, headRow),
    bottom: Math.max(anchorRow, headRow),
    left: Math.min(anchorColumn, headColumn),
    right: Math.max(anchorColumn, headColumn)
  }
}

function tableCell(model: TableModel, row: number, column: number): string {
  return row === 0 ? (model.header[column] ?? '') : (model.rows[row - 1]?.[column] ?? '')
}

function setTableCell(model: TableModel, row: number, column: number, value: string): void {
  if (row === 0) model.header[column] = value
  else model.rows[row - 1][column] = value
}

export function emptyTableModel(columnCount: number): TableModel {
  const emptyCells = Array.from({ length: columnCount }, () => '')
  return { header: emptyCells, rows: [], aligns: Array(columnCount).fill(null) }
}

// Split a raw table line on unescaped `|`. The optional outer pipes are
// stripped so they don't yield phantom empty leading/trailing cells.
// A backslash escapes the next char (`\|` is a literal pipe in a GFM
// cell) — keep both so the pair round-trips.
export function splitRowCells(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)

  const cells: string[] = []
  let buf = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\' && i + 1 < s.length) {
      buf += ch + s[i + 1]
      i++
      continue
    }
    if (ch === '|') {
      cells.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  cells.push(buf.trim())
  return cells
}

const SEPARATOR = /^:?-{3,}:?$/

export function isSeparatorCell(cell: string): boolean {
  return SEPARATOR.test(cell)
}

export function separatorAlign(cell: string): TableAlign | null {
  if (!isSeparatorCell(cell)) return null
  const left = cell.startsWith(':')
  const right = cell.endsWith(':')
  if (left && right) return 'center'
  if (left) return 'left'
  if (right) return 'right'
  // Plain `---` (no colons) is GFM default alignment — distinct from
  // explicit left, so re-serializing a delimiter row without colons
  // stays colon-free.
  return null
}

// Parse a table's lines (header, delimiter, body) into a model. The
// delimiter row is line 1 (0-indexed) when every cell of it is a
// separator; its colons become the per-column alignment.
export function parseTableLines(lines: string[]): TableModel | null {
  const rows = lines.map((line) => splitRowCells(line))
  if (!rows.length || !rows[0]?.length) return null

  const delimiterIndex = rows[1]?.every(isSeparatorCell) ? 1 : -1
  const header = rows[0]
  const columnCount = header.length
  const aligns: (TableAlign | null)[] = Array.from({ length: columnCount }, (_unused, col) =>
    delimiterIndex >= 0 ? separatorAlign(rows[1][col] ?? '') : null
  )
  const body = delimiterIndex >= 0 ? rows.slice(2) : rows.slice(1)

  return { header, rows: body, aligns }
}

// Escape cell content so it can't break the row's GFM structure: an
// unescaped `|` would split the cell into two columns, and a stray
// newline would terminate the table. A pipe that's already escaped
// (`\|` — e.g. round-tripping content the parser handed us) is left
// alone so serialize is idempotent.
export function escapeCell(text: string): string {
  return text.replace(/\r?\n/g, ' ').replace(/(?<!\\)\|/g, '\\|')
}

export function separatorCell(align: TableAlign | null): string {
  if (align === 'center') return ':---:'
  if (align === 'right') return '---:'
  if (align === 'left') return ':---'
  return '---'
}

export function serializeTable(model: TableModel): string {
  const columnCount = model.header.length
  const lines: string[] = []
  lines.push('| ' + model.header.map(escapeCell).join(' | ') + ' |')
  lines.push('| ' + model.aligns.map(separatorCell).join(' | ') + ' |')
  for (const row of model.rows) {
    const padded: string[] = []
    for (let c = 0; c < columnCount; c++) padded.push(escapeCell(row[c] ?? ''))
    lines.push('| ' + padded.join(' | ') + ' |')
  }
  return lines.join('\n')
}

// ---- structural operations (all mutate a copy and return it) -------

export function insertTableColumn(model: TableModel, index: number): TableModel {
  const next = copyTable(model)
  next.header.splice(index, 0, '')
  next.aligns.splice(index, 0, null)
  for (const row of next.rows) row.splice(index, 0, '')
  return next
}

export function deleteTableColumn(model: TableModel, index: number): TableModel {
  return deleteTableColumns(model, index, 1)
}

export function deleteTableColumns(model: TableModel, index: number, count: number): TableModel {
  const next = copyTable(model)
  const safeCount = Math.min(Math.max(0, count), next.header.length - index)
  if (index < 0 || index >= next.header.length || safeCount === 0) return next
  // A Markdown table needs at least one column to remain parseable.
  if (safeCount >= next.header.length) return next
  next.header.splice(index, safeCount)
  next.aligns.splice(index, safeCount)
  for (const row of next.rows) row.splice(index, safeCount)
  return next
}

export function insertTableRow(model: TableModel, index: number): TableModel {
  const next = copyTable(model)
  next.rows.splice(
    index,
    0,
    model.header.map(() => '')
  )
  return next
}

export function deleteTableRow(model: TableModel, index: number): TableModel {
  return deleteTableRows(model, index, 1)
}

export function deleteTableRows(model: TableModel, index: number, count: number): TableModel {
  if (index < 0 || index >= model.rows.length || count <= 0) return model
  const next = copyTable(model)
  next.rows.splice(index, count)
  return next
}

export function moveTableRow(model: TableModel, from: number, to: number): TableModel {
  if (from < 0 || from >= model.rows.length || to < 0 || to >= model.rows.length || from === to) {
    return model
  }
  const next = copyTable(model)
  const [moved] = next.rows.splice(from, 1)
  next.rows.splice(to, 0, moved)
  return next
}

export function duplicateTableRow(model: TableModel, index: number): TableModel {
  if (index < 0 || index >= model.rows.length) return model
  const next = copyTable(model)
  next.rows.splice(index + 1, 0, [...next.rows[index]])
  return next
}

export function moveTableColumn(model: TableModel, from: number, to: number): TableModel {
  if (
    from < 0 ||
    from >= model.header.length ||
    to < 0 ||
    to >= model.header.length ||
    from === to
  ) {
    return model
  }
  const next = copyTable(model)
  const move = <T>(values: T[]): void => {
    const [value] = values.splice(from, 1)
    values.splice(to, 0, value)
  }
  move(next.header)
  move(next.aligns)
  for (const row of next.rows) move(row)
  return next
}

export function duplicateTableColumn(model: TableModel, index: number): TableModel {
  if (index < 0 || index >= model.header.length) return model
  const next = copyTable(model)
  next.header.splice(index + 1, 0, next.header[index])
  next.aligns.splice(index + 1, 0, next.aligns[index])
  for (const row of next.rows) row.splice(index + 1, 0, row[index] ?? '')
  return next
}

export function setTableAlign(
  model: TableModel,
  column: number,
  align: TableAlign | null
): TableModel {
  if (column < 0 || column >= model.header.length) return model
  const next = copyTable(model)
  next.aligns[column] = align
  return next
}

export function sortTableRows(
  model: TableModel,
  column: number,
  direction: 'asc' | 'desc'
): TableModel {
  if (column < 0 || column >= model.header.length) return model
  const rows = model.rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const av = a.row[column] ?? ''
      const bv = b.row[column] ?? ''
      const numA = Number(av.replace(/,/g, ''))
      const numB = Number(bv.replace(/,/g, ''))
      let cmp: number
      if (av !== '' && bv !== '' && !Number.isNaN(numA) && !Number.isNaN(numB)) {
        cmp = numA - numB
      } else {
        cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' })
      }
      return direction === 'asc' ? cmp : -cmp
    })
    .map((entry) => entry.row)
  return { header: [...model.header], rows, aligns: [...model.aligns] }
}

// ---- clipboard helpers ---------------------------------------------

export function tableToTsv(model: TableModel): string {
  const quote = (cell: string): string =>
    cell.includes('\t') || cell.includes('\n') ? `"${cell.replace(/"/g, '""')}"` : cell
  const rows = [model.header, ...model.rows]
  return rows.map((row) => row.map(quote).join('\t')).join('\n')
}

export function tableToCsv(model: TableModel): string {
  const quote = (cell: string): string =>
    cell.includes(',') || cell.includes('"') || cell.includes('\n') || cell.includes('\t')
      ? `"${cell.replace(/"/g, '""')}"`
      : cell
  const rows = [model.header, ...model.rows]
  return rows.map((row) => row.map(quote).join(',')).join('\n')
}

export function tableSelectionToTsv(model: TableModel, selection: TableSelection): string {
  const bounds = normalizeTableSelection(model, selection)
  const quote = (cell: string): string =>
    /[\t\r\n"]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
  const lines: string[] = []
  for (let row = bounds.top; row <= bounds.bottom; row++) {
    const cells: string[] = []
    for (let column = bounds.left; column <= bounds.right; column++) {
      cells.push(quote(tableCell(model, row, column)))
    }
    lines.push(cells.join('\t'))
  }
  return lines.join('\n')
}

export function clearTableSelection(model: TableModel, selection: TableSelection): TableModel {
  const next = copyTable(model)
  const bounds = normalizeTableSelection(next, selection)
  for (let row = bounds.top; row <= bounds.bottom; row++) {
    for (let column = bounds.left; column <= bounds.right; column++) {
      setTableCell(next, row, column, '')
    }
  }
  return next
}

export function formatTableSelection(
  model: TableModel,
  selection: TableSelection,
  format: 'bold' | 'italic' | 'strikethrough'
): TableModel {
  const next = copyTable(model)
  const bounds = normalizeTableSelection(next, selection)
  const delimiter = format === 'bold' ? '**' : format === 'italic' ? '_' : '~~'
  for (let row = bounds.top; row <= bounds.bottom; row++) {
    for (let column = bounds.left; column <= bounds.right; column++) {
      const value = tableCell(next, row, column)
      if (!value) continue
      const formatted =
        value.startsWith(delimiter) && value.endsWith(delimiter)
          ? value.slice(delimiter.length, -delimiter.length)
          : `${delimiter}${value}${delimiter}`
      setTableCell(next, row, column, formatted)
    }
  }
  return next
}

/** Parse spreadsheet clipboard text. Tabs win; otherwise CSV commas are supported. */
export function parseTableClipboard(text: string): string[][] {
  const source = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const delimiter = source.includes('\t') ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < source.length; index++) {
    const character = source[index]
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"'
        index++
      } else {
        quoted = !quoted
      }
    } else if (!quoted && character === delimiter) {
      row.push(cell)
      cell = ''
    } else if (!quoted && character === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }
  row.push(cell)
  rows.push(row)
  if (rows.length > 1 && rows.at(-1)?.length === 1 && rows.at(-1)?.[0] === '') rows.pop()
  return rows.length ? rows : [['']]
}

export function pasteTableSelection(
  model: TableModel,
  selection: TableSelection,
  clipboard: string[][]
): TableModel {
  if (!clipboard.length || !clipboard.some((row) => row.length)) return model
  const next = copyTable(model)
  const bounds = normalizeTableSelection(next, selection)
  const fillSelection = clipboard.length === 1 && clipboard[0].length === 1
  const requiredRows = fillSelection ? bounds.bottom + 1 : bounds.top + clipboard.length
  const requiredColumns = fillSelection
    ? bounds.right + 1
    : bounds.left + Math.max(...clipboard.map((row) => row.length))

  while (next.header.length < requiredColumns) {
    next.header.push('')
    next.aligns.push(null)
    for (const row of next.rows) row.push('')
  }
  while (tableRowCount(next) < requiredRows) {
    next.rows.push(next.header.map(() => ''))
  }

  if (fillSelection) {
    for (let row = bounds.top; row <= bounds.bottom; row++) {
      for (let column = bounds.left; column <= bounds.right; column++) {
        setTableCell(next, row, column, clipboard[0][0])
      }
    }
    return next
  }

  for (let row = 0; row < clipboard.length; row++) {
    for (let column = 0; column < clipboard[row].length; column++) {
      setTableCell(next, bounds.top + row, bounds.left + column, clipboard[row][column])
    }
  }
  return next
}

// Parse a markdown table string (multi-line) into a model, preserving
// alignment. Returns null when the input isn't a valid GFM table.
export function parseMarkdownTable(markdown: string): TableModel | null {
  return parseTableLines(markdown.replace(/\r\n/g, '\n').trim().split('\n'))
}
