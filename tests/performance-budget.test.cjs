const assert = require('node:assert/strict')
const { mkdtemp, rm, stat, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')

const { staticJavaScriptGraph } = require('../scripts/check-performance-budget.cjs')

test('keeps large-vault work bounded to changed items and near-viewport cards', () => {
  const service = require('node:fs').readFileSync(
    require.resolve('../src/main/library/library-service.ts'),
    'utf8'
  )
  const store = require('node:fs').readFileSync(
    require.resolve('../src/main/library/storage/library-store.ts'),
    'utf8'
  )
  const noteCard = require('node:fs').readFileSync(
    require.resolve('../src/renderer/src/features/items/note-item-card.tsx'),
    'utf8'
  )
  const masonry = require('node:fs').readFileSync(
    require.resolve('../src/renderer/src/features/library/ordered-masonry.tsx'),
    'utf8'
  )
  const benchmark = require('node:fs').readFileSync(
    require.resolve('../scripts/benchmark-performance.cjs'),
    'utf8'
  )

  assert.match(service, /store\.updateLibraryDto/)
  assert.match(store, /async updateLibraryDto\(/)
  assert.doesNotMatch(store, /async resolveItem[\s\S]*?await this\.scanVault/)
  assert.match(noteCard, /useNearViewport\(\)/)
  assert.match(noteCard, /nearViewport \? \(/)
  assert.match(masonry, /visibleItems\.map\(\(item\) => item\.getBoundingClientRect\(\)\.height\)/)
  assert.match(benchmark, /service\.queryItems/)
  assert.match(benchmark, /renameItemMs/)
  assert.match(benchmark, /archiveItemMs/)
})

test('packaged performance summary includes CPU and process counts', () => {
  const reporter = require('node:fs').readFileSync(
    require.resolve('../src/main/performance-reporter.ts'),
    'utf8'
  )
  const runner = require('node:fs').readFileSync(
    require.resolve('../scripts/measure-packaged-performance.cjs'),
    'utf8'
  )

  assert.match(reporter, /cpuPercent: metric\.cpu\.percentCPUUsage/)
  assert.match(reporter, /totalCpuPercent/)
  assert.match(runner, /settledCpuMedianPercent/)
  assert.match(runner, /settledProcessCountMedian/)
})

test('counts shared JavaScript chunks once across multiple entries', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'kuskus-performance-budget-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const shared = join(root, 'shared.js')
  const entry = join(root, 'entry.js')
  const app = join(root, 'app.js')

  await writeFile(shared, 'export const shared = true\n')
  await writeFile(entry, "import { shared } from './shared.js'\nexport { shared }\n")
  await writeFile(app, "import { shared } from './shared.js'\nconsole.log(shared)\n")

  const graph = await staticJavaScriptGraph([entry, app])

  assert.equal(graph.files.length, 3)
  assert.equal(
    graph.bytes,
    (await stat(shared)).size + (await stat(entry)).size + (await stat(app)).size
  )
})
