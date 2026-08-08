/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */
const { readFileSync } = require('node:fs')
const { mkdir, mkdtemp, readdir, rm, stat, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { performance } = require('node:perf_hooks')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true
    },
    fileName: filename
  })
  module._compile(output.outputText, filename)
}

const { LibraryService } = require('../src/main/library/library-service.ts')

function option(name, fallback) {
  const prefix = `--${name}=`
  return (
    process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback
  )
}

const sizes = option('sizes', '100,1000,5000')
  .split(',')
  .map(Number)
  .filter((value) => Number.isSafeInteger(value) && value > 0)
const binaryMegabytes = Math.max(0, Number(option('binary-mb', '1')) || 0)

async function mapWithConcurrency(values, limit, operation) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (next < values.length) {
        const index = next
        next += 1
        await operation(values[index], index)
      }
    })
  )
}

async function recordTimes(vaultPath) {
  const directory = join(vaultPath, '.kuskus', 'records')
  const entries = await readdir(directory)
  return new Map(
    await Promise.all(
      entries
        .filter((entry) => entry.endsWith('.json'))
        .map(async (entry) => [entry, (await stat(join(directory, entry))).mtimeMs])
    )
  )
}

function changedRecords(before, after) {
  let changed = 0
  for (const [name, modifiedAt] of after) {
    if (before.get(name) !== modifiedAt) changed += 1
  }
  return changed
}

async function measure(operation) {
  const startedAt = performance.now()
  const value = await operation()
  return { value, milliseconds: Math.round(performance.now() - startedAt) }
}

async function runFixture(itemCount) {
  const root = await mkdtemp(join(tmpdir(), `kuskus-performance-${itemCount}-`))
  const settingsPath = join(root, 'settings.json')
  try {
    const service = new LibraryService(settingsPath)
    await service.createIn(root, 'Vault')
    const vaultPath = join(root, 'Vault')
    const binaryCount = Math.max(1, Math.round(itemCount * 0.1))
    const noteCount = itemCount - binaryCount
    const noteBody = '# Performance reference\n\n' + 'Local-first searchable content. '.repeat(80)
    const binary = Buffer.alloc(binaryMegabytes * 1024 * 1024, 7)

    await mapWithConcurrency(Array.from({ length: noteCount }), 32, async (_, index) => {
      await writeFile(join(vaultPath, `Note ${String(index).padStart(5, '0')}.md`), noteBody)
    })
    await mapWithConcurrency(Array.from({ length: binaryCount }), 8, async (_, index) => {
      await writeFile(join(vaultPath, `Asset ${String(index).padStart(5, '0')}.pdf`), binary)
    })

    const cold = await measure(() => service.getState())
    if (cold.value.status !== 'ready') throw new Error('Fixture did not open.')
    const beforeWarm = await recordTimes(vaultPath)
    let resolveExternalEdit
    const externalEditReconciled = new Promise((resolve) => {
      resolveExternalEdit = resolve
    })
    const stopWatcher = service.onVaultChanged(() => resolveExternalEdit())
    const warm = await measure(() => service.reconcileState())
    const afterWarm = await recordTimes(vaultPath)

    const editedNote = join(vaultPath, 'Note 00000.md')
    const editStartedAt = performance.now()
    await writeFile(editedNote, `${noteBody}\n\nEdited externally.`)
    await externalEditReconciled
    const editMilliseconds = Math.round(performance.now() - editStartedAt)
    stopWatcher()

    const reopened = new LibraryService(settingsPath)
    const initialize = await measure(() => reopened.initialize())
    const cached = await measure(() => reopened.getState(true))
    await reopened.reconcileState()

    const searchStartedAt = performance.now()
    const matches = cold.value.library.items.filter((item) =>
      `${item.title} ${item.type === 'note' ? item.body : ''}`
        .toLocaleLowerCase()
        .includes('searchable content')
    ).length
    const searchMilliseconds = Math.round(performance.now() - searchStartedAt)

    return {
      itemCount,
      binaryMegabytes,
      coldRebuildMs: cold.milliseconds,
      noOpReconcileMs: warm.milliseconds,
      noOpRecordWrites: changedRecords(beforeWarm, afterWarm),
      oneNoteEditMs: editMilliseconds,
      cachedInitializeMs: initialize.milliseconds,
      cachedStateMs: cached.milliseconds,
      searchMs: searchMilliseconds,
      searchMatches: matches,
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024)
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function main() {
  await mkdir(tmpdir(), { recursive: true })
  for (const size of sizes) console.log(JSON.stringify(await runFixture(size)))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
