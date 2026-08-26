// Bundled headless round-trip test for the code_block schema override.
// The whole editor is bundled together so there is exactly one instance of
// every milkdown/prosemirror module. Exposed via window.__SMOKE_RESULTS.
const results: Array<{ name: string; pass: boolean; actual: unknown; expected: unknown }> = []
const check = (name: string, actual: unknown, expected: unknown): void => {
  results.push({
    name,
    pass: JSON.stringify(actual) === JSON.stringify(expected),
    actual,
    expected
  })
}

const TICKS = '```'
import { Editor, rootCtx, defaultValueCtx, serializerCtx, editorViewCtx } from '@milkdown/core'
import { TextSelection } from '@milkdown/prose/state'
import { commonmark } from '@milkdown/preset-commonmark'
import { $prose } from '@milkdown/utils'
import { createVimPlugin, getVimStateFromEditorState } from 'vim-prosemirror'
import {
  richMarkdownCodeBoundary,
  richMarkdownCodeFenceSync,
  richMarkdownVimCodePerLine
} from '../src/renderer/src/features/items/rich-markdown-code-block'
import {
  codeFenceNode,
  codeLineNode,
  richMarkdownCodeBlock,
  buildCodeBlockNode,
  parseCodeFenceInfo
} from '../src/renderer/src/features/items/rich-markdown-code-schema'

type SmokeEditor = Awaited<ReturnType<typeof boot>>

const boot = async (value: string, ...extra: unknown[]): Promise<SmokeEditor> => {
  const host = document.createElement('div')
  document.body.append(host)
  const editor = Editor.make()
    .use(commonmark)
    .use(codeFenceNode)
    .use(codeLineNode)
    .use(richMarkdownCodeBlock)
    .use(richMarkdownCodeFenceSync)
    .use(richMarkdownCodeBoundary)
    .use(extra as never)
    .config((ctx) => {
      ctx.set(rootCtx, host)
      ctx.set(defaultValueCtx, value)
    })
  await editor.create()
  return editor
}
const serialize = (editor: SmokeEditor): string =>
  editor.action((ctx) => ctx.get(serializerCtx)(ctx.get(editorViewCtx).state.doc))

// 1. Parse shape: fences and code are real text children.
const source = ['before', '', TICKS + 'ts', 'const a = 1', TICKS, '', 'after'].join('\n')
const first = await boot(source)
const doc = first.action((ctx) => ctx.get(editorViewCtx).state.doc)
let block: { child: (index: number) => { textContent: string }; type: { name: string } } | null =
  null
doc.descendants((node) => {
  if (!block && node.type.name === 'code_block') block = node as never
})
check('block found', block?.type.name, 'code_block')
check('open fence text', block?.child(0).textContent, TICKS + 'ts')
check('code text', block?.child(1).textContent, 'const a = 1')
check('close fence text', block?.child(2).textContent, TICKS)

// 2. Markdown round trip.
check('round trip', serialize(first), source + '\n')

// 3. Editing the fence line like text (insert into the code line).
const view = first.action((ctx) => ctx.get(editorViewCtx))
const info = findCodeLineStart(view.state)
if (info != null) {
  const tr = view.state.tr.insertText('x', info, info)
  view.dispatch(tr)
}
check('edit inside code keeps fences', serialize(first).includes(TICKS + 'ts'), true)
await first.destroy()

// 4. A mangled opening fence dissolves the block into paragraphs.
const second = await boot([TICKS + 'ts', 'const a = 1', TICKS].join('\n'))
second.action((ctx) => {
  const v = ctx.get(editorViewCtx)
  v.dispatch(v.state.tr.delete(2, 5))
})
await new Promise((resolve) => setTimeout(resolve, 50))
check(
  'mangle dissolves',
  serialize(second),
  ['ts', '', 'const a = 1', '', '\\`\\`\\`', ''].join('\n')
)
await second.destroy()

// 5. Code containing backticks serializes with a longer fence.
const third = await boot([TICKS + 'js', 'x = ' + TICKS, TICKS].join('\n'))
check('longer fence', /````/.test(serialize(third)), true)
await third.destroy()

// 6. Info strings with meta round trip.
const fourth = await boot([TICKS + 'ts title=app', 'a', TICKS].join('\n'))
check('meta round trip', serialize(fourth), [TICKS + 'ts title=app', 'a', TICKS, ''].join('\n'))
await fourth.destroy()

// 7. Helpers.
check('parse info', parseCodeFenceInfo(TICKS + 'ts title=app'), { lang: 'ts', meta: 'title=app' })
const built = buildCodeBlockNode(view.state.schema, 'js')
check('build node', built?.child(0).textContent, TICKS + 'js')

// 8. vim `o` inside the code opens a code line, not a stray paragraph.
const vimDoc = [TICKS + 'ts', 'const a = 1', TICKS].join('\n')
const fifth = await boot(
  vimDoc,
  richMarkdownVimCodePerLine,
  $prose(() => createVimPlugin({}))
)
const vimView = fifth.action((ctx) => ctx.get(editorViewCtx))
vimView.dispatch(
  vimView.state.tr.setSelection(
    TextSelection.create(vimView.state.doc, findCodeLineStart(vimView.state) ?? 1)
  )
)
vimView.dom.dispatchEvent(
  new KeyboardEvent('keydown', { key: 'o', bubbles: true, cancelable: true })
)
await new Promise((resolve) => setTimeout(resolve, 20))
const vimVim = getVimStateFromEditorState(vimView.state)
check('o enters insert', vimVim?.mode, 'insert')
check('o keeps fences', serialize(fifth), [TICKS + 'ts', 'const a = 1', '', TICKS, ''].join('\n'))
check('o adds no html', serialize(fifth).includes('<'), false)
await fifth.destroy()

// 9. A paragraph smuggled into the block is dissolved instead of serializing it as code.
const sixth = await boot(vimDoc)
sixth.action((ctx) => {
  const v = ctx.get(editorViewCtx)
  const paragraph = v.state.schema.nodes.paragraph.create(null, v.state.schema.text('smuggled'))
  v.dispatch(v.state.tr.insert(20, paragraph))
})
await new Promise((resolve) => setTimeout(resolve, 50))
const repaired = serialize(sixth)
let hasCodeBlock = false
sixth.action((ctx) => {
  ctx.get(editorViewCtx).state.doc.descendants((node: { type: { name: string } }) => {
    if (node.type.name === 'code_block') hasCodeBlock = true
  })
})
check('repair dissolves', hasCodeBlock, false)
check('repair keeps code', repaired.includes('const a = 1'), true)
check('repair keeps smuggled line', repaired.includes('smuggled'), true)
check('repair keeps fences as text', repaired.includes('\\`\\`\\`'), true)
await sixth.destroy()

function findCodeLineStart(state: {
  doc: { descendants: (fn: (node: unknown, pos: number) => void) => void }
}): number | null {
  let found: number | null = null
  state.doc.descendants((node: { type: { name: string } }, pos: number) => {
    if (found == null && node.type.name === 'code_line') found = pos + 1
  })
  return found
}

document.body.innerHTML = ''
window.__SMOKE_RESULTS = results
