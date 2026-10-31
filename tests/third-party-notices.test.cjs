const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { mkdtemp, mkdir, writeFile, readFile, rm } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const test = require('node:test')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function generate(context, includeLicense = true) {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-notices-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const packagePath = join(root, 'node_modules', 'example')
  const atomicPath = join(root, 'src/renderer/src/features/items/live/atomic')
  await mkdir(packagePath, { recursive: true })
  await mkdir(atomicPath, { recursive: true })
  await writeFile(join(atomicPath, 'LICENSE'), 'Atomic editor license')
  await mkdir(join(root, 'third-party'), { recursive: true })
  await writeFile(join(root, 'third-party/shadcn.LICENSE.txt'), 'Shadcn copyright and license')
  await writeFile(
    join(packagePath, 'package.json'),
    JSON.stringify({ name: 'example', version: '1.0.0', license: 'MIT' })
  )
  if (includeLicense) await writeFile(join(packagePath, 'LICENSE'), 'Example copyright and license')
  // A deduped path must appear once; Electron's downloader must not be visited.
  const tree = [
    {
      dependencies: {
        example: {
          path: packagePath,
          dependencies: { example: { path: packagePath } }
        },
        electron: { path: join(root, 'excluded-electron') }
      }
    }
  ]
  const preload = join(root, 'pnpm.cjs')
  await writeFile(
    preload,
    `const assert = require('node:assert/strict')
require('node:child_process').execFileSync = (command, args) => {
  assert.deepEqual(args, ['list', '--prod', '--depth', 'Infinity', '--json'])
  return ${JSON.stringify(JSON.stringify(tree))}
}
`
  )
  const result = spawnSync(
    process.execPath,
    ['--require', preload, resolve('scripts/generate-third-party-notices.cjs')],
    { cwd: root, encoding: 'utf8' }
  )
  return { root, result }
}

test('notices use installed packages without consulting a package-store index', async (context) => {
  const { root, result } = await generate(context)
  assert.equal(result.status, 0, result.stderr)
  const notices = await readFile(join(root, 'THIRD_PARTY_NOTICES.txt'), 'utf8')
  assert.match(notices, /Atomic editor license/)
  assert.match(notices, /Vendored shadcn styles\nShadcn copyright and license/)
  assert.match(notices, /example 1\.0\.0\nLicense: MIT\nExample copyright and license/)
  assert.equal(notices.match(/example 1\.0\.0/g).length, 1)
  assert.doesNotMatch(notices, /excluded-electron/)
})

test('notices still reject installed packages without license text', async (context) => {
  const { result } = await generate(context, false)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Missing license text for example/)
})
