import { Plugin } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { $prose } from '@milkdown/utils'

export const richMarkdownActiveLine = $prose(
  () =>
    new Plugin({
      props: {
        decorations: (state) => {
          const selection = state.selection
          if (!selection.empty) return null
          const cursor = selection.$head
          let depth = cursor.depth
          while (depth > 0 && !cursor.node(depth).isTextblock) depth -= 1
          if (depth === 0) return null
          return DecorationSet.create(state.doc, [
            Decoration.node(cursor.before(depth), cursor.after(depth), {
              class: 'kuskus-rich-active-line'
            })
          ])
        }
      }
    })
)
