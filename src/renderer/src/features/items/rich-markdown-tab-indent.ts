import { schemaCtx } from '@milkdown/core'
import type { EditorState } from '@milkdown/prose/state'
import { liftListItem, sinkListItem } from '@milkdown/prose/schema-list'
import { $shortcut } from '@milkdown/utils'

function selectionIsInsideList(state: EditorState): boolean {
  const cursor = state.selection.$from
  for (let depth = cursor.depth; depth >= 0; depth -= 1) {
    if (cursor.node(depth).type.name === 'list_item') return true
  }
  return false
}

export const richMarkdownTabIndent = $shortcut((ctx) => {
  const listItemType = ctx.get(schemaCtx).nodes.list_item

  return {
    Tab: (state, dispatch) => {
      if (selectionIsInsideList(state)) {
        sinkListItem(listItemType)(state, dispatch)
        return true
      }
      if (dispatch) dispatch(state.tr.insertText('  '))
      return true
    },
    'Shift-Tab': (state, dispatch) => {
      if (selectionIsInsideList(state)) {
        liftListItem(listItemType)(state, dispatch)
        return true
      }
      return true
    }
  }
})
