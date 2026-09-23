import { EditorSelection, EditorState, type Extension } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { getCM, Vim } from '@replit/codemirror-vim'

export const slashCommands = [
  { id: 'text', label: 'Text', syntax: '', insert: '' },
  { id: 'heading-1', label: 'Heading 1', syntax: '#', insert: '# ' },
  { id: 'heading-2', label: 'Heading 2', syntax: '##', insert: '## ' },
  { id: 'heading-3', label: 'Heading 3', syntax: '###', insert: '### ' },
  { id: 'bullet-list', label: 'Bulleted list', syntax: '-', insert: '- ' },
  { id: 'numbered-list', label: 'Numbered list', syntax: '1.', insert: '1. ' },
  { id: 'quote', label: 'Quote', syntax: '>', insert: '> ' },
  { id: 'code', label: 'Code block', syntax: '```', insert: '```\n\n```', cursor: 4 },
  { id: 'divider', label: 'Divider', syntax: '---', insert: '---' },
  {
    id: 'table',
    label: 'Table',
    syntax: '',
    insert: '| Column 1 | Column 2 |\n| --- | --- |\n|  |  |',
    cursor: 37
  }
] as const

interface SlashQuery {
  query: string
  from: number
  to: number
}

export function findSlashQuery(textBeforeCursor: string): string | null {
  return textBeforeCursor.match(/^\s*\/([^\s/]*)$/)?.[1] ?? null
}

export function canStartSlashQuery(textBeforeCursor: string): boolean {
  return /^\s*$/.test(textBeforeCursor)
}

export function fitSlashMenuPosition(
  anchor: { left: number; bottom: number },
  viewport: { width: number; height: number },
  menu: { width: number; height: number }
): { left: number; top: number } {
  return {
    left: Math.max(8, Math.min(anchor.left, viewport.width - menu.width - 8)),
    top: Math.max(8, Math.min(anchor.bottom + 6, viewport.height - menu.height - 8))
  }
}

export function currentSlashQuery(state: EditorState): SlashQuery | null {
  const selection = state.selection.main
  if (!selection.empty) return null
  const line = state.doc.lineAt(selection.head)
  const query = findSlashQuery(state.sliceDoc(line.from, selection.head))
  if (query === null || state.sliceDoc(selection.head, line.to).trim()) return null
  const from = selection.head - query.length - 1
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(from, 1)
  while (node) {
    if (node.name === 'FencedCode' || node.name === 'CodeBlock' || node.name === 'Frontmatter') {
      return null
    }
    node = node.parent
  }
  return { query, from, to: selection.head }
}

function filteredCommands(query: string): (typeof slashCommands)[number][] {
  const normalized = query.toLocaleLowerCase()
  return slashCommands.filter(({ label }) => label.toLocaleLowerCase().includes(normalized))
}

class SlashMenu {
  private readonly menu = document.createElement('div')
  private readonly view: EditorView
  private selected = 0
  private previousQuery = ''
  private dismissed = ''
  private state: SlashQuery | null = null

  constructor(view: EditorView) {
    this.view = view
    this.menu.className = 'cm-kuskus-slash-menu'
    this.menu.setAttribute('role', 'listbox')
    this.menu.setAttribute('aria-label', 'Formatting commands')
    this.menu.hidden = true
    this.view.dom.addEventListener('keydown', this.onKeyDown, true)
    this.view.dom.ownerDocument.body.appendChild(this.menu)
    this.updateMenu()
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.selectionSet || update.focusChanged || update.geometryChanged) {
      this.updateMenu()
    }
  }

  destroy(): void {
    this.view.dom.removeEventListener('keydown', this.onKeyDown, true)
    this.menu.remove()
  }

  private signature(state: SlashQuery): string {
    return `${state.from}:${state.to}:${state.query}`
  }

  private updateMenu(): void {
    const state =
      this.view.hasFocus && !this.view.state.facet(EditorState.readOnly)
        ? currentSlashQuery(this.view.state)
        : null
    if (!state || this.signature(state) === this.dismissed) {
      if (!state) this.dismissed = ''
      this.state = null
      this.menu.hidden = true
      return
    }
    if (state.query !== this.previousQuery) this.selected = 0
    this.previousQuery = state.query
    this.state = state
    const commands = filteredCommands(state.query)
    this.selected = Math.min(this.selected, Math.max(0, commands.length - 1))
    this.menu.replaceChildren()

    if (commands.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'cm-kuskus-slash-empty'
      empty.textContent = 'No formatting commands found.'
      this.menu.appendChild(empty)
    } else {
      for (const [index, command] of commands.entries()) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'cm-kuskus-slash-item'
        button.setAttribute('role', 'option')
        button.setAttribute('aria-selected', String(index === this.selected))
        button.tabIndex = -1
        const label = document.createElement('span')
        label.textContent = command.label
        const syntax = document.createElement('kbd')
        syntax.textContent = command.syntax
        button.append(label, syntax)
        button.addEventListener('mousedown', (event) => event.preventDefault())
        button.addEventListener('click', () => this.run(command))
        this.menu.appendChild(button)
      }
    }

    this.menu.hidden = false
    this.view.requestMeasure({
      read: (view) => {
        const window = view.dom.ownerDocument.defaultView
        if (!window) return null
        const rect = view.coordsAtPos(state.from) ?? view.dom.getBoundingClientRect()
        return fitSlashMenuPosition(
          rect,
          { width: window.innerWidth, height: window.innerHeight },
          {
            width: this.menu.offsetWidth,
            height: this.menu.offsetHeight
          }
        )
      },
      write: (position) => {
        if (!position || this.state !== state) return
        this.menu.style.left = `${position.left}px`
        this.menu.style.top = `${position.top}px`
      }
    })
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.key === '/' &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !this.view.state.facet(EditorState.readOnly)
    ) {
      const selection = this.view.state.selection.main
      const line = this.view.state.doc.lineAt(selection.head)
      if (
        selection.empty &&
        canStartSlashQuery(this.view.state.sliceDoc(line.from, selection.head))
      ) {
        const cm = getCM(this.view)
        if (cm?.state.vim && !cm.state.vim.insertMode) Vim.handleKey(cm, 'i', 'user')
      }
    }

    const state = this.state
    if (!state) return
    const commands = filteredCommands(state.query)
    if (event.key === 'Escape') {
      this.dismissed = this.signature(state)
      this.updateMenu()
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && commands.length > 0) {
      this.selected =
        (this.selected + (event.key === 'ArrowDown' ? 1 : -1) + commands.length) % commands.length
      this.updateMenu()
    } else if (event.key === 'Enter' && commands[this.selected]) {
      this.run(commands[this.selected])
    } else {
      return
    }
    event.preventDefault()
    event.stopPropagation()
  }

  private run(command: (typeof slashCommands)[number]): void {
    const state = this.state
    const current = currentSlashQuery(this.view.state)
    if (!state || !current || this.signature(state) !== this.signature(current)) return
    const cursor = state.from + ('cursor' in command ? command.cursor : command.insert.length)
    this.view.dispatch({
      changes: { from: state.from, to: state.to, insert: command.insert },
      selection: EditorSelection.cursor(cursor),
      scrollIntoView: true,
      userEvent: 'input'
    })
    this.dismissed = ''
    this.view.focus()
  }
}

export function slashMenu(): Extension {
  return ViewPlugin.fromClass(SlashMenu)
}
