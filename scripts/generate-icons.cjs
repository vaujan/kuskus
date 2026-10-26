/* eslint-disable @typescript-eslint/no-require-imports */
const { copyFileSync, mkdirSync } = require('node:fs')
const { writeFile } = require('node:fs/promises')
const { resolve } = require('node:path')

const root = resolve(__dirname, '..')
const source = resolve(root, 'resources/icon.png')
const outDir = resolve(root, 'build')

// Plain JavaScript build script; TypeScript return annotations are not supported here.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function main() {
  mkdirSync(outDir, { recursive: true })

  // png-to-ico is ESM-only, so import it dynamically from this CJS script.
  const { default: pngToIco } = await import('png-to-ico')
  const ico = await pngToIco(source)
  await writeFile(resolve(outDir, 'icon.ico'), ico)
  console.log(`Wrote ${ico.length} bytes to ${resolve(outDir, 'icon.ico')}`)
  await writeFile(resolve(root, 'landing-page/assets/favicon.ico'), ico)
  console.log('Updated landing-page/assets/favicon.ico from the application icon')

  copyFileSync(source, resolve(outDir, 'icon.png'))
  console.log(`Copied ${source} to ${resolve(outDir, 'icon.png')}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
