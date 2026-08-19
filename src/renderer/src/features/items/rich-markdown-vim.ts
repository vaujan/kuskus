import type { Node as ProseNode } from '@milkdown/prose/model'
import { Plugin } from '@milkdown/prose/state'
import type { EditorView } from '@milkdown/prose/view'
import { undo, redo } from '@milkdown/prose/history'
import { sinkListItem, liftListItem } from '@milkdown/prose/schema-list'
import { $prose } from '@milkdown/utils'
import { createVimPlugin, getVimStateFromEditorState } from 'vim-prosemirror'
import 'vim-prosemirror/style.css'
import type { NoteVimMode } from '@/features/items/note-vim-mode'

export interface RichMarkdownVimActions {
  write: () => void
  quit: () => void
}

interface Substitution {
  from: number
  to: number
  text: string
}

interface ParsedSubstitute {
  whole: boolean
  pattern: string
  replacement: string
  flags: string
}

function parseSubstituteCommand(input: string): ParsedSubstitute | null {
  let rest = input
  const whole = rest.startsWith('%')
  if (whole) rest = rest.slice(1)
  if (rest[0] !== 's') return null
  rest = rest.slice(1)
  const delimiter = rest[0]
  if (!delimiter || /[a-zA-Z0-9]/.test(delimiter)) return null
  rest = rest.slice(1)
  const parts: string[] = []
  let current = ''
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i]
    if (ch === '\\' && rest[i + 1] === delimiter) {
      current += delimiter
      i++
      continue
    }
    if (ch === delimiter) {
      parts.push(current)
      current = ''
      continue
    }
    current += ch
  }
  parts.push(current)
  if (parts.length < 2) return null
  return {
    whole,
    pattern: parts[0],
    replacement: parts[1],
    flags: parts.slice(2).join('')
  }
}

function collectSubstitutions(
  doc: ProseNode,
  from: number,
  to: number,
  regex: RegExp,
  replacement: string,
  global: boolean
): Substitution[] {
  const result: Substitution[] = []
  let lineDone = false
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock) {
      lineDone = false
      return true
    }
    if (lineDone) return false
    if (!node.isText) return true
    const text = node.text ?? ''
    const re = new RegExp(regex.source, regex.flags)
    let match: RegExpExecArray | null
    while ((match = re.exec(text)) !== null) {
      if (match[0].length === 0) {
        re.lastIndex++
        continue
      }
      result.push({
        from: pos + match.index,
        to: pos + match.index + match[0].length,
        text: replacement
      })
      if (!global) {
        lineDone = true
        return false
      }
    }
    return true
  })
  return result
}

function executeSubstitute(view: EditorView, command: string): string {
  const parsed = parseSubstituteCommand(command)
  if (!parsed) return 'Not an editor command'
  if (!parsed.pattern) return 'No pattern given'
  let regex: RegExp
  try {
    regex = new RegExp(parsed.pattern, `g${parsed.flags.includes('i') ? 'i' : ''}`)
  } catch {
    return 'Invalid pattern'
  }
  const global = parsed.flags.includes('g')
  const doc = view.state.doc
  let from = 0
  let to = doc.content.size
  if (!parsed.whole) {
    const $pos = view.state.selection.$head
    from = $pos.before($pos.depth)
    to = $pos.after($pos.depth)
  }
  const substitutions = collectSubstitutions(doc, from, to, regex, parsed.replacement, global)
  if (substitutions.length === 0) return 'Pattern not found'
  substitutions.sort((a, b) => b.from - a.from)
  let tr = view.state.tr
  for (const sub of substitutions) {
    tr = tr.insertText(sub.text, sub.from, sub.to)
  }
  view.dispatch(tr)
  return ''
}

export function richMarkdownVim(
  onModeChange: (mode: NoteVimMode | null) => void,
  actions: RichMarkdownVimActions
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
    $prose(() => createVimExModePlugin(actions)),
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

function createVimExModePlugin(actions: RichMarkdownVimActions): Plugin {
  let active = false
  let buffer = ':'
  let message = ''
  let bar: HTMLDivElement | null = null
  let inputEl: HTMLSpanElement | null = null

  const render = (): void => {
    if (!bar || !inputEl) return
    if (active) {
      bar.style.display = 'flex'
      inputEl.textContent = buffer.slice(1)
    } else if (message) {
      bar.style.display = 'flex'
      inputEl.textContent = message
    } else {
      bar.style.display = 'none'
    }
  }

  const execute = (view: EditorView, command: string): void => {
    const trimmed = command.trim()
    if (trimmed === 'w') {
      actions.write()
      return
    }
    if (trimmed === 'q' || trimmed === 'q!') {
      actions.quit()
      return
    }
    if (trimmed === 'wq' || trimmed === 'wq!' || trimmed === 'x') {
      actions.write()
      actions.quit()
      return
    }
    if (trimmed === 'noh') {
      const vim = getVimStateFromEditorState(view.state)
      if (vim) {
        vim.searchHighlightsVisible = false
        view.dispatch(view.state.tr)
      }
      return
    }
    message = executeSubstitute(view, trimmed)
    render()
  }

  return new Plugin({
    view: (view) => {
      bar = document.createElement('div')
      bar.className = 'vim-ex-bar'
      bar.style.display = 'none'
      const prefix = document.createElement('span')
      prefix.className = 'vim-ex-prefix'
      prefix.textContent = ':'
      inputEl = document.createElement('span')
      inputEl.className = 'vim-ex-input'
      const cursor = document.createElement('span')
      cursor.className = 'vim-ex-cursor'
      cursor.textContent = '\u2588'
      bar.append(prefix, inputEl, cursor)
      view.dom.parentNode?.insertBefore(bar, view.dom.nextSibling)
      return {
        update: () => render(),
        destroy: () => {
          bar?.remove()
          bar = null
          inputEl = null
        }
      }
    },
    props: {
      handleKeyDown(view, event) {
        const vim = getVimStateFromEditorState(view.state)
        if (!active) {
          if (event.key === ':' && vim?.mode === 'normal') {
            active = true
            buffer = ':'
            message = ''
            render()
            return true
          }
          if (message && (event.key === 'Escape' || (event.ctrlKey && event.key === 'c'))) {
            message = ''
            render()
            return true
          }
          return false
        }
        if (event.key === 'Escape' || (event.ctrlKey && event.key === 'c')) {
          active = false
          buffer = ':'
          render()
          return true
        }
        if (event.key === 'Enter') {
          const command = buffer.slice(1)
          active = false
          execute(view, command)
          render()
          return true
        }
        if (event.key === 'Backspace') {
          if (buffer.length > 1) buffer = buffer.slice(0, -1)
          render()
          return true
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          buffer += event.key
          render()
          return true
        }
        return true
      }
    }
  })
}
