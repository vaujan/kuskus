/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports */
const { randomUUID } = require('node:crypto')
const { existsSync, readFileSync } = require('node:fs')
const { mkdir, mkdtemp, rm, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { dirname, join, resolve } = require('node:path')
const { spawn } = require('node:child_process')

function option(name, fallback) {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

async function executablePath() {
  const candidates =
    process.platform === 'win32'
      ? ['dist/win-unpacked/kuskus.exe']
      : process.platform === 'darwin'
        ? [
            'dist/mac/Kuskus.app/Contents/MacOS/Kuskus',
            'dist/mac-arm64/Kuskus.app/Contents/MacOS/Kuskus'
          ]
        : ['dist/linux-unpacked/kuskus']
  const match = candidates.map((candidate) => resolve(candidate)).find(existsSync)
  if (!match) throw new Error('Packaged app not found. Run pnpm build:unpack first.')
  return match
}

async function createFixture(root, itemCount) {
  const userData = join(root, 'user-data')
  const vault = join(root, 'vault')
  const records = join(vault, '.kuskus', 'records')
  await mkdir(records, { recursive: true })
  const libraryId = randomUUID()
  await writeFile(
    join(vault, '.kuskus', 'library.json'),
    `${JSON.stringify({ schemaVersion: 2, id: libraryId, name: 'Performance Vault', createdAt: new Date().toISOString() }, null, 2)}\n`
  )
  const body = 'Local-first searchable content. '.repeat(80)
  const workers = Array.from({ length: 32 }, async (_, worker) => {
    for (let index = worker; index < itemCount; index += 32) {
      const name = `Note ${String(index).padStart(5, '0')}`
      await writeFile(join(vault, `${name}.md`), `# ${name}\n\n${body}`)
    }
  })
  await Promise.all(workers)
  await mkdir(userData, { recursive: true })
  await writeFile(
    join(userData, 'kuskus-settings.json'),
    `${JSON.stringify({ schemaVersion: 1, lastLibraryPath: vault }, null, 2)}\n`
  )
  return userData
}

function runApp(executable, env, duration) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(executable, [], { env: { ...process.env, ...env }, stdio: 'inherit' })
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error('Packaged performance run timed out.'))
    }, duration + 15_000)
    child.once('error', reject)
    child.once('exit', (code) => {
      clearTimeout(timeout)
      if (code === 0) resolveRun()
      else reject(new Error(`Packaged app exited with ${code}.`))
    })
  })
}

function percentile(values, ratio) {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(ratio * sorted.length)))
  return sorted[index]
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)] ?? null
}

function p95(values) {
  return percentile(values, 0.95)
}

