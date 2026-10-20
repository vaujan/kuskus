const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const {
  deriveImageTitle,
  detectImage,
  safeSourceFilename
} = require('../src/main/library/items/image-item.ts')
const { deriveNoteTitle } = require('../src/main/library/items/note-item.ts')
const {
  createUrlMetadata,
  extractUrlMetadata,
  isYouTubeVideoUrl,
  validateWebUrl
} = require('../src/main/library/items/url-item.ts')
const { isPublicIpAddress, readHtmlHead } = require('../src/main/library/url-network.ts')
const { validateUrlPreview } = require('../src/main/library/url-preview.ts')
const { isPersistedItem } = require('../src/main/library/schemas.ts')
const {
  createInternetShortcut,
  parseInternetShortcut
} = require('../src/main/library/internet-shortcut.ts')

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL88wAAAABJRU5ErkJggg==',
  'base64'
)
const lossyWebpHeader = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x16, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  0x0a, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x9d, 0x01, 0x2a, 0x40, 0x01, 0xf0, 0x00
])

test('extracts rich metadata from a bounded HTML head and classifies video links', async () => {
  const html = `${'<html><head>'}
    <meta content="Example &amp; Demo" property="og:title">
    <meta name="description" content="A useful page">
    <meta content="/preview.png" property="og:image">
    <meta content="Example Studio" property="og:site_name">
    <meta content="video.other" property="og:type">
    <link href="/favicon.ico" rel="shortcut icon">
    </head><body>${'x'.repeat(1_200_000)}</body></html>`
  const head = await readHtmlHead(
    new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  )
  assert.equal(head.includes('<body>'), false)
  const metadata = extractUrlMetadata(head, new URL('https://example.com/watch'))
  assert.equal(metadata.title, 'Example & Demo')
  assert.equal(metadata.description, 'A useful page')
  assert.equal(metadata.previewImageUrl, 'https://example.com/preview.png')
  assert.equal(metadata.faviconUrl, 'https://example.com/favicon.ico')
  assert.equal(metadata.siteName, 'Example Studio')
  assert.equal(metadata.contentKind, 'video')
  assert.equal(metadata.metadataVersion, 2)
  assert.equal(isYouTubeVideoUrl(new URL('https://youtu.be/M7lc1UVf-VE')), true)
  assert.equal(isYouTubeVideoUrl(new URL('https://www.youtube.com/shorts/M7lc1UVf-VE')), true)
  assert.equal(isYouTubeVideoUrl(new URL('https://www.youtube.com/')), false)
})

test('rejects private preview destinations and validates cached raster bytes', () => {
  for (const address of [
    '0.0.0.0',
    '10.0.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.168.0.1',
    '::',
    '::1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1'
  ]) {
    assert.equal(isPublicIpAddress(address), false, address)
  }
  assert.equal(isPublicIpAddress('93.184.216.34'), true)
  assert.equal(isPublicIpAddress('2606:4700:4700::1111'), true)
  assert.deepEqual(validateUrlPreview(onePixelPng, 'image/png', 'preview'), {
    mediaType: 'image/png',
    extension: 'png'
  })
  assert.throws(() => validateUrlPreview(onePixelPng, 'image/jpeg', 'preview'), /does not match/i)
})

test('rejects non-web URLs and validates URL metadata shape', () => {
  assert.throws(() => validateWebUrl('file:///C:/secret.txt'), /http or https/i)
  assert.throws(() => validateWebUrl('not a url'))
  const metadata = createUrlMetadata(
    '00000000-0000-4000-8000-000000000001',
    'https://example.com',
    '2026-07-15T00:00:00.000Z'
  )
  assert.equal(isPersistedItem(metadata, metadata.id), true)
})

test('derives stable note and image display metadata', () => {
  assert.equal(deriveNoteTitle('# First reference\n\nBody'), 'First reference')
  assert.equal(deriveNoteTitle('***'), 'Untitled note')
  assert.equal(safeSourceFilename('folder\\screen:one.png'), 'folder_screen_one.png')
  assert.equal(deriveImageTitle('Screenshot.png'), 'Screenshot')
  assert.equal(detectImage(onePixelPng).mediaType, 'image/png')
  assert.deepEqual(
    { width: detectImage(onePixelPng).width, height: detectImage(onePixelPng).height },
    { width: 1, height: 1 }
  )
  assert.deepEqual(detectImage(lossyWebpHeader), {
    mediaType: 'image/webp',
    width: 320,
    height: 240
  })
})

test('derives note titles from readable Markdown instead of image syntax', () => {
  assert.equal(
    deriveNoteTitle(
      '**![](./dialog-problem.png)**\n\nDialog content is too cramped and looks very vibecoded.'
    ),
    'Dialog content is too cramped and looks very vibecoded.'
  )
  assert.equal(deriveNoteTitle('Before ![Screenshot](./dialog-problem.png) after'), 'Before after')
  assert.equal(deriveNoteTitle('![](./dialog%20problem.png)'), 'dialog problem')
  assert.equal(deriveNoteTitle('![[Screens/dialog-problem.png|Screenshot]]'), 'dialog-problem')
  assert.equal(
    deriveNoteTitle(
      '---\ntags: [design]\n---\n<!-- captured reference -->\n> - [x] **Readable** [reference](https://example.com)'
    ),
    'Readable reference'
  )
  assert.equal(deriveNoteTitle('```ts\nconst answer = 42\n```'), 'const answer = 42')
  assert.equal(deriveNoteTitle('| --- | --- |\n\nActual title'), 'Actual title')
  assert.equal(deriveNoteTitle('![Screenshot](data:image/png;base64,abc)'), 'Untitled note')
  assert.equal(deriveNoteTitle('![]('), 'Untitled note')
  assert.equal(deriveNoteTitle(`# ${'x'.repeat(140)}`), 'x'.repeat(120))
})

test('parses Windows Internet Shortcuts case-insensitively and rejects unsafe URLs', () => {
  assert.equal(
    parseInternetShortcut('[internetshortcut]\nurl = https://example.com/path\n'),
    'https://example.com/path'
  )
  assert.equal(
    createInternetShortcut('https://example.com/'),
    '[InternetShortcut]\r\nURL=https://example.com/\r\n'
  )
  assert.throws(() => parseInternetShortcut('[InternetShortcut]\nURL=file:///C:/secret.txt'))
})
