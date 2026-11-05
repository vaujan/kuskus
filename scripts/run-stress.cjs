/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports */
const { spawn } = require('node:child_process')
const { existsSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { createFixture } = require('./performance-fixture.cjs')

const projectRoot = resolve(__dirname, '..')

async function main() {
  let itemCount = 6000
  let seedOnly = false
  let mixed = false
  for (const argument of process.argv.slice(2)) {
    if (argument === '--mixed') mixed = true
    else if (argument === '--seed-only') seedOnly = true
    else if (/^--items=\d+$/.test(argument)) itemCount = Number(argument.slice(8))
    else throw new Error('Usage: pnpm stress [--items=10000] [--mixed] [--seed-only]')
  }
  if (!Number.isSafeInteger(itemCount) || itemCount < 1) {
    throw new Error('--items must be a positive safe integer.')
  }
  if (!seedOnly && !existsSync(join(projectRoot, 'out', 'main', 'index.js'))) {
    throw new Error('Build the app first with pnpm build, then run pnpm stress.')
  }

  const root = join(projectRoot, '.performance', `manual-${mixed ? 'mixed-' : ''}${itemCount}`)
  const vault = join(root, 'vault')
  const userData = join(root, 'user-data')
  if (!existsSync(join(vault, '.kuskus', 'library.json'))) {
    console.log(`Creating ${itemCount.toLocaleString()} test items…`)
    await createFixture(root, itemCount, mixed)
  }
  console.log(`Test vault: ${vault}`)
  console.log(`Isolated profile: ${userData}`)
  console.log('Test edits persist between launches. The app stays open until you close it.')
  if (seedOnly) return

  // Use the production build without dev instrumentation or packaging overhead.
  // Clear inherited automation settings so this remains a manual session.
  const env = { ...process.env, KUSU_DEMO_USER_DATA: userData }
  for (const key of Object.keys(env)) {
    if (key.startsWith('KUSU_PERFORMANCE_') || key.startsWith('KUSU_ONBOARDING_')) delete env[key]
  }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(require('electron'), [projectRoot], {
    cwd: projectRoot,
    env,
    stdio: 'inherit'
  })
  process.exitCode = await new Promise((finish) => {
    child.once('error', (error) => {
      console.error(error.message)
      finish(1)
    })
    child.once('exit', (code) => finish(code ?? 1))
  })
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
