import { Plugin } from '@milkdown/prose/state'
import type { EditorView } from '@milkdown/prose/view'
import { undo, redo } from '@milkdown/prose/history'
import { sinkListItem, liftListItem } from '@milkdown/prose/schema-list'
import { $prose } from '@milkdown/utils'
import { createVimPlugin, getVimStateFromEditorState } from 'vim-prosemirror'
import 'vim-prosemirror/style.css'
import type { NoteVimMode } from '@/features/items/note-vim-mode'

export function richMarkdownVim(
  onModeChange: (mode: NoteVimMode | null) => void
): Array<ReturnType<typeof $prose>> {
  const holder: { view: EditorView | null } = { view: null }
  let lastMode: NoteVimMode | null = null

  const publish = (view: EditorView): void => {
    const vim = getVimStateFromEditorState(view.state)
    const mode: NoteVimMode | null = vim ? vim.mode : null
    if (mode === lastMode) return
    lastMode = mode
    onModeChange(mode)
  }

  const commands = {
    undo: () => {
      const view = holder.view
      return view ? undo(view.state, view.dispatch) : false
    },
    redo: () => {
      const view = holder.view
      return view ? redo(view.state, view.dispatch) : false
    },
    indent: () => {
      const view = holder.view
      if (!view) return false
      const listItem = view.state.schema.nodes.list_item
      return listItem ? sinkListItem(listItem)(view.state, view.dispatch, view) : false
    },
    outdent: () => {
      const view = holder.view
      if (!view) return false
      const listItem = view.state.schema.nodes.list_item
      return listItem ? liftListItem(listItem)(view.state, view.dispatch, view) : false
    }
  }

  return [
    $prose(() => createVimPlugin(commands)),
    $prose(
      () =>
        new Plugin({
          view: (view) => {
            holder.view = view
            publish(view)
            return {
              update: (view) => publish(view),
              destroy: () => {
                holder.view = null
                lastMode = null
              }
            }
          }
        })
    )
  ]
}
