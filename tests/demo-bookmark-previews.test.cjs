const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')

test('every landing-page sample bookmark has a bundled publisher preview', () => {
  const root = resolve(__dirname, '..')
  const assets = resolve(root, 'src/renderer/src/demo/assets/bookmarks')
  const sources = JSON.parse(readFileSync(resolve(assets, 'sources.json'), 'utf8'))
  for (const fixture of [
    'src/renderer/src/demo/student-library-fixtures.ts',
    'landing-page/src/persona-libraries.ts'
  ]) {
    const source = readFileSync(resolve(root, fixture), 'utf8')
    for (const [, url] of source.matchAll(/url: '(https:[^']+)'/g)) {
      const entry = sources.find((entry) => entry.url === url)
      assert.ok(entry?.preview, `Missing publisher preview for ${url}`)
      assert.equal(new URL(entry.preview.source).protocol, 'https:')
      assert.ok(readFileSync(resolve(assets, entry.preview.file)).length > 0)
    }
  }
})
