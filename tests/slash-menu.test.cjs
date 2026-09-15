const assert = require('node:assert/strict')
const test = require('node:test')

const {
  canStartSlashQuery,
  fitSlashMenuPosition,
  findSlashQuery,
  slashCommands
} = require('../src/renderer/src/features/items/live/slash-menu.ts')

test('opens slash commands only for the active word and keeps the former command set', () => {
  assert.equal(findSlashQuery('/head'), 'head')
  assert.equal(findSlashQuery('Start /tab'), 'tab')
  assert.equal(findSlashQuery('https://example.com/'), null)
  assert.equal(canStartSlashQuery(''), true)
  assert.equal(canStartSlashQuery('Start '), true)
  assert.equal(canStartSlashQuery('https://example.com'), false)
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

test('positions the slash menu inside its editor surface', () => {
  assert.deepEqual(
    fitSlashMenuPosition(
      { left: 900, bottom: 740 },
      { left: 200, top: 100, width: 824, height: 668 },
      { width: 288, height: 320 }
    ),
    { left: 528, top: 340 }
  )
})
