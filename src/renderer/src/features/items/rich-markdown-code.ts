import type { Node as ProseNode } from '@milkdown/prose/model'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { $prose } from '@milkdown/utils'

import { highlightedCodeRanges } from '@/features/items/markdown-code'
import { parseCodeFenceInfo } from '@/features/items/rich-markdown-code-schema'

const key = new PluginKey<DecorationSet>('rich-markdown-code')

function codeDecorations(doc: ProseNode): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, position) => {
    if (node.type.name !== 'code_block') return
    const open = node.maybeChild(0)
    const line = node.maybeChild(1)
    if (!line) return
    const linePos = position + 1 + (open?.nodeSize ?? 0)
    const { lang } = parseCodeFenceInfo(open?.textContent ?? '')
    for (const range of highlightedCodeRanges(line.textContent, lang)) {
      decorations.push(
        Decoration.inline(linePos + 1 + range.from, linePos + 1 + range.to, {
          class: range.classes
        })
      )
    }
  })
  return DecorationSet.create(doc, decorations)
}

export const richMarkdownCode = $prose(
  () =>
    new Plugin<DecorationSet>({
      key,
      state: {
        init: (_, state) => codeDecorations(state.doc),
        apply: (transaction, decorations) =>
          transaction.docChanged
            ? codeDecorations(transaction.doc)
            : decorations.map(transaction.mapping, transaction.doc)
      },
      props: {
        decorations: (state) => key.getState(state) ?? null
      }
    })
)
