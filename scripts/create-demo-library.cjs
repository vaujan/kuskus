/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports */

const { join, resolve } = require('node:path')
const { existsSync } = require('node:fs')
const { mkdir, readFile, rm, writeFile } = require('node:fs/promises')

const DEFAULT_DEMO_ROOT = resolve(process.cwd(), '.demo')
const LIBRARY_NAME = 'Fauzan\u2019s Library'
const ASSET_ROOT = join(__dirname, 'demo-assets')

const ids = {
  library: '10000000-0000-4000-8000-000000000001',
  kuskus: '20000000-0000-4000-8000-000000000001',
  interfaceReferences: '20000000-0000-4000-8000-000000000002',
  research: '20000000-0000-4000-8000-000000000003',
  writing: '20000000-0000-4000-8000-000000000004'
}

function timestamp(daysAgo, hour = 9, minute = 0) {
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  if (date.getTime() > Date.now()) date.setDate(date.getDate() - 1)
  return date.toISOString()
}

function note(id, title, daysAgo, body, { attachments = [], files = {} } = {}) {
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
      originalCollectionId: null,
      ...(attachments.length > 0 ? { attachments } : {})
    },
    files: { 'note.md': body, ...files }
  }
}

async function loadPng(filename) {
  const bytes = await readFile(join(ASSET_ROOT, filename))
  if (
    bytes.length < 24 ||
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    throw new Error(`Demo asset ${filename} is not a valid PNG.`)
  }
  return { bytes, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

async function image(id, title, daysAgo, assetFilename) {
  const createdAt = timestamp(daysAgo, 11, 20)
  const asset = await loadPng(assetFilename)
  return {
    metadata: {
      schemaVersion: 1,
      id,
      type: 'image',
      title,
      createdAt,
      updatedAt: createdAt,
      sourceUrl: null,
      sourceFilename: assetFilename,
      contentFilename: 'image.png',
      mediaType: 'image/png',
      width: asset.width,
      height: asset.height,
      note: '',
      originalCollectionId: null
    },
    files: { 'image.png': asset.bytes }
  }
}

function url(id, title, daysAgo, sourceUrl, description) {
  const parsed = new URL(sourceUrl)
  const createdAt = timestamp(daysAgo, 14, 10)
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
      metadataStatus: 'ready',
      metadataError: null,
      note: '',
      originalCollectionId: null
    },
    files: {}
  }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function safeFilename(value) {
  return value
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/[. ]+$/g, '')
    .slice(0, 160)
}

