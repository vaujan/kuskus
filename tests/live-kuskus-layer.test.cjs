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
const {
  markdownFrontmatter
} = require('../src/renderer/src/features/items/markdown-frontmatter.ts')

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
    if (value.spec.widget)
      decorations.push({ from, to, widget: value.spec.widget.constructor.name })
  })
  assert.equal(decorations[0]?.widget, 'MarkdownImageBlockWidget')
  // The block widget sits at the end of the image's line (side: 1) — it
  // never replaces the source range, so atomic's inline hide can coexist.
  assert.equal(decorations[0]?.from, state.doc.line(3).to)
})

test('loads remote markdown images directly in Live mode', () => {
  const source = readFileSync(
    require.resolve('../src/renderer/src/features/items/live/live-preview.ts'),
    'utf8'
  )
  assert.match(source, /const remote = \/\^https\?:\\\/\\\//)
  assert.match(source, /this\.resolution\?\.src \?\? \(remote \? this\.target : null\)/)
  assert.match(source, /image\.referrerPolicy = 'no-referrer'/)
})

test('renders inactive Mermaid fences as diagrams in Live mode', () => {
  const state = createState(['Cursor', '', '```mermaid', 'graph TD; A-->B', '```'].join('\n'))
  const widgets = []
  buildKuskusLiveDecorations(state, {}).between(0, state.doc.length, (_from, _to, value) => {
    if (value.spec.widget) widgets.push(value.spec.widget.constructor.name)
  })
  assert.deepEqual(widgets, ['MermaidWidget'])
})

test('skips table images that atomic renders in-cell', () => {
  const state = createState(
    ['Cursor', '', '| A | B |', '| --- | --- |', '| ![x](./x.png) | y |'].join('\n')
  )
  const decorations = []
  buildKuskusImageBlocks(state, {}).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.widget)
      decorations.push({ from, to, widget: value.spec.widget.constructor.name })
  })
  assert.deepEqual(decorations, [])
})

/** @returns {import('@codemirror/state').EditorState} */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createState(doc) {
  return EditorState.create({ doc, extensions: [markdown({ extensions: GFM })] })
}

test('renders inactive math with KaTeX and reveals active block source', () => {
  const state = createState(
    ['Cursor', '', 'Intro $x^2$ text', '', '$$', '\\int_0^1 x \\, dx', '$$'].join('\n')
  )
  const widgets = []
  buildKuskusLiveDecorations(state, {}).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.widget) widgets.push(value.spec.widget.constructor.name)
    void from
    void to
  })
  assert.deepEqual(widgets, ['MathWidget', 'MathWidget'])

  const activeDoc = ['$$', 'x^2', '$$'].join('\n')
  const active = EditorState.create({
    doc: activeDoc,
    selection: { anchor: activeDoc.indexOf('x') },
    extensions: [markdown({ extensions: GFM })]
  })
  let activeMathWidgets = 0
  buildKuskusLiveDecorations(active, {}).between(0, active.doc.length, (_from, _to, value) => {
    if (value.spec.widget?.constructor.name === 'MathWidget') activeMathWidgets += 1
  })
  assert.equal(activeMathWidgets, 0)
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
  assert.equal(
    decorations.some((entry) => entry.className === 'cm-kuskus-wikilink'),
    true
  )
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
    if (value.spec.widget)
      decorations.push({ from, to, widget: value.spec.widget.constructor.name })
  })
  assert.equal(decorations[0]?.widget, 'WikilinkImageWidget')
  assert.equal(decorations[0]?.from, state.doc.toString().indexOf('![[image'))
})

test('moves an inactive code block bottom edge onto its final code line', () => {
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
    decorations.some(
      (entry) => entry.className === 'cm-kuskus-code-last' && entry.from === state.doc.line(4).from
    ),
    true
  )
  assert.equal(
    decorations.some(
      (entry) =>
        entry.className === 'cm-kuskus-code-closer' && entry.from === state.doc.line(5).from
    ),
    true
  )
})

