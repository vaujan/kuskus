'use strict'

const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true
    },
    fileName: filename
  })
  module._compile(output.outputText, filename)
}

const {
  parseTableLines,
  parseMarkdownTable,
  serializeTable,
  splitRowCells,
  insertTableColumn,
  deleteTableColumn,
  deleteTableColumns,
  insertTableRow,
  deleteTableRow,
  deleteTableRows,
  moveTableRow,
  moveTableVisualRow,
  duplicateTableRow,
  moveTableColumn,
  duplicateTableColumn,
  setTableAlign,
  sortTableRows,
  tableToTsv,
  tableToCsv,
  normalizeTableSelection,
  tableSelectionToTsv,
  clearTableSelection,
  formatTableSelection,
  parseTableClipboard,
  pasteTableSelection,
  emptyTableModel
} = require('../src/renderer/src/features/items/markdown-table-model.ts')

test('splits a row on unescaped pipes and strips outer pipes', () => {
  assert.deepEqual(splitRowCells('| A | B |'), ['A', 'B'])
  assert.deepEqual(splitRowCells('A | B'), ['A', 'B'])
  assert.deepEqual(splitRowCells('| a\\|b | c |'), ['a\\|b', 'c'])
  assert.deepEqual(splitRowCells('|  |  |'), ['', ''])
})

test('parses alignment from the delimiter row', () => {
  const model = parseTableLines(['| A | B | C |', '| :--- | :---: | ---: |', '| 1 | 2 | 3 |'])
  assert.deepEqual(model.aligns, ['left', 'center', 'right'])
  assert.deepEqual(model.header, ['A', 'B', 'C'])
  assert.deepEqual(model.rows, [['1', '2', '3']])
})

test('defaults alignment to null when the delimiter row has no colons', () => {
  const model = parseTableLines(['| A | B |', '| --- | --- |', '| 1 | 2 |'])
  assert.deepEqual(model.aligns, [null, null])
})

test('handles a table without a delimiter row (body starts at row 1)', () => {
  const model = parseTableLines(['| A | B |', '| 1 | 2 |'])
  assert.deepEqual(model.header, ['A', 'B'])
  assert.deepEqual(model.rows, [['1', '2']])
  assert.deepEqual(model.aligns, [null, null])
})

test('serializeTable preserves alignment and escapes pipes', () => {
  const model = {
    header: ['A', 'B'],
    rows: [['a|b', '2']],
    aligns: ['left', 'right']
  }
  const out = serializeTable(model)
  assert.equal(out, '| A | B |\n| :--- | ---: |\n| a\\|b | 2 |')
})

test('serializeTable round-trips through parseMarkdownTable', () => {
  const md = '| Name | Score |\n| :--- | ---: |\n| Ada | 42 |\n| Bob | 7 |'
  const model = parseMarkdownTable(md)
  assert.ok(model)
  assert.deepEqual(model.aligns, ['left', 'right'])
  assert.equal(serializeTable(model).split('\n').length, 4)
})

test('insert/delete column keeps alignment in sync', () => {
  let model = {
    header: ['A', 'B'],
    rows: [['1', '2']],
    aligns: ['left', 'right']
  }
  model = insertTableColumn(model, 1)
  assert.deepEqual(model.header, ['A', '', 'B'])
  assert.deepEqual(model.aligns, ['left', null, 'right'])
  assert.deepEqual(model.rows, [['1', '', '2']])
  model = deleteTableColumn(model, 1)
  assert.deepEqual(model.header, ['A', 'B'])
  assert.deepEqual(model.aligns, ['left', 'right'])
})