async function writeVaultItem(libraryPath, relativeDirectory, item, location = 'active') {
  const title = safeFilename(item.metadata.title)
  const directory =
    location === 'trash'
      ? join(libraryPath, '.kuskus', 'trash', item.metadata.id)
      : join(libraryPath, relativeDirectory)
  await mkdir(directory, { recursive: true })
  let filename
  let metadata = { ...item.metadata, schemaVersion: 2 }
  if (metadata.type === 'note') {
    filename = `${title}.md`
    const body = String(item.files['note.md']).replace(/\.\/assets\//g, './')
    await writeFile(join(directory, filename), body, 'utf8')
    for (const [name, contents] of Object.entries(item.files)) {
      if (!name.startsWith('assets/')) continue
      const attachmentFilename = name.slice('assets/'.length)
      await writeFile(join(directory, attachmentFilename), contents)
      const attachment = (metadata.attachments ?? []).find(
        (candidate) => candidate.filename === attachmentFilename
      )
      if (attachment) {
        const attachmentRelativePath = join(relativeDirectory, attachmentFilename).replace(
          /\\/g,
          '/'
        )
        const attachmentMetadata = {
          schemaVersion: 2,
          id: attachment.id,
          type: 'image',
          title: attachmentFilename.replace(/\.[^.]+$/, ''),
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
          sourceUrl: null,
          sourceFilename: attachment.sourceFilename,
          contentFilename: attachmentFilename,
          mediaType: attachment.mediaType,
          width: attachment.width,
          height: attachment.height,
          note: '',
          originalCollectionId: null,
          relativePath: attachmentRelativePath,
          referencedAttachment: true
        }
        await writeJson(join(libraryPath, '.kuskus', 'records', `${attachment.id}.json`), {
          schemaVersion: 2,
          id: attachment.id,
          relativePath: attachmentRelativePath,
          fingerprint: null,
          metadata: attachmentMetadata
        })
      }
    }
    metadata = {
      ...metadata,
      contentFilename: filename,
      attachments: (metadata.attachments ?? []).map((attachment) => ({
        ...attachment,
        relativePath: `./${attachment.filename}`
      }))
    }
  } else if (metadata.type === 'image') {
    filename = metadata.sourceFilename || `${title}.png`
    await writeFile(join(directory, filename), item.files[metadata.contentFilename])
    metadata = { ...metadata, contentFilename: filename }
  } else {
    filename = `${title}.url`
    await writeFile(
      join(directory, filename),
      `[InternetShortcut]\r\nURL=${metadata.sourceUrl}\r\n`,
      'utf8'
    )
  }
  const relativePath = join(
    location === 'trash' ? join('.kuskus', 'trash', metadata.id) : relativeDirectory,
    filename
  ).replace(/\\/g, '/')
  metadata = {
    ...metadata,
    title,
    relativePath,
    ...(location === 'trash' ? { trashedFrom: 'inbox' } : {})
  }
  await writeJson(join(libraryPath, '.kuskus', 'records', `${metadata.id}.json`), {
    schemaVersion: 2,
    id: metadata.id,
    relativePath,
    fingerprint: null,
    metadata
  })
}

async function inboxItems() {
  const notebook = await loadPng('wireframe-notebook.png')
  const attachmentId = '60000000-0000-4000-8000-000000000001'
  const attachment = {
    id: attachmentId,
    filename: 'wireframe-notebook.png',
    relativePath: './assets/wireframe-notebook.png',
    sourceFilename: 'wireframe-notebook.png',
    mediaType: 'image/png',
    width: notebook.width,
    height: notebook.height
  }

  return [
    note(
      '30000000-0000-4000-8000-000000000001',
      'This week \u2014 close the capture loop',
      0,
      '# This week \u2014 close the capture loop\n\nThe core is finally starting to feel like a place I can leave things, not another inbox I have to maintain.\n\n- Make image paste feel instant\n- Keep the canvas visible while writing\n- Use the app for every reference until Friday\n- Notice what I still reach for Explorer to do\n\n## Detail-view sketch\n\n![Detail-view sketch](./assets/wireframe-notebook.png)\n\nThe inspector should be useful, but the saved thing still needs to own most of the room.',
      {
        attachments: [attachment],
        files: { 'assets/wireframe-notebook.png': notebook.bytes }
      }
    ),
    await image(
      '30000000-0000-4000-8000-000000000002',
      'Library density \u2014 July pass',
      1,
      'library-density-study.png'
    ),
    url(
      '30000000-0000-4000-8000-000000000003',
      'Great animations feel responsive, natural, and purposeful',
      1,
      'https://emilkowal.ski/ui/great-animations',
      'Practical reference for keeping interface motion quick, interruptible, and grounded in the action that caused it.'
    ),
    note(
      '30000000-0000-4000-8000-000000000004',
      'Dogfood notes \u2014 day four',
      2,
      '# Dogfood notes \u2014 day four\n\nCaptured eleven things without naming a folder first. That part is working.\n\nThe surprise: I remember images by **shape and position**, not by title. The wide material strip was much faster to find in Masonry than in Grid.\n\nStill catching myself keeping browser tabs open because saving a link has no visual payoff when its preview is unavailable.'
    ),
    await image(
      '30000000-0000-4000-8000-000000000005',
      'Cool ink material palette',
      3,
      'material-palette.png'
    ),
    url(
      '30000000-0000-4000-8000-000000000006',
      'Local-first software: You own your data, in spite of the cloud',
      4,
      'https://www.inkandswitch.com/essay/local-first/',
      'The clearest articulation of why ownership, offline availability, longevity, and user-controlled files belong together.'
    ),
    note(
      '30000000-0000-4000-8000-000000000007',
      'Copy scraps for the empty Inbox',
      6,
      '# Empty Inbox copy\n\nCurrent favorite:\n\n> Save the useful things you find, then give them a home when you are ready.\n\nAvoid saying **organize your knowledge**. It sounds like work. Also avoid promising a second brain; this is closer to a well-kept project table.'
    ),
    await image(
      '30000000-0000-4000-8000-000000000008',
      'Windows workspace reference',
      7,
      'windows-workspace.png'
    ),
    url(
      '30000000-0000-4000-8000-000000000009',
      'Electron security checklist',
      9,
      'https://www.electronjs.org/docs/latest/tutorial/security',
      'Checklist for context isolation, renderer sandboxing, navigation limits, validated IPC, and safe handling of external URLs.'
    ),
    note(
      '30000000-0000-4000-8000-000000000010',
      'Questions for the next dogfood session',
      11,
      '# Questions for the next dogfood session\n\n- When does Inbox start feeling crowded?\n- Do folders need counts, or does that become pressure?\n- Is Table actually useful for retrieval, or only reassuring?\n- Which details belong in Kuskus and which belong in Explorer?\n\nTry to answer from use, not from preference.'
    ),
    await image(
      '30000000-0000-4000-8000-000000000011',
      'Evening workspace',
      14,
      'evening-workspace.png'
    ),
    url(
      '30000000-0000-4000-8000-000000000012',
      'About Base UI',
      16,
      'https://base-ui.com/react/overview/about',
      'A concise overview of Base UI\u2019s approach to accessible, unstyled, composable React components.'
    )
  ]
}

function collectionItems() {
  return new Map([
    [
      ids.kuskus,
      [
        note(
          '40000000-0000-4000-8000-000000000001',
          'Product direction that still feels true',
          31,
          '# Product direction\n\nA private visual library for project references, stored on your computer.\n\nThe important word is **project**: unlike a general bookmark archive, the things here earn their place by helping with work already in motion.'
        ),
        note(
          '40000000-0000-4000-8000-000000000002',
          'The five-second capture rule',
          27,
          '# The five-second capture rule\n\nOrdinary capture should finish before I have time to reconsider where something belongs. Content first; title, folder, and cleanup later.'
        )
      ]
    ],
    [
      ids.interfaceReferences,
      [
        note(
          '40000000-0000-4000-8000-000000000003',
          'Interface qualities to borrow, not copy',
          25,
          '# Interface qualities to borrow, not copy\n\n- Quiet chrome\n- Content-led hierarchy\n- Obvious native actions\n- Motion that explains where something came from\n- Enough density to build spatial memory'
        )
      ]
    ],
    [
      ids.research,
      [
        note(
          '40000000-0000-4000-8000-000000000004',
          'Where references disappear today',
          22,
          '# Where references disappear today\n\nScreenshots land on the desktop, implementation notes stay in temporary files, and useful tabs survive until the browser restarts. The problem is less capture than keeping context attached.'
        )
      ]
    ],
    [
      ids.writing,
      [
        note(
          '40000000-0000-4000-8000-000000000005',
          'Words worth keeping nearby',
          19,
          '# Words worth keeping nearby\n\nPrivate. Visual. Local. Useful.\n\nAvoid language that makes the library sound like a feed, a database, or homework.'
        )
      ]
    ]
  ])
}

async function seedDemoEnvironment({ root = DEFAULT_DEMO_ROOT, reset = false } = {}) {
  const demoRoot = resolve(root)
  const libraryPath = join(demoRoot, LIBRARY_NAME)
  const userDataPath = join(demoRoot, 'user-data')
  const libraryFile = join(libraryPath, '.kuskus', 'library.json')

  if (reset) await rm(demoRoot, { recursive: true, force: true })
  if (!existsSync(libraryFile)) {
    await Promise.all([
      mkdir(join(libraryPath, 'Archive'), { recursive: true }),
      mkdir(join(libraryPath, '.kuskus', 'records'), { recursive: true }),
      mkdir(join(libraryPath, '.kuskus', 'collections'), { recursive: true }),
      mkdir(join(libraryPath, '.kuskus', 'trash'), { recursive: true }),
      mkdir(join(libraryPath, '.kuskus', 'temp'), { recursive: true }),
      mkdir(userDataPath, { recursive: true })
    ])
    await writeJson(libraryFile, {
      schemaVersion: 2,
      id: ids.library,
      name: LIBRARY_NAME,
      createdAt: timestamp(104)
    })

    const collections = [
      [ids.kuskus, 'Kuskus', 'rocket', 92],
      [ids.interfaceReferences, 'Interface references', 'palette', 71],
      [ids.research, 'Research', 'flask', 58],
      [ids.writing, 'Writing', 'notes', 43]
    ]
    const itemsByCollection = collectionItems()
    for (const [id, name, icon, daysAgo] of collections) {
      const directory = join(libraryPath, name)
      await mkdir(directory, { recursive: true })
      await writeJson(join(libraryPath, '.kuskus', 'collections', `${id}.json`), {
        schemaVersion: 2,
        id,
        name,
        icon,
        createdAt: timestamp(daysAgo),
        relativePath: name,
        parentId: null
      })
      await Promise.all(
        (itemsByCollection.get(id) ?? []).map((item) => writeVaultItem(libraryPath, name, item))
      )
    }

    await Promise.all((await inboxItems()).map((item) => writeVaultItem(libraryPath, '', item)))
    await writeVaultItem(
      libraryPath,
      '',
      note(
        '50000000-0000-4000-8000-000000000001',
        'Old tagline directions',
        35,
        '# Old tagline directions\n\n- Your visual second brain\n- Bookmarks, but beautiful\n- Everything worth remembering\n\nToo broad and too loud. Keeping this in Trash until the simpler product language has survived dogfooding.'
      ),
      'trash'
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
