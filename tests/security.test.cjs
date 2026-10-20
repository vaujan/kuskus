const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { EventEmitter } = require('node:events')
const { resolve } = require('node:path')
const { pathToFileURL } = require('node:url')
const { runInNewContext } = require('node:vm')
const test = require('node:test')
const ts = require('typescript')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup(dev = false) {
  const calls = []
  const handlers = new Map()
  const listeners = new Map()
  const module = { exports: {} }
  const mainDirectory = resolve('security-fixture/out/main')
  const rendererUrl = pathToFileURL(resolve('security-fixture/out/renderer/index.html')).href
  const source = ts.transpileModule(readFileSync('src/main/security.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  runInNewContext(source, {
    module,
    exports: module.exports,
    URL,
    __dirname: mainDirectory,
    process: { env: { ELECTRON_RENDERER_URL: 'http://localhost:5173/' } },
    require: (id) => {
      if (id === '@electron-toolkit/utils') return { is: { dev } }
      if (id === 'electron')
        return {
          shell: { openExternal: async (url) => calls.push(url) },
          ipcMain: {
            handle: (channel, listener) => handlers.set(channel, listener),
            on: (channel, listener) => listeners.set(channel, listener)
          }
        }
      return require(id)
    }
  })
  const contents = new EventEmitter()
  contents.mainFrame = { url: `${rendererUrl}?surface=note-window` }
  contents.isDestroyed = () => false
  contents.setWindowOpenHandler = (handler) => {
    contents.openWindow = handler
  }
  const event = { sender: contents, senderFrame: contents.mainFrame }
  return { ...module.exports, contents, event, calls, handlers, listeners, rendererUrl }
}

test('authenticates only registered main frames showing the exact app document', () => {
  const s = setup()
  assert.throws(() => s.assertTrustedSender(s.event), /trusted/)
  s.secureWindow({ webContents: s.contents })
  assert.doesNotThrow(() => s.assertTrustedSender(s.event))
  assert.throws(() => s.assertTrustedSender({ ...s.event, senderFrame: null }), /trusted/)
  assert.throws(
    () => s.assertTrustedSender({ ...s.event, senderFrame: { ...s.contents.mainFrame } }),
    /trusted/
  )
  for (const url of [
    'https://evil.test/',
    'file:///app/out/renderer/other.html',
    'about:blank',
    'blob:file:///app/out/renderer/index.html',
    'file://evil.test/app/out/renderer/index.html'
  ]) {
    s.contents.mainFrame.url = url
    assert.throws(() => s.assertTrustedSender(s.event), /trusted/)
  }
  s.contents.mainFrame.url = s.rendererUrl
  s.contents.emit('destroyed')
  assert.throws(() => s.assertTrustedSender(s.event), /trusted/)
})

test('development trusts only the configured renderer document', () => {
  const s = setup(true)
  assert.equal(s.isTrustedRendererUrl('http://localhost:5173/?surface=settings-window'), true)
  for (const url of [
    'http://localhost:5173.evil.test/',
    'http://localhost:5174/',
    'http://localhost:5173/evil',
    'file:///app/out/renderer/index.html'
  ]) {
    assert.equal(s.isTrustedRendererUrl(url), false)
  }
})

test('denies navigation, subframe navigation, webviews, and unsafe external schemes', async () => {
  const s = setup()
  s.secureWindow({ webContents: s.contents })
  for (const name of ['will-navigate', 'will-frame-navigate', 'will-attach-webview']) {
    let prevented = false
    s.contents.emit(name, {
      preventDefault: () => {
        prevented = true
      }
    })
    assert.equal(prevented, true)
  }
  for (const url of [
    'file:///tmp/run.exe',
    'javascript:alert(1)',
    'cmd:calc',
    'mailto:person@example.com',
    'not a url'
  ]) {
    await assert.rejects(s.openExternalWebUrl(url))
    assert.equal(s.contents.openWindow({ url }).action, 'deny')
  }
  await s.openExternalWebUrl('https://example.com/')
  await s.openExternalWebUrl('http://example.com/')
  assert.deepEqual(s.calls, ['https://example.com/', 'http://example.com/'])
})

test('all registered invokes and events reject untrusted callers before executing', () => {
  const s = setup()
  let calls = 0
  s.trustedIpcMain.handle('read', () => ++calls)
  s.trustedIpcMain.on('write', () => ++calls)
  assert.throws(() => s.handlers.get('read')(s.event), /trusted/)
  s.listeners.get('write')(s.event)
  assert.equal(calls, 0)
  s.secureWindow({ webContents: s.contents })
  assert.equal(s.handlers.get('read')(s.event), 1)
  s.listeners.get('write')(s.event)
  assert.equal(calls, 2)
})
