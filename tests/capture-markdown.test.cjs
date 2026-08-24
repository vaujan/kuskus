const assert = require('node:assert/strict')
const { join } = require('node:path')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const {
  composeMarkdownCapture,
  detectCaptureKind,
  extractWebUrl,
  isSingleWebUrl
} = require('../src/renderer/src/features/capture/capture-detection.ts')
const {
  normalizeStagedAttachmentMarkdown,
  parseMarkdownImageReferences,
  removeStagedAttachmentMarkdown
} = require('../src/shared/markdown-image-references.ts')
const {
  markdownPathForAttachment,
  resolveAttachmentPlacement
} = require('../src/main/library/attachment-placement.ts')

test('detects explicit capture kinds without treating mixed content as a link or image', () => {
  assert.equal(isSingleWebUrl('https://example.com/path'), true)
  assert.equal(isSingleWebUrl('https://example.com'), true)
  assert.equal(isSingleWebUrl('https://www.google.com'), true)
  assert.equal(isSingleWebUrl('https://example.com/path/'), true)
  assert.equal(isSingleWebUrl('<https://example.com>'), true)
  assert.equal(isSingleWebUrl('<https://www.youtube.com/watch?v=Vw8YxOyyXII>'), true)
  assert.equal(isSingleWebUrl('[https://example.com](https://example.com)'), true)
  assert.equal(isSingleWebUrl('Read https://example.com'), false)
  assert.equal(
    isSingleWebUrl('https://www.youtube.com/watch?v=Vw8YxOyyXII\nhttps://www.google.com'),
    false
  )
  assert.equal(isSingleWebUrl('example.com'), false)
  assert.equal(isSingleWebUrl('ftp://example.com'), false)
  assert.equal(extractWebUrl('https://chatgpt.com/'), 'https://chatgpt.com/')
  assert.equal(extractWebUrl('  https://chatgpt.com/  '), 'https://chatgpt.com/')
  assert.equal(extractWebUrl('<https://example.com/path>'), 'https://example.com/path')
  assert.equal(extractWebUrl('[https://example.com](https://example.com)'), 'https://example.com')
  assert.equal(
    extractWebUrl('https\\://scholar.google.com/citations?user=CV-rNfcAAAAJ\\&hl=id'),
    'https://scholar.google.com/citations?user=CV-rNfcAAAAJ&hl=id'
  )
  assert.equal(
    extractWebUrl('[https\\://example.com/path](https\\://example.com/path)'),
    'https://example.com/path'
  )
  assert.equal(extractWebUrl('https://example.com [link](https://other.com)'), null)
  assert.equal(extractWebUrl('[Example](https://example.com)'), null)
  assert.equal(extractWebUrl('ftp://example.com'), null)
  assert.equal(detectCaptureKind('', 0), 'empty')
  assert.equal(detectCaptureKind('', 1), 'image')
  assert.equal(detectCaptureKind('https://example.com/', 0), 'link')
  assert.equal(detectCaptureKind('https://www.google.com', 0), 'link')
  assert.equal(detectCaptureKind('<https://example.com>', 0), 'link')
  assert.equal(detectCaptureKind('A note', 0), 'note')
  assert.equal(detectCaptureKind('Caption', 1), 'note')
  assert.equal(detectCaptureKind('', 2), 'note')
  assert.equal(
    composeMarkdownCapture(['![First](./assets/first.png)'], 'Caption'),
    '![First](./assets/first.png)\n\nCaption'
  )
  assert.equal(
    composeMarkdownCapture(['![First](./assets/first.png)', '![Second](./assets/second.png)']),
    '![First](./assets/first.png)\n\n![Second](./assets/second.png)'
  )
})

test('parses and repairs balanced Markdown image destinations without losing draft text', () => {
  const source = [
    'Before',
    '![Legacy](./Hello world (2).assets/image 100% \\(final\\).png)',
    '![Encoded](<./Shared/image%20%282%29.png>)',
    'After'
  ].join('\n')
  assert.deepEqual(
    parseMarkdownImageReferences(source).map((reference) => reference.destination),
    ['./Hello world (2).assets/image 100% \\(final\\).png', './Shared/image%20%282%29.png']
  )

  const attachment = { filename: 'image (2).png', relativePath: './image%20%282%29.png' }
  const stale = 'Before\n\n![image](./assets/image%20%282%29.png)\n\nAfter'
  assert.equal(
    normalizeStagedAttachmentMarkdown(stale, [attachment]),
    'Before\n\n![image](./image%20%282%29.png)\n\nAfter'
  )
  assert.equal(removeStagedAttachmentMarkdown(stale, attachment), 'Before\n\nAfter')
})

test('resolves same-folder attachment placement without coupling callers to its layout', () => {
  const libraryPath = join('C:', 'Vault')
  const notePath = join(libraryPath, 'Projects', 'Research note.md')
  const placement = resolveAttachmentPlacement({
    libraryPath,
    notePath,
    filename: 'Sketch (final).png'
  })
  assert.equal(placement.directory, join(libraryPath, 'Projects'))
  assert.equal(placement.candidatePath, join(libraryPath, 'Projects', 'Sketch (final).png'))
  assert.equal(
    markdownPathForAttachment(notePath, placement.candidatePath),
    './Sketch%20%28final%29.png'
  )
  assert.throws(
    () =>
      resolveAttachmentPlacement({
        libraryPath,
        notePath: join(libraryPath, '..', 'Outside.md'),
        filename: 'unsafe.png'
      }),
    /outside the library/i
  )
})
