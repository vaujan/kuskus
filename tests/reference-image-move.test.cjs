const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const {
  countReferencedImageChanges
} = require('../src/renderer/src/features/library/reference-image-move.ts')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function note(id, attachments) {
  return { type: 'note', id, relativePath: '', attachments }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function image(id, relativePath) {
  return { type: 'image', id, relativePath }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function attachment(id) {
  return { id }
}

const noteA = note('note-a', [attachment('img-1'), attachment('img-2')])
const noteB = note('note-b', [attachment('img-2')])
const img1 = image('img-1', 'note-a/img-1.png')
const img2 = image('img-2', 'note-a/img-2.png')

test('counts images that moved with a requested note', () => {
  assert.deepEqual(
    countReferencedImageChanges(
      new Set(['note-a']),
      [noteA, img1, img2],
      [noteA, image('img-1', 'moved/img-1.png'), img2]
    ),
    { movedImages: 1, retainedImages: 1 }
  )
})

test('does not double count an image that was itself requested', () => {
  assert.deepEqual(
    countReferencedImageChanges(
      new Set(['note-a', 'img-1']),
      [noteA, img1, img2],
      [noteA, image('img-1', 'moved/img-1.png')]
    ),
    { movedImages: 1, retainedImages: 0 }
  )
})

test('counts an image referenced by two notes only once', () => {
  assert.deepEqual(
    countReferencedImageChanges(
      new Set(['note-a']),
      [noteA, noteB, img1, img2],
      [noteB, image('img-2', 'note-b/img-2.png'), img1]
    ),
    { movedImages: 1, retainedImages: 1 }
  )
})

test('ignores a requested image that disappears between snapshots', () => {
  assert.deepEqual(
    countReferencedImageChanges(new Set(['note-a']), [noteA, img1, img2], [noteA, img2]),
    { movedImages: 1, retainedImages: 1 }
  )
})

test('returns empty counts when no requested note has attachments', () => {
  assert.deepEqual(
    countReferencedImageChanges(new Set(['note-b']), [noteB, img2], [noteB, image('img-2', 'o/')]),
    { movedImages: 1, retainedImages: 0 }
  )
})
