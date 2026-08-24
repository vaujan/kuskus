/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */
const { readFile, readdir, stat } = require('node:fs/promises')
const { basename, dirname, join, resolve } = require('node:path')

const RENDERER_ROOT = resolve('out/renderer')
const ASSET_ROOT = join(RENDERER_ROOT, 'assets')
// Measured 2026-08-22. The 1.66 MB baseline predated the Focus master-detail view
// (DEC-043), the rich Markdown editor (DEC-052), and Mermaid/KaTeX support, which
// legitimately grew the main surface. Quick Capture (0.94 MB) is under its budget;
// the ceiling below is the justified current state and catches growth from here.
const MAX_SURFACE_BYTES = 2_500_000
// Two English-first Latin variable fonts (Inter + IBM Plex Sans), down from the full
// subset set (380 KB) after restricting to the latin subset (94 KB). The ceiling
// catches regressions back toward shipping every language subset.
const MAX_APP_FONT_BYTES = 110_000
const MAX_MATH_FONT_BYTES = 260_000

async function staticJavaScriptGraph(entries) {
  const discovered = new Set()
  const visit = async (path) => {
    const resolved = resolve(path)
    if (discovered.has(resolved)) return
    discovered.add(resolved)
    const source = await readFile(resolved, 'utf8')
    const imports = [...source.matchAll(/\bfrom\s*["']([^"']+\.js)["']/g)].map((match) => match[1])
    for (const imported of imports) await visit(resolve(dirname(resolved), imported))
  }
  for (const entry of entries) await visit(entry)
  let bytes = 0
  for (const path of discovered) bytes += (await stat(path)).size
  return { files: [...discovered].map((file) => basename(file)), bytes }
}

function requireBudget(condition, message) {
  if (!condition) throw new Error(message)
}

async function main() {
  const html = await readFile(join(RENDERER_ROOT, 'index.html'), 'utf8')
  const entryMatch = html.match(/<script[^>]+src="\.\/assets\/([^"]+\.js)"/)
  requireBudget(entryMatch, 'Unable to locate the renderer entry chunk.')
  const assets = await readdir(ASSET_ROOT)
  const appChunk = assets.find((name) => /^App-[\w-]+\.js$/.test(name))
  const quickChunk = assets.find((name) => /^quick-capture-app-[\w-]+\.js$/.test(name))
  requireBudget(appChunk, 'Unable to locate the main App surface chunk.')
  requireBudget(quickChunk, 'Unable to locate the Quick Capture surface chunk.')

  const entryPath = join(ASSET_ROOT, entryMatch[1])
  const appGraph = await staticJavaScriptGraph([entryPath, join(ASSET_ROOT, appChunk)])
  const quickGraph = await staticJavaScriptGraph([entryPath, join(ASSET_ROOT, quickChunk)])
  const entryBytes = (await stat(entryPath)).size
  const appBytes = appGraph.bytes
  const quickBytes = quickGraph.bytes
  const fontFiles = assets.filter((name) => /\.(woff2?|ttf)$/.test(name))
  let appFontBytes = 0
  let mathFontBytes = 0
  for (const file of fontFiles) {
    const bytes = (await stat(join(ASSET_ROOT, file))).size
    if (file.startsWith('KaTeX_')) mathFontBytes += bytes
    else appFontBytes += bytes
  }

  console.log(
    JSON.stringify({
      entryBytes,
      mainSurfaceBytes: appBytes,
      quickCaptureSurfaceBytes: quickBytes,
      appFontBytes,
      mathFontBytes,
      appFiles: appGraph.files,
      quickCaptureFiles: quickGraph.files
    })
  )
  requireBudget(
    appBytes <= MAX_SURFACE_BYTES,
    `Main surface JavaScript is ${appBytes} bytes; budget is ${MAX_SURFACE_BYTES}.`
  )
  requireBudget(
    quickBytes <= MAX_SURFACE_BYTES,
    `Quick Capture JavaScript is ${quickBytes} bytes; budget is ${MAX_SURFACE_BYTES}.`
  )
  requireBudget(
    appFontBytes <= MAX_APP_FONT_BYTES,
    `Application fonts are ${appFontBytes} bytes; budget is ${MAX_APP_FONT_BYTES}.`
  )
  requireBudget(
    mathFontBytes <= MAX_MATH_FONT_BYTES,
    `KaTeX fonts are ${mathFontBytes} bytes; budget is ${MAX_MATH_FONT_BYTES}.`
  )
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}

module.exports = { staticJavaScriptGraph }
