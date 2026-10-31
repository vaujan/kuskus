const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { runInNewContext } = require('node:vm')
const test = require('node:test')
const ts = require('typescript')

const source = ts.createSourceFile(
  'workspace.tsx',
  readFileSync(require.resolve('../src/renderer/src/features/library/workspace.tsx'), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
)
let handler
// Exercise the actual event handler without mounting the full Electron workspace.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'handleCreateShortcut') {
    handler = node.getText(source)
  }
  ts.forEachChild(node, visit)
}
visit(source)
assert.ok(handler)
const script = ts.transpileModule(`const ${handler}; module.exports = handleCreateShortcut`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText

for (const platform of ['darwin', 'win32', 'linux']) {
  test(`creation shortcuts use the advertised modifier on ${platform}`, () => {
    const actions = []
    let dialogOpen = false
    class Element {
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      closest() {
        return this
      }
    }
    const moduleValue = { exports: {} }
    runInNewContext(script, {
      module: moduleValue,
      window: { electron: { window: { platform } } },
      document: { querySelector: () => (dialogOpen ? {} : null) },
      Element,
      openNewNote: () => actions.push('note'),
      openComposer: () => actions.push('item')
    })
    const handle = moduleValue.exports
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const event = (overrides = {}) => ({
      key: 'n',
      ctrlKey: platform !== 'darwin',
      metaKey: platform === 'darwin',
      altKey: false,
      shiftKey: false,
      defaultPrevented: false,
      target: null,
      preventDefault() {
        this.defaultPrevented = true
      },
      ...overrides
    })
    for (const shiftKey of [false, true]) {
      const input = event({ key: shiftKey ? 'N' : 'n', shiftKey })
      handle(input)
      assert.equal(input.defaultPrevented, true)
    }
    assert.deepEqual(actions, ['note', 'item'])
    for (const overrides of [
      { ctrlKey: false, metaKey: false },
      { ctrlKey: true, metaKey: true },
      { ctrlKey: platform === 'darwin', metaKey: platform !== 'darwin' },
      { altKey: true },
      { key: 'x' },
      { defaultPrevented: true },
      { target: new Element() }
    ]) {
      handle(event(overrides))
    }
    dialogOpen = true
    handle(event())
    assert.deepEqual(actions, ['note', 'item'])
  })
}
