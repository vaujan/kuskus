const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true
    },
    fileName: filename
  })
  module._compile(output.outputText, filename)
}

const { markdown } = require('@codemirror/lang-markdown')
const { EditorState } = require('@codemirror/state')
const { GFM } = require('@lezer/markdown')
const {
  buildLivePreviewDecorations,
  codeBlockEntryPosition
} = require('../src/renderer/src/features/items/live/legacy/live-preview-legacy.ts')

test('builds live-preview block decorations outside a view plugin', () => {
  const state = EditorState.create({
    doc: [
      'Intro',
      '',
      '---',
      '',
      '```ts',
      'const stable = true',
      '```',
      '',
      '$$x^2$$',
      '',
      '$$',
      '\\int_0^1 x \\, dx',
      '$$'
    ].join('\n'),
    extensions: [markdown({ extensions: GFM })]
  })

  const blocks = []
  buildLivePreviewDecorations(state, {}).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.block) blocks.push({ from, to })
  })

  assert.equal(blocks.length, 4)
})

test('keyboard navigation enters a rendered code block instead of skipping it', () => {
  const state = EditorState.create({
    doc: ['Above', '', '```ts', 'const value = 1', '```', '', 'Below'].join('\n'),
    extensions: [markdown({ extensions: GFM })]
  })

  assert.equal(
    codeBlockEntryPosition(state, state.doc.line(2).from, state.doc.line(6).from, true),
    state.doc.line(3).from
  )
  assert.equal(
    codeBlockEntryPosition(state, state.doc.line(6).from, state.doc.line(2).from, false),
    state.doc.line(5).from
  )
})

test('uses one list marker column and hides source indentation on inactive lines', () => {
  const state = EditorState.create({
    doc: ['Cursor', '- first', '  continuation', '  - nested'].join('\n'),
    extensions: [markdown({ extensions: GFM })]
  })
  const decorations = []
  buildLivePreviewDecorations(state, {}).between(0, state.doc.length, (from, to, value) => {
    decorations.push({ from, to, className: value.spec.class })
  })

  assert.equal(
    decorations.some((entry) => entry.className?.includes('cm-kuskus-list-depth-2')),
    true
  )
  assert.deepEqual(
    decorations.filter((entry) => entry.className === 'cm-kuskus-list-source-indent'),
    [
      {
        from: state.doc.line(3).from,
        to: state.doc.line(3).from + 2,
        className: 'cm-kuskus-list-source-indent'
      },
      {
        from: state.doc.line(4).from,
        to: state.doc.line(4).from + 2,
        className: 'cm-kuskus-list-source-indent'
      }
    ]
  )
})

test('renders inactive task lists without duplicate bullets and replaces whole fenced blocks', () => {
  const state = EditorState.create({
    doc: ['Cursor', '', '- [ ] Task', '', '```ts', 'const value = 1', '```'].join('\n'),
    extensions: [markdown({ extensions: GFM })]
  })
  const decorations = []
  buildLivePreviewDecorations(state, {}).between(0, state.doc.length, (from, to, value) => {
    decorations.push({ from, to, widget: value.spec.widget?.constructor.name })
  })

  assert.equal(
    decorations.some((entry) => entry.widget === 'BulletWidget'),
    false
  )
  assert.equal(
    decorations.some((entry) => entry.widget === 'CheckboxWidget'),
    true
  )
  assert.deepEqual(
    decorations.find((entry) => entry.widget === 'CodeBlockWidget'),
    { from: state.doc.line(5).from, to: state.doc.length, widget: 'CodeBlockWidget' }
  )
})
