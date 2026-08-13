const assert = require('node:assert/strict')
const { mkdtemp, rm, stat, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const test = require('node:test')

const { staticJavaScriptGraph } = require('../scripts/check-performance-budget.cjs')

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
