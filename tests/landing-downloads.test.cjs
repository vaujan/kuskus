const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')
const test = require('node:test')
const ts = require('typescript')
const script = ts.transpile(readFileSync('landing-page/src/downloads.ts', 'utf8'), {
  target: ts.ScriptTarget.ES2022
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function render(response, lang = 'en') {
  const elements = new Map()
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const createElement = () => ({
    children: [],
    textContent: '',
    append(child) {
      this.children.push(child)
    },
    replaceChildren() {
      this.children = []
    },
    get childElementCount() {
      return this.children.length
    }
  })
  const document = {
    documentElement: { lang },
    createElement,
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, createElement())
      return elements.get(selector)
    }
  }
  runInNewContext(script, {
    document,
    Intl,
    AbortSignal,
    fetch: async () => {
      if (response instanceof Error) throw response
      return response
    }
  })
  await new Promise(setImmediate)
  return elements
}

test('download page offers published preview installers and source from the same tag', async () => {
  const root = 'https://github.com/vaujan/kuskus/releases/download/v0.0.3-preview.1/'
  const filenames = [
    'kuskus-0.0.3-x64-setup.exe',
    'kuskus-0.0.3-arm64.dmg',
    'kuskus-0.0.3-x64.dmg',
    'kuskus-0.0.3-x86_64.AppImage'
  ]
  const assets = filenames.map((name) => ({
    name,
    size: 104857600,
    browser_download_url: root + name
  }))
  assets.push({
    name: 'untrusted-setup.exe',
    size: 1,
    browser_download_url: 'https://example.org/file.exe'
  })
  const elements = await render({
    ok: true,
    json: async () => [{ tag_name: 'v0.0.3-preview.1', draft: false, prerelease: true, assets }]
  })
  assert.equal(elements.get('[data-download-platform="windows"]').children.length, 1)
  assert.equal(elements.get('[data-download-platform="macos"]').children.length, 2)
  assert.equal(elements.get('[data-download-platform="linux"]').children.length, 1)
  assert.match(elements.get('[data-download-status]').textContent, /Experimental preview/)
  const source = elements.get('[data-release-files]').children[0]
  assert.equal(
    source.href,
    'https://github.com/vaujan/kuskus/archive/refs/tags/v0.0.3-preview.1.zip'
  )
})

test('download page distinguishes unpublished releases, missing platform assets, and network errors', async () => {
  let elements = await render({ ok: true, json: async () => [] }, 'id')
  assert.match(elements.get('[data-download-status]').textContent, /belum dipublikasikan/)
  elements = await render({
    ok: true,
    json: async () => [{ tag_name: 'v1', assets: [], draft: false, prerelease: false }]
  })
  assert.match(elements.get('[data-download-platform="windows"]').textContent, /No files/)
  assert.doesNotMatch(elements.get('[data-download-status]').textContent, /Experimental preview/)
  for (const response of [new Error('offline'), { ok: false, status: 403 }]) {
    elements = await render(response)
    assert.match(elements.get('[data-download-status]').textContent, /could not be loaded/)
  }
})
