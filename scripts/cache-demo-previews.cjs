/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports */
// Refresh the static demo snapshots explicitly; website builds never fetch publishers.
const { readFile, writeFile, mkdir } = require('node:fs/promises')
const { resolve } = require('node:path')
const { createHash } = require('node:crypto')

const root = resolve(__dirname, '..')
const output = resolve(root, 'src/renderer/src/demo/assets/bookmarks')
const decode = (value) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
const attributes = (tag) =>
  Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(
      ([, key, double, single, bare]) => [key.toLowerCase(), decode(double ?? single ?? bare)]
    )
  )
const request = (url) => fetch(url, { signal: AbortSignal.timeout(20000) })

async function main() {
  await mkdir(output, { recursive: true })
  const fixtures = await Promise.all(
    [
      'src/renderer/src/demo/student-library-fixtures.ts',
      'landing-page/src/persona-libraries.ts'
    ].map((file) => readFile(resolve(root, file), 'utf8'))
  )
  const urls = [
    ...new Set(
      fixtures.flatMap((source) =>
        [...source.matchAll(/url: '(https:[^']+)'/g)].map((match) => match[1])
      )
    )
  ].sort()
  const sources = await Promise.all(
    urls.map(async (url) => {
      const entry = { url, capturedAt: new Date().toISOString(), preview: null, favicon: null }
      try {
        const response = await request(url)
        if (!response.ok) throw new Error(`Page HTTP ${response.status}`)
        const html = await response.text()
        const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => attributes(tag))
        const image = ['og:image', 'twitter:image']
          .map((key) => meta.find((tag) => (tag.property ?? tag.name) === key)?.content)
          .find(Boolean)
        const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => attributes(tag))
        const icon = links.find((tag) => /(?:^|\s)icon(?:\s|$)/i.test(tag.rel ?? ''))?.href
        for (const [kind, asset] of [
          ['preview', image],
          ['favicon', icon]
        ]) {
          if (!asset) continue
          const source = new URL(asset, response.url).href
          try {
            const result = await request(source)
            if (!result.ok) throw new Error(`Image HTTP ${result.status}`)
            const bytes = Buffer.from(await result.arrayBuffer())
            const signature = bytes.subarray(0, 12).toString('hex')
            const mediaType = signature.startsWith('89504e470d0a1a0a')
              ? 'image/png'
              : signature.startsWith('ffd8ff')
                ? 'image/jpeg'
                : signature.startsWith('47494638')
                  ? 'image/gif'
                  : signature.startsWith('00000100')
                    ? 'image/x-icon'
                    : bytes.toString('ascii', 0, 4) === 'RIFF' &&
                        bytes.toString('ascii', 8, 12) === 'WEBP'
                      ? 'image/webp'
                      : null
            const extension = {
              'image/png': 'png',
              'image/jpeg': 'jpg',
              'image/webp': 'webp',
              'image/gif': 'gif',
              'image/x-icon': 'ico',
              'image/vnd.microsoft.icon': 'ico'
            }[mediaType]
            if (!extension) continue
            if (bytes.length > 5 * 1024 * 1024) throw new Error('Image exceeds 5 MB')
            const file = `${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}.${extension}`
            await writeFile(resolve(output, file), bytes)
            entry[kind] = {
              file,
              source,
              mediaType: mediaType === 'image/vnd.microsoft.icon' ? 'image/x-icon' : mediaType
            }
          } catch (error) {
            console.warn(`${url} ${kind}: ${error.message}`)
          }
        }
      } catch (error) {
        console.warn(`${url}: ${error.message}`)
      }
      console.log(`${url}: preview=${Boolean(entry.preview)} favicon=${Boolean(entry.favicon)}`)
      return entry
    })
  )
  await writeFile(resolve(output, 'sources.json'), `${JSON.stringify(sources, null, 2)}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
