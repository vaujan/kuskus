import { commandsCtx, type Editor } from '@milkdown/core'
import { Plugin } from '@milkdown/prose/state'
import type { EditorView as ProseEditorView } from '@milkdown/prose/view'
import {
  CellSelection,
  TableMap,
  deleteColumn,
  deleteRow,
  deleteTable,
  findTable,
  isInTable,
  selectedRect
} from '@milkdown/prose/tables'
import { $prose } from '@milkdown/utils'

export interface RichMarkdownTableToolbarState {
  left: number
  top: number
}

export type RichMarkdownTableAction =
  | 'add-row-before'
  | 'add-row-after'
  | 'add-col-before'
  | 'add-col-after'
  | 'delete-row'
  | 'delete-col'
  | 'delete-table'
  | 'align-left'
  | 'align-center'
  | 'align-right'

const TOOLBAR_WIDTH = 252
const TOOLBAR_HEIGHT = 36
const TOOLBAR_GAP = 8

type MilkdownCtx = Parameters<Parameters<Editor['action']>[0]>[0]

function selectLineInTable(view: ProseEditorView, type: 'row' | 'col'): boolean {
  const { state } = view
  if (!isInTable(state)) return false
  const rect = selectedRect(state)
  const table = findTable(state.selection.$from)
  if (!table) return false
  const map = TableMap.get(table.node)
  const start = table.start
  const first = start + map.positionAt(rect.top, rect.left, table.node)
  const last = start + map.positionAt(rect.bottom - 1, rect.right - 1, table.node)
  const $first = state.doc.resolve(first)
  const $last = state.doc.resolve(last)
  const selection =
    type === 'row'
      ? CellSelection.rowSelection($last, $first)
      : CellSelection.colSelection($last, $first)
  view.dispatch(state.tr.setSelection(selection))
  return true
}

export function runRichMarkdownTableAction(
  view: ProseEditorView,
  ctx: MilkdownCtx,
  action: RichMarkdownTableAction
): void {
  const commands = ctx.get(commandsCtx)
  switch (action) {
    case 'add-row-before':
      commands.call('AddRowBefore')
      break
    case 'add-row-after':
      commands.call('AddRowAfter')
      break
    case 'add-col-before':
      commands.call('AddColBefore')
      break
    case 'add-col-after':
      commands.call('AddColAfter')
      break
    case 'delete-row':
      if (selectLineInTable(view, 'row')) deleteRow(view.state, view.dispatch)
      break
    case 'delete-col':
      if (selectLineInTable(view, 'col')) deleteColumn(view.state, view.dispatch)
      break
    case 'delete-table':
      deleteTable(view.state, view.dispatch)
      break
    case 'align-left':
      commands.call('SetAlign', 'left')
      break
    case 'align-center':
      commands.call('SetAlign', 'center')
      break
    case 'align-right':
      commands.call('SetAlign', 'right')
      break
  }
}

export function richMarkdownTableToolbar(
  update: (state: RichMarkdownTableToolbarState | null) => void,
  enabled: () => boolean
): ReturnType<typeof $prose> {
  return $prose(() => {
    const publish = (view: ProseEditorView): RichMarkdownTableToolbarState | null => {
      if (!enabled()) {
        update(null)
        return null
      }
      const table = findTable(view.state.selection.$from)
      if (!table) {
        update(null)
        return null
      }
      const dom = view.nodeDOM(table.pos)
      if (!(dom instanceof HTMLElement)) {
        update(null)
        return null
      }
      const rect = dom.getBoundingClientRect()
      const left = Math.max(
        8,
        Math.min(rect.right - TOOLBAR_WIDTH, window.innerWidth - TOOLBAR_WIDTH - 8)
      )
      const top = Math.max(8, rect.top - TOOLBAR_HEIGHT - TOOLBAR_GAP)
      const state = { left, top }
      update(state)
      return state
    }

    return new Plugin({
      view: () => ({
        update: (view) => publish(view),
        destroy: () => update(null)
      }),
      props: {
        handleKeyDown: (view) => {
          publish(view)
          return false
        }
      }
    })
  })
}
