const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')
const test = require('node:test')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function collect({ corrupt = false, missingBlockmap = false } = {}) {
  const files = new Map()
  const metadata = { version: '1.0.0', files: [] }
  for (const arch of ['x64', 'arm64']) {
    const name = `kusu-1.0.0-${arch}-setup.exe`
    const bytes = Buffer.from(arch)
    metadata.files.push({ url: name, sha512: createHash('sha512').update(bytes).digest('base64') })
    files.set(name, bytes)
    files.set(`${name}.blockmap`, Buffer.from('blockmap'))
  }
  if (corrupt) files.set('kusu-1.0.0-x64-setup.exe', Buffer.from('corrupt'))
  if (missingBlockmap) files.delete('kusu-1.0.0-arm64-setup.exe.blockmap')
  files.set('latest.yml', JSON.stringify(metadata))
  const copied = []
  let created = false
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const run = () =>
    runInNewContext(readFileSync('scripts/collect-update-artifacts.cjs', 'utf8'), {
      console: { log: () => undefined },
      require: (id) => {
        if (id === '../package.json') return { name: 'kusu', version: '1.0.0' }
        if (id === 'yaml') return { parse: JSON.parse }
        if (id === 'node:fs')
          return {
            readFileSync: (path) => {
              const value = files.get(path.replaceAll('\\', '/').split('/').at(-1))
              if (value === undefined) throw new Error('Missing blockmap')
              return value
            },
            mkdirSync: () => {
              created = true
            },
            copyFileSync: (_source, destination) => copied.push(destination),
            writeFileSync: () => undefined
          }
        return require(id)
      }
    })
  return { run, copied, created: () => created }
}

test('release collection includes both architectures, blockmaps, and update feed', () => {
  const s = collect()
  s.run()
  assert.equal(s.copied.length, 5)
  assert.equal(
    s.copied.some((path) => path.endsWith('latest.yml')),
    true
  )
})

test('release collection refuses corrupt installers or missing blockmaps before writing output', () => {
  for (const options of [{ corrupt: true }, { missingBlockmap: true }]) {
    const s = collect(options)
    assert.throws(s.run)
    assert.equal(s.created(), false)
    assert.equal(s.copied.length, 0)
  }
})
