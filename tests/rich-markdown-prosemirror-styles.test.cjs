const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')

test('live editor ships the prosemirror base stylesheet guarding widget separators', () => {
  const editor = readFileSync(
    require.resolve('../src/renderer/src/features/items/rich-markdown-editor.tsx'),
    'utf8'
  )
  assert.match(editor, /import '@milkdown\/prose\/view\/style\/prosemirror\.css'/)

  // Without this guard, generic img rules (Tailwind preflight sets display: block)
  // turn the separator img around the vim end-of-line block cursor into a
  // line-breaking block, rendering a stray empty line next to the caret.
  const prosemirrorCss = readFileSync(
    require.resolve('@milkdown/prose/view/style/prosemirror.css'),
    'utf8'
  )
  assert.match(prosemirrorCss, /img\.ProseMirror-separator\s*\{\s*display: inline !important/)

  // The override must follow prosemirror.css in the same chunk to keep code blocks
  // non-wrapping (typeset.css gives them horizontal scrolling instead).
  const override = readFileSync(
    require.resolve('../src/renderer/src/assets/rich-markdown-editor.css'),
    'utf8'
  )
  assert.match(override, /\.kuskus-rich-document pre\s*\{[^}]*white-space: pre/)
})
