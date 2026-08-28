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
  const next: TableModel = {
    header: [...model.header],
    rows: model.rows.map((row) => [...row]),
    aligns: [...model.aligns]
  }
  next.header.splice(index, 0, '')
  next.aligns.splice(index, 0, null)
  for (const row of next.rows) row.splice(index, 0, '')
  return next
}

export function deleteTableColumn(model: TableModel, index: number): TableModel {
  const next: TableModel = {
    header: [...model.header],
    rows: model.rows.map((row) => [...row]),
    aligns: [...model.aligns]
  }
  if (index < 0 || index >= next.header.length) return next
  next.header.splice(index, 1)
  next.aligns.splice(index, 1)
  for (const row of next.rows) row.splice(index, 1)
  return next
}

export function insertTableRow(model: TableModel, index: number): TableModel {
  const next: TableModel = {
    header: [...model.header],
    rows: model.rows.map((row) => [...row]),
    aligns: [...model.aligns]
  }
  next.rows.splice(
    index,
    0,
    model.header.map(() => '')
  )
  return next
}

export function deleteTableRow(model: TableModel, index: number): TableModel {
  if (index < 0 || index >= model.rows.length) return model
  const next: TableModel = {
    header: [...model.header],
    rows: model.rows.map((row) => [...row]),
    aligns: [...model.aligns]
  }
  next.rows.splice(index, 1)
  return next
}

export function moveTableRow(model: TableModel, from: number, to: number): TableModel {
  if (from < 0 || from >= model.rows.length || to < 0 || to >= model.rows.length || from === to) {
    return model
  }
  const next: TableModel = {
    header: [...model.header],
    rows: model.rows.map((row) => [...row]),
    aligns: [...model.aligns]
  }
  const [moved] = next.rows.splice(from, 1)
  next.rows.splice(to, 0, moved)
  return next
}

export function setTableAlign(
  model: TableModel,
  column: number,
  align: TableAlign | null
): TableModel {
  if (column < 0 || column >= model.header.length) return model
  const next: TableModel = {
    header: [...model.header],
    rows: model.rows.map((row) => [...row]),
    aligns: [...model.aligns]
  }
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

// Parse a markdown table string (multi-line) into a model, preserving
// alignment. Returns null when the input isn't a valid GFM table.
export function parseMarkdownTable(markdown: string): TableModel | null {
  return parseTableLines(markdown.replace(/\r\n/g, '\n').trim().split('\n'))
}
