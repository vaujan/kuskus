/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports */

const { mkdir, rm, writeFile } = require('node:fs/promises')
const { existsSync } = require('node:fs')
const { resolve, join } = require('node:path')
const { deflateSync } = require('node:zlib')

const DEFAULT_DEMO_ROOT = resolve(process.cwd(), '.demo')
const LIBRARY_NAME = 'Kuskus Demo Library'

const ids = {
  library: '10000000-0000-4000-8000-000000000001',
  product: '20000000-0000-4000-8000-000000000001',
  inspiration: '20000000-0000-4000-8000-000000000002',
  research: '20000000-0000-4000-8000-000000000003',
  archive: '20000000-0000-4000-8000-000000000004'
}

function timestamp(daysAgo, hour = 9) {
  const date = new Date('2026-07-17T00:00:00.000Z')
  date.setUTCDate(date.getUTCDate() - daysAgo)
  date.setUTCHours(hour)
  return date.toISOString()
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const name = Buffer.from(type)
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  name.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length)
  return chunk
}

function createPng(width, height, colors) {
  const rows = []
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3)
    const color = colors[Math.min(colors.length - 1, Math.floor((y / height) * colors.length))]
    for (let x = 0; x < width; x += 1) {
      const shade = Math.round((x / Math.max(1, width - 1)) * 18)
      row[1 + x * 3] = Math.min(255, color[0] + shade)
      row[2 + x * 3] = Math.min(255, color[1] + shade)
      row[3 + x * 3] = Math.min(255, color[2] + shade)
    }
    rows.push(row)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

function note(id, title, daysAgo, body, missingContent = false) {
  const createdAt = timestamp(daysAgo)
  return {
    metadata: {
      schemaVersion: 1,
      id,
      type: 'note',
      title,
      createdAt,
      updatedAt: createdAt,
      sourceUrl: null,
      sourceFilename: null,
      contentFilename: 'note.md',
      note: '',
      originalCollectionId: null
    },
    files: missingContent ? {} : { 'note.md': body }
  }
}

function image(id, title, daysAgo, width, height, colors, missingContent = false) {
  const createdAt = timestamp(daysAgo, 11)
  return {
    metadata: {
      schemaVersion: 1,
      id,
      type: 'image',
      title,
      createdAt,
      updatedAt: createdAt,
      sourceUrl: null,
      sourceFilename: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
      contentFilename: 'image.png',
      mediaType: 'image/png',
      width,
      height,
      note: '',
      originalCollectionId: null
    },
    files: missingContent ? {} : { 'image.png': createPng(width, height, colors) }
  }
}

