import { commandsCtx, type Editor } from '@milkdown/core'
import { setBlockType, wrapIn } from '@milkdown/prose/commands'
import { wrapInList } from '@milkdown/prose/schema-list'
import type { EditorState } from '@milkdown/prose/state'
import { Plugin } from '@milkdown/prose/state'
import type { EditorView } from '@milkdown/prose/view'
import { $prose } from '@milkdown/utils'

import { findRichMarkdownSlashQuery } from '@/features/items/rich-markdown-slash'

export interface RichMarkdownSlashState {
  query: string
  from: number
  to: number
  left: number
  top: number
  selected: number
}

export const richMarkdownSlashCommands = [
  { id: 'text', label: 'Text', syntax: null },
  { id: 'heading-1', label: 'Heading 1', syntax: '#' },
  { id: 'heading-2', label: 'Heading 2', syntax: '##' },
  { id: 'heading-3', label: 'Heading 3', syntax: '###' },
  { id: 'bullet-list', label: 'Bulleted list', syntax: '-' },
  { id: 'numbered-list', label: 'Numbered list', syntax: '1.' },
  { id: 'quote', label: 'Quote', syntax: '>' },
  { id: 'code', label: 'Code block', syntax: '```' },
  { id: 'divider', label: 'Divider', syntax: '---' },
  { id: 'table', label: 'Table', syntax: null }
] as const

export type RichMarkdownSlashCommandId = (typeof richMarkdownSlashCommands)[number]['id']

export function filteredRichMarkdownSlashCommands(
  query: string
): (typeof richMarkdownSlashCommands)[number][] {
  const normalized = query.toLowerCase()
  return richMarkdownSlashCommands.filter(({ label }) => label.toLowerCase().includes(normalized))
}

function currentSlashState(
  state: EditorState
): Pick<RichMarkdownSlashState, 'query' | 'from' | 'to'> | null {
  if (!state.selection.empty) return null
  const cursor = state.selection.$from
  if (!cursor.parent.isTextblock) return null
  const text = cursor.parent.textBetween(0, cursor.parentOffset, undefined, '\ufffc')
  const query = findRichMarkdownSlashQuery(text)
  if (query === null) return null
  return { query, from: cursor.pos - query.length - 1, to: cursor.pos }
}

type MilkdownCtx = Parameters<Parameters<Editor['action']>[0]>[0]

export function runRichMarkdownSlashCommand(
  ctx: MilkdownCtx,
  view: EditorView,
  state: RichMarkdownSlashState,
  id: RichMarkdownSlashCommandId
): void {
  const current = currentSlashState(view.state)
  if (
    !current ||
    current.from !== state.from ||
    current.to !== state.to ||
    current.query !== state.query
  ) {
    return
  }
  view.dispatch(view.state.tr.delete(state.from, state.to))
  if (id === 'table') {
    ctx.get(commandsCtx).call('InsertTable', { row: 3, col: 3 })
    view.focus()
    return
  }
  const { schema } = view.state
  const command =
    id === 'text'
      ? setBlockType(schema.nodes.paragraph)
      : id.startsWith('heading-')
        ? setBlockType(schema.nodes.heading, { level: Number(id.at(-1)) })
        : id === 'bullet-list'
          ? wrapInList(schema.nodes.bullet_list)
          : id === 'numbered-list'
            ? wrapInList(schema.nodes.ordered_list)
            : id === 'quote'
              ? wrapIn(schema.nodes.blockquote)
              : id === 'code'
                ? setBlockType(schema.nodes.code_block)
                : null

  if (command) command(view.state, view.dispatch, view)
  else if (id === 'divider' && schema.nodes.horizontal_rule) {
    view.dispatch(
      view.state.tr.replaceSelectionWith(schema.nodes.horizontal_rule.create()).scrollIntoView()
    )
  }
  view.focus()
}

export function richMarkdownSlashMenu(
  update: (state: RichMarkdownSlashState | null) => void,
  run: (state: RichMarkdownSlashState, id: RichMarkdownSlashCommandId) => void,
  enabled: () => boolean
): ReturnType<typeof $prose> {
  return $prose(() => {
    let selected = 0
    let previousQuery = ''
    let dismissed = ''

    const publish = (view: EditorView): RichMarkdownSlashState | null => {
      if (!enabled()) {
        dismissed = ''
        update(null)
        return null
      }
      const match = currentSlashState(view.state)
      if (!match) {
        dismissed = ''
        update(null)
        return null
      }
      const signature = `${match.from}:${match.to}:${match.query}`
      if (signature === dismissed) return null
      if (match.query !== previousQuery) selected = 0
      previousQuery = match.query
      const count = filteredRichMarkdownSlashCommands(match.query).length
      selected = Math.min(selected, Math.max(0, count - 1))
      const rect = view.coordsAtPos(match.from)
      const menuHeight = Math.min(320, 56 + count * 48)
      const state = {
        ...match,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)),
        top: Math.max(
          8,
          window.innerHeight - rect.bottom < menuHeight + 8
            ? rect.top - menuHeight - 6
            : rect.bottom + 6
        ),
        selected
      }
      update(state)
      return state
    }

    return new Plugin({
      view: () => ({
        update: (view) => publish(view),
        destroy: () => update(null)
      }),
      props: {
        // The editor keeps focus while the shadcn command menu mirrors this selection.
        handleKeyDown: (view, event) => {
          const state = publish(view)
          if (!state) return false
          const items = filteredRichMarkdownSlashCommands(state.query)
          if (event.key === 'Escape') {
            dismissed = `${state.from}:${state.to}:${state.query}`
            update(null)
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (!items.length) return false
            selected =
              (selected + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
            publish(view)
          } else if (event.key === 'Enter' && items[selected]) {
            run(state, items[selected].id)
          } else {
            return false
          }
          event.preventDefault()
          return true
        }
      }
    })
  })
}
