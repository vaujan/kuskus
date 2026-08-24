const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { fitThumbnailSize } = require('../src/main/library/image-thumbnail.ts')

test('bounds card thumbnails without enlarging small images', () => {
  assert.deepEqual(fitThumbnailSize(2680, 3400), { width: 404, height: 512 })
  assert.deepEqual(fitThumbnailSize(320, 200), { width: 320, height: 200 })
})