function url(id, title, daysAgo, sourceUrl, description, status = 'ready') {
  const parsed = new URL(sourceUrl)
  const createdAt = timestamp(daysAgo, 14)
  return {
    metadata: {
      schemaVersion: 1,
      id,
      type: 'url',
      title,
      createdAt,
      updatedAt: createdAt,
      sourceUrl,
      sourceFilename: null,
      contentFilename: null,
      domain: parsed.hostname,
      description,
      faviconUrl: null,
      previewImageUrl: null,
      metadataStatus: status,
      metadataError: status === 'unavailable' ? 'Metadata was unavailable while offline.' : null,
      note: '',
      originalCollectionId: null
    },
    files: {}
  }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function writeItem(parent, item) {
  const directory = join(parent, item.metadata.id)
  await mkdir(directory, { recursive: true })
  await writeJson(join(directory, 'item.json'), item.metadata)
  await Promise.all(
    Object.entries(item.files).map(([filename, contents]) =>
      writeFile(join(directory, filename), contents)
    )
  )
}

function inboxItems() {
  return [
    note(
      '30000000-0000-4000-8000-000000000001',
      'Friday research recap',
      0,
      '# Friday research recap\n\n## What stood out\n\n- Visual references are easiest to scan when cards keep their natural proportions.\n- Capture should remain faster than organization.\n- The local folder is the product boundary.\n\n**Next:** test the populated library in Visual, Grid, and List views.'
    ),
    image('30000000-0000-4000-8000-000000000002', 'Dashboard exploration', 0, 1200, 720, [
      [38, 45, 70],
      [75, 65, 125],
      [27, 118, 126]
    ]),
    url(
      '30000000-0000-4000-8000-000000000003',
      'Electron security checklist',
      1,
      'https://www.electronjs.org/docs/latest/tutorial/security',
      'Security recommendations for context isolation, sandboxing, navigation, and IPC validation.'
    ),
    note(
      '30000000-0000-4000-8000-000000000004',
      'Capture flow observations',
      1,
      '## Capture flow observations\n\nThe composer feels best when content comes first. Metadata can arrive later without moving the card.\n\n> Preserve the original input even when enrichment fails.'
    ),
    image('30000000-0000-4000-8000-000000000005', 'Mobile moodboard', 2, 720, 1080, [
      [111, 48, 86],
      [189, 84, 102],
      [238, 161, 94]
    ]),
    url(
      '30000000-0000-4000-8000-000000000006',
      'Local-first software principles',
      2,
      'https://www.inkandswitch.com/local-first/',
      'A foundational essay about ownership, longevity, privacy, and offline-capable software.'
    ),
    image('30000000-0000-4000-8000-000000000007', 'Brand color study', 3, 1400, 520, [
      [29, 78, 95],
      [42, 132, 116],
      [211, 173, 92]
    ]),
    note(
      '30000000-0000-4000-8000-000000000008',
      'Interview notes: creative researcher',
      4,
      '# Interview notes: creative researcher\n\nThey save screenshots first, then add context at the end of the day. Folder decisions during capture feel expensive.\n\n### Quote to revisit\n\n“Let me keep momentum; I can tidy the library later.”'
    ),
    url(
      '30000000-0000-4000-8000-000000000009',
      'A reference whose metadata failed',
      4,
      'https://example.com/offline-reference',
      null,
      'unavailable'
    ),
    image(
      '30000000-0000-4000-8000-000000000010',
      'Missing source example',
      5,
      900,
      600,
      [[95, 95, 95]],
      true
    ),
    note('30000000-0000-4000-8000-000000000011', 'Missing note content example', 6, '', true),
    note(
      '30000000-0000-4000-8000-000000000012',
      'Markdown formatting sampler',
      7,
      '# Markdown formatting sampler\n\nThis note contains **bold text**, *emphasis*, `inline code`, and a [useful link](https://example.com).\n\n1. Search for “research”\n2. Filter to notes\n3. Open this card\n\n```ts\nconst library = "local-first"\n```'
    )
  ]
}

async function seedDemoEnvironment({ root = DEFAULT_DEMO_ROOT, reset = false } = {}) {
  const demoRoot = resolve(root)
  const libraryPath = join(demoRoot, LIBRARY_NAME)
  const userDataPath = join(demoRoot, 'user-data')
  const libraryFile = join(libraryPath, 'library.json')

  if (reset) await rm(demoRoot, { recursive: true, force: true })
  if (!existsSync(libraryFile)) {
    await Promise.all([
      mkdir(join(libraryPath, 'inbox'), { recursive: true }),
      mkdir(join(libraryPath, 'trash'), { recursive: true }),
      mkdir(join(libraryPath, '.kuskus', 'temp'), { recursive: true }),
      mkdir(userDataPath, { recursive: true })
    ])
    await writeJson(libraryFile, {
      schemaVersion: 1,
      id: ids.library,
      name: LIBRARY_NAME,
      createdAt: timestamp(30)
    })

    const collections = [
      [ids.product, 'Kuskus Product', 'rocket'],
      [ids.inspiration, 'Visual Inspiration', 'palette'],
      [ids.research, 'User Research', 'team'],
      [ids.archive, 'Archive', 'archive']
    ]
    for (const [id, name, icon] of collections) {
      const directory = join(libraryPath, 'collections', id)
      await mkdir(join(directory, 'items'), { recursive: true })
      await writeJson(join(directory, 'collection.json'), {
        schemaVersion: 1,
        id,
        name,
        icon,
        createdAt: timestamp(20)
      })
    }

    await Promise.all(inboxItems().map((item) => writeItem(join(libraryPath, 'inbox'), item)))
    await writeItem(
      join(libraryPath, 'collections', ids.product, 'items'),
      note(
        '40000000-0000-4000-8000-000000000001',
        'Saved product direction',
        8,
        '# Saved product direction\n\nA private visual library for project references, stored on your computer.'
      )
    )
    await writeItem(
      join(libraryPath, 'trash'),
      note(
        '50000000-0000-4000-8000-000000000001',
        'Discarded naming ideas',
        12,
        '# Discarded naming ideas\n\nThis fixture lives in Trash so recovery work has realistic data later.'
      )
    )
  } else {
    await mkdir(userDataPath, { recursive: true })
  }

  await writeJson(join(userDataPath, 'kuskus-settings.json'), {
    schemaVersion: 1,
    lastLibraryPath: libraryPath
  })
  return { demoRoot, libraryPath, userDataPath }
}

if (require.main === module) {
  seedDemoEnvironment({ reset: process.argv.includes('--reset') })
    .then(({ libraryPath }) => console.log(`Demo library ready at ${libraryPath}`))
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
}

module.exports = { DEFAULT_DEMO_ROOT, LIBRARY_NAME, seedDemoEnvironment }
