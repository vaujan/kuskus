/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */
// Headless round-trip smoke test for the code_block schema override.
// Usage: pnpm exec electron scripts/smoke-code-schema.cjs
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const PROJECT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(PROJECT, 'tmp', 'schema-smoke')

async function buildSmokeBundle() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const requireFromProject = require('module').createRequire(path.join(PROJECT, 'package.json'))
  // esbuild is a transitive dep (of electron-vite), so resolve it from .pnpm.
  const esbuildRoot = path.join(PROJECT, 'node_modules', '.pnpm')
  const esbuildDir = fs
    .readdirSync(esbuildRoot)
    .filter((entry) => entry.startsWith('esbuild@'))
    .sort()
    .at(-1)
  const esbuild = requireFromProject(path.join(esbuildRoot, esbuildDir, 'node_modules', 'esbuild'))
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'smoke-code-schema.entry.ts')],
    bundle: true,
    format: 'esm',
    outfile: path.join(OUT_DIR, 'smoke.mjs'),
    logLevel: 'warning'
  })
}

app.whenReady().then(async () => {
  try {
    await buildSmokeBundle()
  } catch (error) {
    console.error('bundle failed', error)
    process.exitCode = 1
    app.quit()
    return
  }
  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  })
  const page = path.join(OUT_DIR, 'index.html')
  fs.writeFileSync(page, '<!doctype html><html><body></body></html>')
  await win.loadFile(page)
  try {
    await win.webContents.executeJavaScript(
      `import('file://${path.join(OUT_DIR, 'smoke.mjs').replace(/\\/g, '/')}').then(() => true)`
    )
    const results = await win.webContents.executeJavaScript('window.__SMOKE_RESULTS')
    let failed = 0
    for (const result of results ?? []) {
      if (!result.pass) failed += 1
      console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}`)
      if (!result.pass) {
        console.log('  actual:   ' + JSON.stringify(result.actual))
        console.log('  expected: ' + JSON.stringify(result.expected))
      }
    }
    process.exitCode = failed ? 1 : 0
  } catch (error) {
    console.error('SMOKE ERROR', error)
    process.exitCode = 1
  } finally {
    app.quit()
  }
})
