const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { EditorState } = require('@codemirror/state')
const { getSearchQuery, SearchQuery, setSearchQuery } = require('@codemirror/search')
const {
  collectMatches,
  liveFindExtensions
} = require('../src/renderer/src/features/items/live/live-find.ts')

test('note find terminates and returns every non-overlapping match', () => {
  const state = EditorState.create({ doc: 'alpha beta alpha alphabet alpha' })

  assert.deepEqual(collectMatches(state, 'alpha', true), [
    { from: 0, to: 5 },
    { from: 11, to: 16 },
    { from: 17, to: 22 },
    { from: 26, to: 31 }
  ])
})

test('note find supports case-insensitive Unicode-normalized matching', () => {
  const state = EditorState.create({ doc: 'Café CAFÉ café' })

  assert.equal(collectMatches(state, 'café', false).length, 3)
  assert.equal(collectMatches(state, 'café', true).length, 1)
})

test('note find treats an empty query as no matches', () => {
  const state = EditorState.create({ doc: 'anything' })

  assert.deepEqual(collectMatches(state, '', false), [])
})

test('Vim search queries remain available to rendered table highlighting', () => {
  const query = new SearchQuery({ search: 'hello', regexp: true })
  query.forVim = true
  const state = EditorState.create({ doc: '| hello |', extensions: [liveFindExtensions()] })
  const updated = state.update({ effects: setSearchQuery.of(query) }).state

  assert.equal(getSearchQuery(updated), query)
  assert.equal(getSearchQuery(updated).forVim, true)
})

test('all note editor modes use the shared find controller', () => {
  const detail = readFileSync(
    require.resolve('../src/renderer/src/features/items/item-detail-dialog.tsx'),
    'utf8'
  )
  const liveEditor = readFileSync(
    require.resolve('../src/renderer/src/features/items/live/live-markdown-editor.tsx'),
    'utf8'
  )
  const sourceEditor = readFileSync(
    require.resolve('../src/renderer/src/features/items/markdown-editor.tsx'),
    'utf8'
  )

  assert.match(detail, /replaceEnabled=\{mode !== 'read'\}/)
  assert.match(detail, /findTarget=\{sourceFindTargetRef\}/)
  assert.doesNotMatch(liveEditor, /searchKeymap|markdownSearchTheme/)
  assert.doesNotMatch(sourceEditor, /searchKeymap|markdownSearchTheme/)
})