async function main() {
  const runs = Math.max(1, Number(option('runs', '3')) || 3)
  const itemCount = Math.max(1, Number(option('items', '5000')) || 5000)
  const typing = process.argv.includes('--typing')
  const duration = Math.max(
    1_000,
    Number(option('duration-ms', typing ? '90000' : '30000')) || 30_000
  )
  const output = resolve(option('output', '.performance/packaged.ndjson'))
  const root = await mkdtemp(join(tmpdir(), 'kuskus-packaged-performance-'))
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, '')
  try {
    const executable = await executablePath()
    const userData = await createFixture(root, itemCount)
    for (let run = 1; run <= runs; run += 1) {
      await runApp(
        executable,
        {
          KUSKUS_PERFORMANCE_OUTPUT: output,
          KUSKUS_PERFORMANCE_USER_DATA: userData,
          KUSKUS_PERFORMANCE_RUN: String(run),
          KUSKUS_PERFORMANCE_DURATION_MS: String(duration),
          ...(typing ? { KUSKUS_PERFORMANCE_TYPING: '1' } : {})
        },
        duration
      )
    }
    const entries = readFileSync(output, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
    const firstCards = entries
      .filter((entry) => entry.event === 'first-card')
      .map((entry) => ({ run: Number(entry.run), milliseconds: entry.data.milliseconds }))
    const cachedFirstCards = firstCards
      .filter((entry) => entry.run > 1 || runs === 1)
      .map((entry) => entry.milliseconds)
    const settledMemory = entries
      .filter((entry) => entry.event === 'settled-memory')
      .map((entry) => entry.data.totalWorkingSetKb / 1024)
    const settledCpu = entries
      .filter((entry) => entry.event === 'settled-memory')
      .map((entry) => entry.data.totalCpuPercent)
    const settledProcessCounts = entries
      .filter((entry) => entry.event === 'settled-memory')
      .map((entry) => entry.data.processes.length)

    const summary = {
      runs,
      itemCount,
      cachedFirstCardMedianMs: median(cachedFirstCards),
      settledWorkingSetMedianMb: median(settledMemory),
      settledCpuMedianPercent: median(settledCpu),
      settledProcessCountMedian: median(settledProcessCounts),
      output
    }

    if (typing) {
      const typingEvents = entries.filter((entry) => entry.event === 'typing')
      if (typingEvents.length !== runs) {
        throw new Error('A packaged run did not complete the typing scenario.')
      }
      if (typingEvents.some((entry) => entry.data.completed === false)) {
        throw new Error(
          'A typing scenario never reached an interactive workspace (no search trigger found).'
        )
      }
      const searchKeyLatencies = typingEvents.flatMap((entry) => entry.data.search.keyLatencies)
      const noteKeyLatencies = typingEvents.flatMap((entry) => entry.data.note.keyLatencies)
      const longTasks = typingEvents.flatMap((entry) => [
        ...entry.data.search.longTasks,
        ...entry.data.note.longTasks
      ])
      const ipcCalls = entries.filter((entry) => entry.event === 'ipc-call')
      const queryItems = ipcCalls
        .filter((entry) => entry.data.channel === 'library:query-items')
        .map((entry) => entry.data.milliseconds)
      const updateNotes = ipcCalls
        .filter((entry) => entry.data.channel === 'library:update-note')
        .map((entry) => entry.data.milliseconds)
      const vaultScans = Math.max(...typingEvents.map((entry) => entry.data.vaultScans))
      const autosaveScans = Math.max(...typingEvents.map((entry) => entry.data.autosaveScans))
      if (!Number.isFinite(autosaveScans))
        throw new Error('Typing did not report autosave scan measurements.')
      summary.typing = {
        searchKeystrokeP95Ms: p95(searchKeyLatencies),
        noteKeystrokeP95Ms: p95(noteKeyLatencies),
        maxLongTaskMs: Math.max(0, ...longTasks),
        droppedFramesPerRun: typingEvents.map(
          (entry) => entry.data.search.droppedFrames + entry.data.note.droppedFrames
        ),
        queryItemsCount: queryItems.length,
        queryItemsP95Ms: p95(queryItems),
        updateNoteP95Ms: p95(updateNotes),
        vaultScans,
        autosaveScans
      }
      const budgetMs = 100
      const below = (value, label) => {
        if (value === null) throw new Error(`${label} produced no measurements.`)
        if (value > budgetMs) throw new Error(`${label} exceeded ${budgetMs} ms: ${value} ms.`)
      }
      below(p95(searchKeyLatencies), 'Search keystroke p95')
      below(p95(noteKeyLatencies), 'Note editor keystroke p95')
      below(p95(queryItems), 'queryItems p95')
      below(p95(updateNotes), 'updateNote p95')
      if (Math.max(0, ...longTasks) > budgetMs) {
        throw new Error(`Long task exceeded ${budgetMs} ms during typing.`)
      }
      if (autosaveScans !== 0) {
        throw new Error(`Note autosave triggered ${autosaveScans} full vault scans.`)
      }
    }

    console.log(JSON.stringify(summary))
    if (firstCards.length !== runs) throw new Error('A packaged run did not reach the first card.')
    if (runs > 1 && median(cachedFirstCards) > 1_200) {
      throw new Error(`Cached first card exceeded 1,200 ms: ${median(cachedFirstCards)} ms.`)
    }
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
