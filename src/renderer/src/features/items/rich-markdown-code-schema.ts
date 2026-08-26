import type { Node as ProseNode, Schema } from '@milkdown/prose/model'
import { $node, $nodeSchema } from '@milkdown/utils'

export interface CodeFenceInfo {
  lang: string
  meta: string
}

/** Splits a fence line into its CommonMark info string parts. */
export function parseCodeFenceInfo(text: string): CodeFenceInfo {
  const match = /^`{3,}\s*(.*)$/.exec(text)
  const info = (match?.[1] ?? '').trim()
  const lang = info.split(/\s+/)[0] ?? ''
  return { lang, meta: lang ? info.slice(lang.length).trim() : '' }
}

/** A valid opening fence: 3+ ticks, then an info string without backticks. */
export function isOpenFenceText(text: string): boolean {
  return /^`{3,}[^`]*$/.test(text)
}

/** A valid closing fence: only 3+ ticks. */
export function isCloseFenceText(text: string): boolean {
  return /^`{3,}$/.test(text)
}

export function buildCodeBlockNode(schema: Schema, info: string): ProseNode | null {
  const { code_block: block, code_fence: fence, code_line: line } = schema.nodes
  if (!block || !fence || !line) return null
  return block.create(null, [
    fence.create(null, schema.text('```' + info)),
    line.create(),
    fence.create(null, schema.text('```'))
  ])
}

// Fence and code lines only exist inside a code block; they never appear in
// the markdown AST, so their markdown matchers are inert.
function inertMarkdownIO(): {
  parseMarkdown: { match: () => boolean; runner: () => void }
  toMarkdown: { match: () => boolean; runner: () => void }
} {
  const inert = { match: () => false, runner: () => {} }
  return { parseMarkdown: inert, toMarkdown: inert }
}

export const codeFenceNode = $node('code_fence', () => ({
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  parseDOM: [{ tag: 'div[data-code-fence]', preserveWhitespace: 'full' as const }],
  toDOM: () => ['div', { 'data-code-fence': '', class: 'kuskus-code-fence-line' }, 0],
  ...inertMarkdownIO()
}))

export const codeLineNode = $node('code_line', () => ({
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  parseDOM: [{ tag: 'div[data-code-line]', preserveWhitespace: 'full' as const }],
  toDOM: () => ['div', { 'data-code-line': '', class: 'kuskus-code-line' }, 0],
  ...inertMarkdownIO()
}))

/**
 * Overrides the commonmark code_block so the block contains its own source:
 * an opening fence line (``` + language), the code, and a closing fence —
 * all real textblocks. The fence text is the single source of truth for the
 * language; there is no attribute. Registered after the commonmark preset,
 * whose code_block entry it replaces (upsertById).
 */
export const richMarkdownCodeBlock = $nodeSchema('code_block', () => ({
  content: 'code_fence code_line code_fence',
  group: 'block',
  marks: '',
  defining: true,
  parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' as const }],
  toDOM: () => ['pre', { class: 'kuskus-code-source' }, 0],
  parseMarkdown: {
    match: ({ type }) => type === 'code',
    runner: (state, node, type) => {
      const { code_fence: fence, code_line: line } = state.schema.nodes
      if (!fence || !line) return
      const info = [node.lang ?? '', node.meta ?? ''].filter(Boolean).join(' ')
      state.openNode(type)
      state.openNode(fence)
      state.addText(info ? `\`\`\`${info}` : '```')
      state.closeNode()
      state.openNode(line)
      const value = typeof node.value === 'string' ? node.value : ''
      if (value) state.addText(value)
      state.closeNode()
      state.openNode(fence)
      state.addText('```')
      state.closeNode()
      state.closeNode()
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'code_block',
    runner: (state, node) => {
      const open = node.maybeChild(0)?.textContent ?? ''
      const value = node.maybeChild(1)?.textContent ?? ''
      const { lang, meta } = parseCodeFenceInfo(open)
      state.addNode('code', void 0, value, meta ? { lang, meta } : { lang })
    }
  }
}))
