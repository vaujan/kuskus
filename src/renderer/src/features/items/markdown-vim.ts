import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { getCM, Vim, vim } from '@replit/codemirror-vim'
import type { RefObject } from 'react'
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

interface VimDialogOptions {
  value?: string
  selectValueOnOpen?: boolean
  closeOnEnter?: boolean
  closeOnBlur?: boolean
  onClose?: (dialog: Element) => void
  onKeyDown?: (
    event: KeyboardEvent,
    value: string,
    close: (newVal?: string) => void
  ) => boolean | void
  onKeyUp?: (event: KeyboardEvent, value: string, close: (newVal?: string) => void) => void
  onInput?: (event: Event, value: string, close: (newVal?: string) => void) => void
}

interface VimNotificationOptions {
  duration?: number
}

type OpenDialog = (
  template: Element,
  callback: ((value: string) => void) | undefined,
  options: VimDialogOptions | undefined
) => (newVal?: string) => void

type OpenNotification = (
  template: Element,
  options: VimNotificationOptions | undefined
) => () => void

function prepareVimPrompt(template: Element, input: HTMLInputElement): void {
  const prefix = input.parentElement?.textContent?.trim() ?? ''
  const description = input.parentElement?.nextElementSibling
  description?.remove()

  const isSearch = prefix === '/' || prefix === '?'
  input.placeholder = isSearch ? 'Search' : 'Command'
  input.setAttribute('aria-label', isSearch ? 'Search note' : 'Vim command')

  const hint = document.createElement('span')
  hint.className = 'vim-command-hint'
  hint.textContent = isSearch ? 'Enter to search · Esc to cancel' : 'Enter to run · Esc to cancel'
  template.appendChild(hint)
}

function prepareVimNotification(template: Element): void {
  const message = template.textContent?.trim() ?? ''
  const yank = /^(\d+) lines yanked(.*)$/u.exec(message)
  if (!yank) return

  const count = Number(yank[1])
  template.textContent = `Yanked ${count} ${count === 1 ? 'line' : 'lines'}${yank[2]}`
}

const commandLinePatches = new WeakMap<EditorView, () => void>()

/**
 * Redirects CodeMirror's Vim prompts, confirmations, and message dialogs from
 * its own bottom panel into the shared note status bar. The patched openDialog
 * keeps the original contract: the
 * template (a prompt element wrapping a real, focused <input>) is mounted
 * as-is, Enter invokes the callback, `close(value)` pre-fills the input
 * (search history), and close refocuses the editor.
 */
export function wireMarkdownVimCommandLine(
  view: EditorView,
  commandLineHost: RefObject<HTMLElement | null> | null
): void {
  if (commandLinePatches.has(view)) return
  const cm = getCM(view)
  if (!cm) return
  const originalOpenDialog = cm.openDialog.bind(cm) as OpenDialog
  const originalOpenNotification = cm.openNotification.bind(cm) as OpenNotification
  let activeClose: ((newVal?: string) => void) | null = null

  cm.openDialog = ((template, callback, options) => {
    const host = commandLineHost?.current
    if (!host) return originalOpenDialog(template, callback, options)
    activeClose?.()
    host.replaceChildren(template)
    const input = template.getElementsByTagName('input')[0] as HTMLInputElement | null
    host.dataset.state = input ? 'prompt' : 'message'
    if (input) prepareVimPrompt(template, input)
    let closed = false
    const close = (newVal?: string): void => {
      if (typeof newVal === 'string') {
        if (input) input.value = newVal
        return
      }
      if (closed) return
      closed = true
      activeClose = null
      template.remove()
      delete host.dataset.state
      options?.onClose?.(template)
      if (!host.firstChild) cm.focus()
    }
    activeClose = close
    if (input) {
      if (options?.value) {
        input.value = options.value
        if (options.selectValueOnOpen !== false) input.select()
      }
      input.addEventListener('keydown', (event) => {
        if (options?.onKeyDown?.(event, input.value, close)) return
        if (event.keyCode === 13) callback?.(input.value)
        if (event.keyCode === 27 || (options?.closeOnEnter !== false && event.keyCode === 13)) {
          event.preventDefault()
          event.stopPropagation()
          input.blur()
          close()
        }
      })
      if (options?.onInput) {
        input.addEventListener('input', (event) => options.onInput?.(event, input.value, close))
      }
      if (options?.onKeyUp) {
        input.addEventListener('keyup', (event) => options.onKeyUp?.(event, input.value, close))
      }
      if (options?.closeOnBlur !== false) {
        input.addEventListener('blur', () => {
          window.setTimeout(() => {
            if (document.activeElement === input) return
            close()
          })
        })
      }
      input.focus()
    }
    return close
  }) as OpenDialog

  cm.openNotification = ((template, options) => {
    const host = commandLineHost?.current
    if (!host) return originalOpenNotification(template, options)
    activeClose?.()
    prepareVimNotification(template)
    host.replaceChildren(template)
    host.dataset.state = 'message'
    let closed = false
    let timeout: number | null = null
    const close = (): void => {
      if (closed) return
      closed = true
      if (timeout !== null) window.clearTimeout(timeout)
      activeClose = null
      template.remove()
      delete host.dataset.state
    }
    activeClose = close
    template.addEventListener('click', close, { once: true })
    const duration = options?.duration ?? 5000
    if (duration > 0) timeout = window.setTimeout(close, duration)
    return close
  }) as OpenNotification

  commandLinePatches.set(view, () => {
    activeClose?.()
    cm.openDialog = originalOpenDialog
    cm.openNotification = originalOpenNotification
    commandLinePatches.delete(view)
  })
}

export function unwireMarkdownVimCommandLine(view: EditorView): void {
  commandLinePatches.get(view)?.()
}
