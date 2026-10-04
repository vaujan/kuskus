const assert = require('node:assert/strict')
const test = require('node:test')
const { EditorSelection, EditorState } = require('@codemirror/state')
const { markdown } = require('@codemirror/lang-markdown')

const {
  currentSlashQuery,
  fitSlashMenuPosition,
  findSlashQuery,
  slashCommands
} = require('../src/renderer/src/features/items/live/slash-menu.ts')

test('opens slash commands only at the start of a Markdown line', () => {
  assert.equal(findSlashQuery('/head'), 'head')
  assert.equal(findSlashQuery('  /tab'), 'tab')
  assert.equal(findSlashQuery('Start /tab'), null)
  assert.equal(findSlashQuery('https://example.com/'), null)
  assert.deepEqual(
    slashCommands.map(({ id }) => id),
    [
      'text',
      'heading-1',
      'heading-2',
      'heading-3',
      'bullet-list',
      'numbered-list',
      'quote',
      'code',
      'divider',
      'table'
    ]
  )
})

// JavaScript test helper; TypeScript return annotations are not supported here.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function queryAt(doc, cursor = doc.length) {
  return currentSlashQuery(
    EditorState.create({
      doc,
      selection: EditorSelection.cursor(cursor),
      extensions: [markdown()]
    })
  )
}

test('ignores code blocks and existing content after the cursor', () => {
  assert.deepEqual(queryAt('/head'), { query: 'head', from: 0, to: 5 })
  assert.equal(queryAt('```\n/\n```', 5), null)
  assert.equal(queryAt('    /'), null)
  assert.equal(queryAt('/head existing', 5), null)
})

test('positions the slash menu in the visible viewport', () => {
  assert.deepEqual(
    fitSlashMenuPosition(
      { left: 900, bottom: 740 },
      { width: 1024, height: 768 },
      { width: 288, height: 320 }
    ),
    { left: 728, top: 440 }
  )
})
