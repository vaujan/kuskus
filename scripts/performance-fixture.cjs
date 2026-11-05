/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports */
const { randomUUID } = require('node:crypto')
const { mkdir, writeFile, readFile } = require('node:fs/promises')
const { join } = require('node:path')
const { deflateSync, crc32 } = require('node:zlib')

async function createFixture(root, itemCount, mixed = false) {
  const userData = join(root, 'user-data')
  const vault = join(root, 'vault')
  const records = join(vault, '.kuskus', 'records')
  await mkdir(records, { recursive: true })
  const libraryId = randomUUID()
  const images = mixed ? [fixturePng(1600, 900), fixturePng(900, 1600)] : []
  const pdf = mixed
    ? await readFile(join(__dirname, '..', 'tests', 'fixtures', 'pdf-reader.pdf'))
    : null
  if (mixed)
    await Promise.all(
      Array.from({ length: 12 }, (_, id) =>
        mkdir(join(vault, `Group ${String(id).padStart(2, '0')}`), { recursive: true })
      )
    )
  const body = 'Local-first searchable content. '.repeat(80)
  const workers = Array.from({ length: 32 }, async (_, worker) => {
    for (let index = worker; index < itemCount; index += 32) {
      const name = `Note ${String(index).padStart(5, '0')}`
      const directory =
        mixed && index % 3 === 0
          ? join(vault, `Group ${String(Math.floor(index / 100) % 12).padStart(2, '0')}`)
          : vault
      const slot = mixed ? index % 10 : 0
      const suffix = String(index).padStart(5, '0')
      if (slot === 6 || slot === 7)
        await writeFile(join(directory, `Image ${suffix}.png`), images[slot - 6])
      else if (slot === 8)
        await writeFile(
          join(directory, `Link ${suffix}.url`),
          `[InternetShortcut]\r\nURL=http://127.0.0.1:9/fixture/${index}\r\n`
        )
      else if (slot === 9) await writeFile(join(directory, `File ${suffix}.pdf`), pdf)
      else {
        const markdown =
          mixed && index % 4 === 0
            ? `## Research checklist\n\n- [ ] Review findings\n- [x] Save reference\n\n| Topic | Status |\n| --- | --- |\n| Rendering | Measuring |\n\n${body}\n\n~~~js\nconst count = 6000\n~~~\n`
            : body
        await writeFile(join(directory, `${name}.md`), `# ${name}\n\n${markdown}`)
      }
    }
  })
  await Promise.all(workers)
  await mkdir(userData, { recursive: true })
  await writeFile(
    join(userData, 'kusu-settings.json'),
    `${JSON.stringify({ schemaVersion: 1, lastLibraryPath: vault }, null, 2)}\n`
  )
  // Publish vault metadata last so interrupted seeds can be retried before opening the app.
  await writeFile(
    join(vault, '.kuskus', 'library.json'),
    `${JSON.stringify({ schemaVersion: 2, id: libraryId, name: 'Performance Vault', createdAt: new Date().toISOString() }, null, 2)}\n`
  )
  return userData
}

function fixturePng(width, height) {
  const chunk = (name, bytes) => {
    const type = Buffer.from(name)
    const length = Buffer.alloc(4)
    length.writeUInt32BE(bytes.length)
    const checksum = Buffer.alloc(4)
    checksum.writeUInt32BE(crc32(Buffer.concat([type, bytes])))
    return Buffer.concat([length, type, bytes, checksum])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  const pixels = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 3 + 1) + 1 + x * 3
      pixels[offset] = Math.floor((x / width) * 255)
      pixels[offset + 1] = Math.floor((y / height) * 255)
      pixels[offset + 2] = 128
    }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

module.exports = { createFixture }
