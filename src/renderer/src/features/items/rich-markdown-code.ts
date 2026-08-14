import type { Node as ProseNode } from '@milkdown/prose/model'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { $prose } from '@milkdown/utils'

import { highlightedCodeRanges } from '@/features/items/markdown-code'

const key = new PluginKey<DecorationSet>('rich-markdown-code')

function codeDecorations(doc: ProseNode): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, position) => {
    if (node.type.name !== 'code_block') return
    for (const range of highlightedCodeRanges(
      node.textContent,
      String(node.attrs.language ?? '')
    )) {
      decorations.push(
        Decoration.inline(position + 1 + range.from, position + 1 + range.to, {
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
