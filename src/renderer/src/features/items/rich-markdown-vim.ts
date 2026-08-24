import type { Node as ProseNode } from '@milkdown/prose/model'
import { Plugin } from '@milkdown/prose/state'
import type { EditorView } from '@milkdown/prose/view'
import { undo, redo } from '@milkdown/prose/history'
import { sinkListItem, liftListItem } from '@milkdown/prose/schema-list'
import { $prose } from '@milkdown/utils'
import type { RefObject } from 'react'
import { createVimPlugin, getVimStateFromEditorState } from 'vim-prosemirror'
import 'vim-prosemirror/style.css'
import type { NoteVimMode } from '@/features/items/note-vim-mode'

export interface RichMarkdownVimActions {
  write: () => void
  quit: () => void
}

export interface RichMarkdownVimHandlers {
  onModeChange: (mode: NoteVimMode | null) => void
  commandLineHost: RefObject<HTMLElement | null>
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

/**
 * Renders the live editor's vim command line ('/' search prompt, ':' ex prompt,
 * transient status messages) into the status-bar host element owned by the note
 * detail surface. The library's own in-document search bar stays hidden; this
 * mirror is the only visible prompt. `owner` keeps the ex plugin and the
 * per-transaction search/status sync from clobbering each other's rows.
 */
function createCommandLineMirror(hostRef: RefObject<HTMLElement | null>): {
  prompt: (owner: 'search' | 'ex', promptText: string, value: string) => void
  message: (owner: 'search' | 'ex', text: string) => void
  clear: (owner: 'search' | 'ex') => void
} {
  let owner: 'search' | 'ex' | null = null
  let promptRow: HTMLDivElement | null = null
  let promptText: HTMLSpanElement | null = null
  let promptValue: HTMLSpanElement | null = null
  let messageRow: HTMLSpanElement | null = null

  const ensurePromptRow = (): HTMLDivElement => {
    if (promptRow) return promptRow
    promptRow = document.createElement('div')
    promptRow.className = 'kuskus-vim-cmdline'
    promptText = document.createElement('span')
    promptText.className = 'kuskus-vim-cmdline-prompt'
    promptValue = document.createElement('span')
    promptValue.className = 'kuskus-vim-cmdline-input'
    const cursor = document.createElement('span')
    cursor.className = 'kuskus-vim-cmdline-cursor'
    cursor.textContent = '\u2588'
    promptRow.append(promptText, promptValue, cursor)
    return promptRow
  }

  const ensureMessageRow = (): HTMLSpanElement => {
    if (messageRow) return messageRow
    messageRow = document.createElement('span')
    messageRow.className = 'kuskus-vim-cmdline-message'
    return messageRow
  }

  return {
    prompt(nextOwner, prompt, value): void {
      const host = hostRef.current
      if (!host) return
      owner = nextOwner
      const row = ensurePromptRow()
      if (promptText!.textContent !== prompt) promptText!.textContent = prompt
      if (promptValue!.textContent !== value) promptValue!.textContent = value
      host.replaceChildren(row)
    },
    message(nextOwner, text): void {
      const host = hostRef.current
      if (!host) return
      owner = nextOwner
      const row = ensureMessageRow()
      if (row.textContent !== text) row.textContent = text
      host.replaceChildren(row)
    },
    clear(nextOwner): void {
      if (owner !== nextOwner) return
      owner = null
      hostRef.current?.replaceChildren()
    }
  }
}

export function richMarkdownVim(
  handlers: RichMarkdownVimHandlers,
  actions: RichMarkdownVimActions
): Array<ReturnType<typeof $prose>> {
  const holder: { view: EditorView | null } = { view: null }
  const mirror = createCommandLineMirror(handlers.commandLineHost)
  let lastMode: NoteVimMode | null = null

  const publish = (view: EditorView): void => {
    const vim = getVimStateFromEditorState(view.state)
    const mode: NoteVimMode | null = vim ? vim.mode : null
    if (mode !== lastMode) {
      lastMode = mode
      handlers.onModeChange(mode)
    }
    if (!vim) return
    if (vim.searchActive) mirror.prompt('search', '/', vim.searchQuery)
    else if (vim.statusMessage) mirror.message('search', vim.statusMessage)
    else mirror.clear('search')
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
    $prose(() => createVimExModePlugin(actions, mirror)),
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
                mirror.clear('search')
              }
            }
          }
        })
    )
  ]
}

function createVimExModePlugin(
  actions: RichMarkdownVimActions,
  mirror: ReturnType<typeof createCommandLineMirror>
): Plugin {
  let active = false
  let buffer = ':'
  let message = ''

  const render = (): void => {
    if (active) mirror.prompt('ex', ':', buffer.slice(1))
    else if (message) mirror.message('ex', message)
    else mirror.clear('ex')
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
    view: () => ({
      destroy: () => {
        active = false
        message = ''
        mirror.clear('ex')
      }
    }),
    props: {
      handleKeyDown(view, event) {
        const vim = getVimStateFromEditorState(view.state)
        if (!active) {
          if (event.key === ':' && vim?.mode === 'normal') {
            active = true
            buffer = ':'
            message = ''
            vim.statusMessage = ''
            render()
            return true
          }
          if (message && (event.key === 'Escape' || (event.ctrlKey && event.key === 'c'))) {
            message = ''
            if (vim) vim.statusMessage = ''
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
