/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports */

const { spawn } = require('node:child_process')
const { join } = require('node:path')
const { seedDemoEnvironment } = require('./create-demo-library.cjs')

async function run() {
  const { userDataPath, libraryPath } = await seedDemoEnvironment()
  console.log(`Starting Kuskus with isolated demo data from ${libraryPath}`)

  const executable = join(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'electron-vite.cmd' : 'electron-vite'
  )
  const child = spawn(executable, ['dev'], {
    cwd: process.cwd(),
    env: { ...process.env, KUSKUS_DEMO_USER_DATA: userDataPath },
    shell: process.platform === 'win32',
    stdio: 'inherit'
  })
  child.on('error', (error) => {
    console.error(error)
    process.exitCode = 1
  })
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    else process.exitCode = code ?? 1
  })
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