test('deletes contiguous row and column selections', () => {
  const model = {
    header: ['A', 'B', 'C', 'D'],
    rows: [
      ['1', '2', '3', '4'],
      ['5', '6', '7', '8'],
      ['9', '10', '11', '12']
    ],
    aligns: ['left', 'center', 'right', null]
  }
  assert.deepEqual(deleteTableColumns(model, 1, 2), {
    header: ['A', 'D'],
    rows: [
      ['1', '4'],
      ['5', '8'],
      ['9', '12']
    ],
    aligns: ['left', null]
  })
  assert.deepEqual(deleteTableRows(model, 0, 2).rows, [['9', '10', '11', '12']])
  assert.deepEqual(deleteTableColumns(model, 0, 4), model)
  assert.deepEqual(model.header, ['A', 'B', 'C', 'D'])
})

test('insert/delete row and move row operate on copies', () => {
  let model = emptyTableModel(2)
  model.rows = [
    ['1', '2'],
    ['3', '4'],
    ['5', '6']
  ]
  const withRow = insertTableRow(model, 1)
  assert.equal(withRow.rows.length, 4)
  assert.deepEqual(withRow.rows[1], ['', ''])
  assert.equal(model.rows.length, 3) // original untouched

  const moved = moveTableRow(model, 0, 2)
  assert.deepEqual(moved.rows[0], ['3', '4'])
  assert.deepEqual(moved.rows[2], ['1', '2'])

  const deleted = deleteTableRow(moved, 1)
  assert.equal(deleted.rows.length, 2)
})

test('visual row moves can promote a body row to header or demote the header', () => {
  const model = {
    header: ['Name', 'Count'],
    rows: [
      ['Alpha', '1'],
      ['Beta', '2']
    ],
    aligns: ['left', 'right']
  }
  assert.deepEqual(moveTableVisualRow(model, 0, 2), {
    header: ['Alpha', '1'],
    rows: [
      ['Beta', '2'],
      ['Name', 'Count']
    ],
    aligns: ['left', 'right']
  })
  assert.deepEqual(moveTableVisualRow(model, 2, 0), {
    header: ['Beta', '2'],
    rows: [
      ['Name', 'Count'],
      ['Alpha', '1']
    ],
    aligns: ['left', 'right']
  })
  assert.deepEqual(moveTableVisualRow(model, 1, 2).rows, [
    ['Beta', '2'],
    ['Alpha', '1']
  ])
  assert.equal(moveTableVisualRow(model, -1, 1), model)
  assert.deepEqual(model.header, ['Name', 'Count'])
  assert.deepEqual(model.rows[0], ['Alpha', '1'])
})

test('setTableAlign updates a single column', () => {
  const model = {
    header: ['A', 'B'],
    rows: [['1', '2']],
    aligns: [null, null]
  }
  const next = setTableAlign(model, 1, 'center')
  assert.deepEqual(next.aligns, [null, 'center'])
  assert.deepEqual(model.aligns, [null, null])
})

test('sortTableRows sorts numerically and textually, asc and desc', () => {
  const model = {
    header: ['N'],
    rows: [['10'], ['2'], ['1']],
    aligns: [null]
  }
  const asc = sortTableRows(model, 0, 'asc')
  assert.deepEqual(asc.rows, [['1'], ['2'], ['10']])
  const desc = sortTableRows(model, 0, 'desc')
  assert.deepEqual(desc.rows, [['10'], ['2'], ['1']])
})

test('tableToTsv and tableToCsv quote cells with delimiters', () => {
  const model = {
    header: ['A', 'B'],
    rows: [
      ['x,y', 'tab\there'],
      ['plain', '2']
    ],
    aligns: [null, null]
  }
  // TSV: only tabs/newlines need quoting (commas are literal).
  const tsv = tableToTsv(model)
  assert.ok(tsv.includes('x,y'))
  assert.ok(tsv.includes('"tab\there"'))
  assert.equal(tsv.split('\n')[1], 'x,y\t"tab\there"')
  // CSV: commas and quotes need quoting.
  const csv = tableToCsv(model)
  assert.ok(csv.includes('"x,y"'))
  assert.ok(csv.includes('"tab\there"'))
  assert.equal(csv.split('\n')[1], '"x,y","tab\there"')
})

