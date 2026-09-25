/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports */

const { spawn } = require('node:child_process')
const { existsSync, readFileSync } = require('node:fs')
const { mkdir, rm, writeFile } = require('node:fs/promises')
const { join, resolve } = require('node:path')

const projectRoot = resolve(__dirname, '..')
const onboardingRoot = join(projectRoot, '.onboarding')
const userDataPath = join(onboardingRoot, 'user-data')
const librariesPath = join(onboardingRoot, 'libraries')
const runnerPath = join(onboardingRoot, 'runner.pid')

function isRunning(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') return false
    throw error
  }
}

async function run() {
  const resetOnly = process.argv[2] === '--reset-only'
  if (process.argv.length > (resetOnly ? 3 : 2)) {
    throw new Error('Usage: node scripts/run-onboarding.cjs [--reset-only]')
  }

  if (existsSync(runnerPath)) {
    const pid = Number(readFileSync(runnerPath, 'utf8').trim())
    if (Number.isInteger(pid) && pid > 0 && isRunning(pid)) {
      throw new Error('Close the onboarding app before resetting its workspace.')
    }
  }

  await rm(onboardingRoot, { recursive: true, force: true })
  if (resetOnly) {
    console.log(`Cleared onboarding workspace: ${onboardingRoot}`)
    return
  }

  await Promise.all([
    mkdir(userDataPath, { recursive: true }),
    mkdir(librariesPath, { recursive: true })
  ])
  await writeFile(runnerPath, String(process.pid))

  try {
    console.log(`Starting Kuskus with a fresh onboarding workspace: ${onboardingRoot}`)
    const executable = join(
      projectRoot,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'electron-vite.cmd' : 'electron-vite'
    )
    const child = spawn(executable, ['dev'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        KUSKUS_ONBOARDING_USER_DATA: userDataPath,
        KUSKUS_ONBOARDING_LIBRARIES_PATH: librariesPath
      },
      shell: process.platform === 'win32',
      stdio: 'inherit'
    })
    process.exitCode = await new Promise((finish) => {
      child.on('error', (error) => {
        console.error(error)
        finish(1)
      })
      child.on('exit', (code) => finish(code ?? 1))
    })
  } finally {
    await rm(runnerPath, { force: true })
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
