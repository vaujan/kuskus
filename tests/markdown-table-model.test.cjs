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
  insertTableRow,
  deleteTableRow,
  moveTableRow,
  setTableAlign,
  sortTableRows,
  tableToTsv,
  tableToCsv,
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
    rows: [['x,y', 'tab\there'], ['plain', '2']],
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
