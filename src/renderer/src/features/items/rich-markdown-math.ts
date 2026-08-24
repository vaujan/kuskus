import { Fragment } from '@milkdown/prose/model'
import { nodeRule } from '@milkdown/prose'
import type { MilkdownPlugin } from '@milkdown/ctx'
import { $ctx, $inputRule, $nodeSchema, $remark } from '@milkdown/utils'
import katex, { type KatexOptions } from 'katex'
import remarkMath from 'remark-math'

export const richMarkdownKatexOptions = $ctx<KatexOptions, 'richMarkdownKatexOptions'>(
  { throwOnError: false },
  'richMarkdownKatexOptions'
)

const remarkMathPlugin = $remark<'remarkMath', undefined>('remarkMath', () => remarkMath)

const mathInlineSchema = $nodeSchema('math_inline', (ctx) => ({
  group: 'inline',
  content: 'text*',
  inline: true,
  atom: true,
  parseDOM: [
    {
      tag: 'span[data-rich-math="inline"]',
      getContent: (dom, schema) =>
        Fragment.from(schema.text((dom as HTMLElement).dataset.value ?? ''))
    }
  ],
  toDOM: (node) => {
    const dom = document.createElement('span')
    dom.dataset.richMath = 'inline'
    dom.dataset.value = node.textContent
    katex.render(node.textContent, dom, ctx.get(richMarkdownKatexOptions.key))
    return dom
  },
  parseMarkdown: {
    match: (node) => node.type === 'inlineMath',
    runner: (state, node, type) => {
      state
        .openNode(type)
        .addText(node.value as string)
        .closeNode()
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'math_inline',
    runner: (state, node) => state.addNode('inlineMath', undefined, node.textContent)
  }
}))

const mathBlockSchema = $nodeSchema('math_block', (ctx) => ({
  content: 'text*',
  group: 'block',
  marks: '',
  defining: true,
  atom: true,
  isolating: true,
  attrs: { value: { default: '' } },
  parseDOM: [
    {
      tag: 'div[data-rich-math="block"]',
      getAttrs: (dom) => ({ value: (dom as HTMLElement).dataset.value ?? '' })
    }
  ],
  toDOM: (node) => {
    const dom = document.createElement('div')
    dom.dataset.richMath = 'block'
    dom.dataset.value = node.attrs.value
    katex.render(node.attrs.value, dom, {
      ...ctx.get(richMarkdownKatexOptions.key),
      displayMode: true
    })
    return dom
  },
  parseMarkdown: {
    match: (node) => node.type === 'math',
    runner: (state, node, type) => state.addNode(type, { value: node.value as string })
  },
  toMarkdown: {
    match: (node) => node.type.name === 'math_block',
    runner: (state, node) => state.addNode('math', undefined, node.attrs.value)
  }
}))

const mathInlineInputRule = $inputRule((ctx) =>
  nodeRule(/(?:\$)([^$]+)(?:\$)$/, mathInlineSchema.type(ctx), {
    beforeDispatch: ({ tr, match, start }) => tr.insertText(match[1] ?? '', start + 1)
  })
)

export const richMarkdownMath: MilkdownPlugin[] = [
  remarkMathPlugin,
  richMarkdownKatexOptions,
  mathInlineSchema,
  mathBlockSchema,
  mathInlineInputRule
].flat()
