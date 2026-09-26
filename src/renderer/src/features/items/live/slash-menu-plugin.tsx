import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { EditorSelection, EditorState, type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { getCM } from '@replit/codemirror-vim'
import { SlashMenuView } from './slash-menu-view'
import {
  currentSlashQuery,
  fitSlashMenuPosition,
  slashCommands,
  type SlashQuery
} from './slash-menu'

function filteredCommands(query: string): (typeof slashCommands)[number][] {
  const normalized = query.toLocaleLowerCase()
  return slashCommands.filter(({ label }) => label.toLocaleLowerCase().includes(normalized))
}

class SlashMenu {
  private readonly menu = document.createElement('div')
  private readonly root: Root
  private readonly view: EditorView
  private selected = 0
  private previousQuery = ''
  private dismissed = ''
  private state: SlashQuery | null = null

  constructor(view: EditorView) {
    this.view = view
    this.root = createRoot(this.menu)
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
    this.root.unmount()
    this.menu.remove()
  }

  private signature(state: SlashQuery): string {
    return `${state.from}:${state.to}:${state.query}`
  }

  private updateMenu(): void {
    const vim = getCM(this.view)?.state.vim
    const state =
      this.view.hasFocus && !this.view.state.facet(EditorState.readOnly) && (!vim || vim.insertMode)
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
    flushSync(() => {
      this.root.render(
        createElement(SlashMenuView, {
          commands,
          selected: this.selected,
          onRun: (command) => this.run(command)
        })
      )
    })
    const viewport = this.menu.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')
    const selectedItem = this.menu.querySelector<HTMLElement>('[aria-selected="true"]')
    if (viewport && selectedItem) {
      if (selectedItem.offsetTop < viewport.scrollTop) {
        viewport.scrollTop = selectedItem.offsetTop
      } else if (
        selectedItem.offsetTop + selectedItem.offsetHeight >
        viewport.scrollTop + viewport.clientHeight
      ) {
        viewport.scrollTop =
          selectedItem.offsetTop + selectedItem.offsetHeight - viewport.clientHeight
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
    const vim = getCM(this.view)?.state.vim
    if (vim && !vim.insertMode) {
      this.updateMenu()
      return
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