test('normalizes a reverse multi-cell selection', () => {
  const model = { header: ['A', 'B', 'C'], rows: [['1', '2', '3']], aligns: [null, null, null] }
  assert.deepEqual(
    normalizeTableSelection(model, {
      anchor: { row: 1, column: 2 },
      head: { row: 0, column: 1 }
    }),
    { top: 0, bottom: 1, left: 1, right: 2 }
  )
})

test('copies and clears a rectangular cell selection', () => {
  const model = {
    header: ['A', 'B', 'C'],
    rows: [
      ['1', '2', '3'],
      ['4', '5', '6']
    ],
    aligns: [null, null, null]
  }
  const selection = { anchor: { row: 0, column: 1 }, head: { row: 1, column: 2 } }
  assert.equal(tableSelectionToTsv(model, selection), 'B\tC\n2\t3')
  assert.deepEqual(clearTableSelection(model, selection), {
    header: ['A', '', ''],
    rows: [
      ['1', '', ''],
      ['4', '5', '6']
    ],
    aligns: [null, null, null]
  })
})

test('parses spreadsheet clipboard quoting and pastes a matrix', () => {
  assert.deepEqual(parseTableClipboard('A\t"B\nline"\n"C""D"\tE'), [
    ['A', 'B\nline'],
    ['C"D', 'E']
  ])
  const model = { header: ['H'], rows: [['']], aligns: [null] }
  const pasted = pasteTableSelection(
    model,
    { anchor: { row: 1, column: 0 }, head: { row: 1, column: 0 } },
    [
      ['a', 'b'],
      ['c', 'd']
    ]
  )
  assert.deepEqual(pasted.header, ['H', ''])
  assert.deepEqual(pasted.rows, [
    ['a', 'b'],
    ['c', 'd']
  ])
})

test('one clipboard cell fills the selected range', () => {
  const model = {
    header: ['A', 'B'],
    rows: [
      ['1', '2'],
      ['3', '4']
    ],
    aligns: [null, null]
  }
  const pasted = pasteTableSelection(
    model,
    { anchor: { row: 1, column: 0 }, head: { row: 2, column: 1 } },
    [['x']]
  )
  assert.deepEqual(pasted.rows, [
    ['x', 'x'],
    ['x', 'x']
  ])
})

test('formats every non-empty cell in a selection and toggles existing marks', () => {
  const model = {
    header: ['A', '**B**'],
    rows: [['1', '']],
    aligns: [null, null]
  }
  const selection = { anchor: { row: 0, column: 0 }, head: { row: 1, column: 1 } }
  const formatted = formatTableSelection(model, selection, 'bold')
  assert.deepEqual(formatted.header, ['**A**', 'B'])
  assert.deepEqual(formatted.rows, [['**1**', '']])
})

test('duplicates and reorders rows and columns without mutating the source', () => {
  const model = {
    header: ['A', 'B', 'C'],
    rows: [
      ['1', '2', '3'],
      ['4', '5', '6']
    ],
    aligns: ['left', 'center', 'right']
  }
  assert.deepEqual(duplicateTableRow(model, 0).rows, [
    ['1', '2', '3'],
    ['1', '2', '3'],
    ['4', '5', '6']
  ])
  assert.deepEqual(moveTableColumn(model, 0, 2), {
    header: ['B', 'C', 'A'],
    rows: [
      ['2', '3', '1'],
      ['5', '6', '4']
    ],
    aligns: ['center', 'right', 'left']
  })
  assert.deepEqual(duplicateTableColumn(model, 1), {
    header: ['A', 'B', 'B', 'C'],
    rows: [
      ['1', '2', '2', '3'],
      ['4', '5', '5', '6']
    ],
    aligns: ['left', 'center', 'center', 'right']
  })
  assert.deepEqual(model.header, ['A', 'B', 'C'])
})
