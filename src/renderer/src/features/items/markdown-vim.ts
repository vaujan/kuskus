import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { getCM, Vim, vim } from '@replit/codemirror-vim'
import type { NoteVimMode } from '@/features/items/note-vim-mode'
import { parseNoteVimMode } from '@/features/items/note-vim-mode'

export const markdownVim: Extension = vim()

export interface MarkdownVimActions {
  write: () => void
  quit: () => void
}

const vimActions = new WeakMap<EditorView, MarkdownVimActions>()

// defineEx registers into the module-global vim engine; handlers route to the
// view that issued the command through the per-view action registry.
Vim.defineEx('write', 'w', (cm) => {
  vimActions.get(cm.cm6)?.write()
})
Vim.defineEx('quit', 'q', (cm) => {
  vimActions.get(cm.cm6)?.quit()
})

export function registerMarkdownVimActions(view: EditorView, actions: MarkdownVimActions): void {
  vimActions.set(view, actions)
}

export function unregisterMarkdownVimActions(view: EditorView): void {
  vimActions.delete(view)
}

const modeListenerCleanups = new WeakMap<EditorView, () => void>()

export function wireMarkdownVimMode(
  view: EditorView,
  onModeChange: (mode: NoteVimMode | null) => void
): void {
  if (modeListenerCleanups.has(view)) return
  const cm = getCM(view)
  if (!cm) return
  const handle = (event: { mode: string; subMode?: string }): void => {
    onModeChange(parseNoteVimMode(event.mode, event.subMode))
  }
  cm.on('vim-mode-change', handle)
  modeListenerCleanups.set(view, () => cm.off('vim-mode-change', handle))
}

export function unwireMarkdownVimMode(view: EditorView): void {
  modeListenerCleanups.get(view)?.()
  modeListenerCleanups.delete(view)
}
