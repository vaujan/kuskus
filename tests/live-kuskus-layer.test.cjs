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
  buildKuskusLiveDecorations,
  buildKuskusImageBlocks
} = require('../src/renderer/src/features/items/live/live-preview.ts')

test('renders standard markdown images as block widgets below the source line', () => {
  const state = createState(['Cursor', '', '![photo](./assets/photo.png)'].join('\n'))
  const decorations = []
  buildKuskusImageBlocks(state, {
    resolveImage: () => ({
      src: 'file:///photo.png',
      missing: false,
      label: 'photo.png',
      width: 200,
      height: 100
    })
  }).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.widget) decorations.push({ from, to, widget: value.spec.widget.constructor.name })
  })
  assert.equal(decorations[0]?.widget, 'MarkdownImageBlockWidget')
  // The block widget sits at the end of the image's line (side: 1) — it
  // never replaces the source range, so atomic's inline hide can coexist.
  assert.equal(decorations[0]?.from, state.doc.line(3).to)
})

test('skips table images that atomic renders in-cell', () => {
  const state = createState(['Cursor', '', '| A | B |', '| --- | --- |', '| ![x](./x.png) | y |'].join('\n'))
  const decorations = []
  buildKuskusImageBlocks(state, {}).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.widget) decorations.push({ from, to, widget: value.spec.widget.constructor.name })
  })
  assert.deepEqual(decorations, [])
})

function createState(doc) {
  return EditorState.create({ doc, extensions: [markdown({ extensions: GFM })] })
}

test('keeps math as source instead of replacing it with KaTeX widgets', () => {
  const state = createState(
    ['Cursor', '', 'Intro $x^2$ text', '', '$$', '\\int_0^1 x \\, dx', '$$'].join('\n')
  )
  // No widget may cover the math ranges — the user asked for source math
  // in live mode (no hidden KaTeX, no forced scrollbar).
  let widgetCount = 0
  buildKuskusLiveDecorations(state, {}).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.widget) widgetCount += 1
    void from
    void to
  })
  assert.equal(widgetCount, 0)
})

test('renders wikilinks with a linked mark and hides brackets', () => {
  const state = createState('Cursor\n\nSee [[Target note]] and [[Other|Alias]]')
  const decorations = []
  buildKuskusLiveDecorations(state, {}).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.class || value.spec.widget) {
      decorations.push({
        from,
        to,
        className: value.spec.class,
        widget: value.spec.widget?.constructor.name
      })
    }
  })
  assert.equal(decorations.some((entry) => entry.className === 'cm-kuskus-wikilink'), true)
  const aliasMark = decorations.find(
    (entry) => entry.className === 'cm-kuskus-wikilink' && entry.from > 30
  )
  assert.equal(aliasMark.from, state.doc.toString().indexOf('Alias'))
})

test('embeds resolved images as widgets through options', () => {
  const state = createState('Cursor\n\n![[image file.png]]')
  const decorations = []
  buildKuskusLiveDecorations(state, {
    resolveImage: () => ({
      src: 'file:///image.png',
      missing: false,
      label: 'image file.png',
      width: 100,
      height: 100
    })
  }).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.widget) decorations.push({ from, to, widget: value.spec.widget.constructor.name })
  })
  assert.equal(decorations[0]?.widget, 'WikilinkImageWidget')
  assert.equal(decorations[0]?.from, state.doc.toString().indexOf('![[image'))
})

test('marks first and last fenced-code lines so the block reads as one container', () => {
  const state = createState(['Cursor', '', '```ts', 'const a = 1', '```'].join('\n'))
  const decorations = []
  buildKuskusLiveDecorations(state, {}).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.class) decorations.push({ from, className: value.spec.class })
  })
  assert.equal(
    decorations.some((entry) => entry.className === 'cm-kuskus-code-first'),
    true
  )
  assert.equal(
    decorations.some((entry) => entry.className === 'cm-kuskus-code-last'),
    true
  )
})

test('marks blank lines so live rhythm matches the read typeset flow', () => {
  const state = createState(['Cursor', '', 'Para one', '', 'Para two'].join('\n'))
  const decorations = []
  buildKuskusLiveDecorations(state, {}).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.class) decorations.push({ from, className: value.spec.class })
  })
  assert.equal(
    decorations.filter((entry) => entry.className === 'cm-kuskus-blank').length,
    2
  )
})

test('does not duplicate replacement ranges owned by atomic preview', () => {
  // Horizontal rules, headings, lists, tasks are atomic's; the Kuskus
  // layer only adds math, wikilinks, and embed images. Replacing the
  // same ranges twice would make CM6 throw.
  const state = createState(['Cursor', '', '---', '', '## Heading', '', '- [ ] Task'].join('\n'))
  const decorations = []
  buildKuskusLiveDecorations(state, {}).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.replace) decorations.push({ from, to })
  })
  assert.deepEqual(decorations, [])
})
