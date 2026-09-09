const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { noteCardSnippet } = require('../src/renderer/src/features/items/note-card-snippet.ts')

test('removes a leading Markdown heading that duplicates the note title', () => {
  assert.equal(
    noteCardSnippet('# The Bug\n\nRoot cause and resolution.', 'The Bug'),
    'Root cause and resolution.'
  )
})

test('keeps a leading heading when it does not duplicate the note title', () => {
  const body = '## Root cause\n\nThe diagnosis.'
  assert.equal(noteCardSnippet(body, 'The Bug'), body)
})

test('removes frontmatter before comparing the leading heading', () => {
  assert.equal(
    noteCardSnippet('---\ntitle: The Bug\n---\n# The Bug\n\nThe diagnosis.', 'The Bug'),
    'The diagnosis.'
  )
})

test('returns an empty snippet when the body only repeats its title', () => {
  assert.equal(noteCardSnippet('# The Bug', 'The Bug'), '')
})