test('renders an inactive fence header widget (language + copy) replacing the first line', () => {
  const state = createState(['Cursor', '', '```ts', 'const a = 1', '```'].join('\n'))
  const decorations = []
  buildKuskusLiveDecorations(state, {}).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.widget) decorations.push({ from, to, widget: value.spec.widget })
  })
  // No selection → no active lines → the header widget replaces the first
  // fence line so the block reads as read mode's code card.
  assert.equal(decorations.length, 1)
  assert.equal(decorations[0].widget.constructor.name, 'CodeBlockHeaderWidget')
  assert.equal(decorations[0].from, state.doc.toString().indexOf('```ts'))
  assert.equal(decorations[0].to, state.doc.line(3).to)
})

test('keeps the fence header off active lines so the user can edit fence marks', () => {
  const doc = ['Cursor', '', '```ts', 'const a = 1', '```'].join('\n')
  const state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: GFM })],
    selection: { anchor: doc.indexOf('const a = 1') + 5 }
  })
  const decorations = []
  buildKuskusLiveDecorations(state, {}).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.widget) decorations.push({ from, to, widget: value.spec.widget })
  })
  // Cursor inside the block → active → no header (raw fence stays editable).
  assert.deepEqual(decorations, [])
})

test('keeps the closing fence at normal height while the code block is active', () => {
  const doc = ['Cursor', '', '```ts', 'const a = 1', '```'].join('\n')
  const state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: GFM })],
    selection: { anchor: doc.indexOf('const a = 1') + 5 }
  })
  const decorations = []
  buildKuskusLiveDecorations(state, {}).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.class) decorations.push({ from, className: value.spec.class })
  })
  assert.equal(
    decorations.some(
      (entry) => entry.className === 'cm-kuskus-code-last' && entry.from === state.doc.line(5).from
    ),
    true
  )
  assert.equal(
    decorations.some((entry) => entry.className === 'cm-kuskus-code-closer'),
    false
  )
})

test('marks blank lines so live rhythm matches the read typeset flow', () => {
  const state = createState(['Cursor', '', 'Para one', '', 'Para two'].join('\n'))
  const decorations = []
  buildKuskusLiveDecorations(state, {}).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.class) decorations.push({ from, className: value.spec.class })
  })
  assert.equal(decorations.filter((entry) => entry.className === 'cm-kuskus-blank').length, 2)
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

test('renders inactive frontmatter with the same header and line shell as a code block', () => {
  const doc = ['---', 'title: hi', 'tags:', '  - one', '---', 'Body'].join('\n')
  // Cursor in the body (outside the frontmatter) → inactive card.
  const state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM, markdownFrontmatter] })],
    selection: { anchor: doc.indexOf('Body') + 2 }
  })
  const decorations = []
  buildKuskusLiveDecorations(state, {}).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.widget) decorations.push({ from, to, widget: value.spec.widget })
  })
  const header = decorations.find(
    (entry) => entry.widget.constructor.name === 'CodeBlockHeaderWidget'
  )
  assert.equal(Boolean(header), true)
  assert.equal(header.from, 0) // replaces the opening `---` line
  assert.equal(header.to, state.doc.toString().indexOf('\n'))

  const lineClasses = []
  buildKuskusLiveDecorations(state, {}).between(0, state.doc.length, (from, _to, value) => {
    if (value.spec.class) lineClasses.push({ from, className: value.spec.class })
  })
  assert.equal(
    lineClasses.some(
      (entry) =>
        entry.from === state.doc.line(2).from && entry.className === 'cm-atomic-fenced-code'
    ),
    true
  )
  assert.equal(
    lineClasses.some(
      (entry) => entry.from === state.doc.line(4).from && entry.className === 'cm-kuskus-code-last'
    ),
    true
  )
})

test('keeps the frontmatter raw when the cursor is inside the block', () => {
  const doc = ['---', 'title: hi', 'tags:', '  - one', '---', 'Body'].join('\n')
  const state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM, markdownFrontmatter] })],
    selection: { anchor: doc.indexOf('title: hi') + 2 }
  })
  const decorations = []
  buildKuskusLiveDecorations(state, {}).between(0, state.doc.length, (from, to, value) => {
    if (value.spec.widget || value.spec.replace) decorations.push({ from, to })
  })
  // Active → no header widget, no delimiter hides → no replaces at all.
  assert.deepEqual(decorations, [])
})
