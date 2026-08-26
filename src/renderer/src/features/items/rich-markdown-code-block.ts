import type { Node as ProseNode } from '@milkdown/prose/model'
import { Plugin, TextSelection } from '@milkdown/prose/state'
import type { EditorState, Transaction } from '@milkdown/prose/state'
import {
  Decoration,
  DecorationSet,
  type EditorView as ProseEditorView,
  type NodeView
} from '@milkdown/prose/view'
import { $prose } from '@milkdown/utils'

import { copyMarkdownCode } from '@/features/items/markdown-code'
import { isCloseFenceText, isOpenFenceText } from '@/features/items/rich-markdown-code-schema'
import { getVimStateFromEditorState } from 'vim-prosemirror'

export interface CodeBlockInfo {
  start: number
  end: number
  text: string
}

/** Info for the block's code line — the text between the fence lines. */
export function findCodeBlockInfo(state: EditorState, pos: number): CodeBlockInfo | null {
  try {
    const $pos = state.doc.resolve(pos)
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      const node = $pos.node(depth)
      if (node.type.name !== 'code_block') continue
      let childStart = $pos.start(depth)
      for (let index = 0; index < node.childCount; index += 1) {
        const child = node.child(index)
        if (child.type.name === 'code_line') {
          return {
            start: childStart + 1,
            end: childStart + 1 + child.content.size,
            text: child.textContent
          }
        }
        childStart += child.nodeSize
      }
      return null
    }
  } catch {
    return null
  }
  return null
}

function lineIndexAtOffset(lines: string[], offset: number): { index: number; start: number } {
  let lineStart = 0
  for (let index = 0; index < lines.length; index += 1) {
    const lineEnd = lineStart + lines[index].length
    if (offset <= lineEnd) return { index, start: lineStart }
    lineStart += lines[index].length + 1
  }
  return { index: lines.length - 1, start: lineStart }
}

export function motionDownInCodeBlock(
  state: EditorState,
  pos: number,
  goalColumn?: number | null
): number | null {
  const info = findCodeBlockInfo(state, pos)
  if (!info) return null
  const lines = info.text.split('\n')
  const { index, start } = lineIndexAtOffset(lines, pos - info.start)
  if (index >= lines.length - 1) return null
  const column = goalColumn ?? pos - info.start - start
  const nextStart = start + lines[index].length + 1
  return info.start + nextStart + Math.min(column, lines[index + 1].length)
}

export function motionUpInCodeBlock(
  state: EditorState,
  pos: number,
  goalColumn?: number | null
): number | null {
  const info = findCodeBlockInfo(state, pos)
  if (!info) return null
  const lines = info.text.split('\n')
  const { index, start } = lineIndexAtOffset(lines, pos - info.start)
  if (index <= 0) return null
  const column = goalColumn ?? pos - info.start - start
  const prevStart = start - 1 - lines[index - 1].length
  return info.start + prevStart + Math.min(column, lines[index - 1].length)
}

/**
 * Opens a line below (`o`) or above (`O`) from inside a code block, with the
 * source editor's semantics: in the code, a new empty visual line opens and
 * the caret lands on it in insert mode; on a fence line, the new line opens
 * on the matching side (inside the code for o-below-the-opening and
 * O-above-the-closing, a paragraph outside the block otherwise). The stock
 * vim-prosemirror commands insert a paragraph next to the current textblock,
 * which inside a code block lands between the code and its fence — an
 * invalid structure whose empty paragraph serializes as raw <br /> and
 * corrupts the note.
 */
function openCodeLine(view: ProseEditorView, vimState: { mode: string }, key: 'o' | 'O'): boolean {
  const { state } = view
  const { $from, empty } = state.selection
  if (!empty) return false
  let depth = $from.depth
  while (depth > 0 && $from.node(depth).type.name !== 'code_block') depth -= 1
  if (depth === 0) return false
  const blockPos = $from.before(depth)
  const blockNode = $from.node(depth)
  const childIndex = $from.index(depth)
  const parent = $from.parent
  const tr = state.tr
  const enterInsert = (position: number): void => {
    tr.setSelection(TextSelection.create(tr.doc, position))
    tr.scrollIntoView()
    vimState.mode = 'insert'
    view.dispatch(tr)
  }
  if (parent.type.name === 'code_line') {
    const info = findCodeBlockInfo(state, $from.pos)
    if (!info) return false
    const lines = info.text.split('\n')
    const { index, start } = lineIndexAtOffset(lines, $from.pos - info.start)
    if (key === 'o') {
      const lineEnd = info.start + start + lines[index].length
      tr.insertText('\n', lineEnd, lineEnd)
      enterInsert(lineEnd + 1)
    } else {
      const lineStart = info.start + start
      tr.insertText('\n', lineStart, lineStart)
      enterInsert(lineStart)
    }
    return true
  }
  if (parent.type.name === 'code_fence') {
    const opensInside = (childIndex === 0) === (key === 'o')
    if (opensInside) {
      const info = findCodeBlockInfo(state, $from.pos)
      if (!info) return false
      if (key === 'o') {
        tr.insertText('\n', info.start, info.start)
        enterInsert(info.start)
      } else {
        const end = info.start + info.text.length
        tr.insertText('\n', end, end)
        enterInsert(end + 1)
      }
      return true
    }
    const paragraph = state.schema.nodes.paragraph
    if (!paragraph) return false
    const paragraphPos = childIndex === 0 ? blockPos : blockPos + blockNode.nodeSize
    tr.insert(paragraphPos, paragraph.create())
    enterInsert(paragraphPos + 1)
    return true
  }
  return false
}

/**
 * Intercepts j/k in vim normal/visual modes while the cursor is inside the
 * code line, moving per visual line of the block's text instead of per
 * textblock. The stock vim-prosemirror motions cross textblocks, and the code
 * is a single textblock with literal newlines, which makes j/k jump over
 * visual lines. The fence lines around the code are ordinary textblocks, so
 * stock motions reach and cross them without help.
 */
export const richMarkdownVimCodePerLine = $prose(
  () =>
    new Plugin({
      props: {
        handleKeyDown(view, event) {
          if (event.ctrlKey || event.metaKey || event.altKey) return false
          const key = event.key
          const vimState = getVimStateFromEditorState(view.state)
          if (!vimState) return false
          if (key === 'o' || key === 'O') {
            if (vimState.mode !== 'normal') return false
            return openCodeLine(view, vimState, key)
          }
          if (key !== 'j' && key !== 'k') return false
          if (!['normal', 'visual', 'visual-line'].includes(vimState.mode)) return false
          const headPos =
            vimState.mode.startsWith('visual') && vimState.visualHead !== null
              ? vimState.visualHead
              : view.state.selection.$head.pos
          const info = findCodeBlockInfo(view.state, headPos)
          if (!info) return false
          const count = vimState.count ?? 1
          if (vimState.goalColumn === null) {
            try {
              const $pos = view.state.doc.resolve(headPos)
              vimState.goalColumn = headPos - $pos.start($pos.depth)
            } catch {
              vimState.goalColumn = 0
            }
          }
          const savedGoal = vimState.goalColumn
          let cursor = headPos
          for (let step = 0; step < count; step += 1) {
            const next =
              key === 'j'
                ? motionDownInCodeBlock(view.state, cursor, savedGoal)
                : motionUpInCodeBlock(view.state, cursor, savedGoal)
            if (next === null) {
              if (step === 0) return false
              break
            }
            cursor = next
          }
          if (cursor === headPos) return false
          const tr = view.state.tr
          if (vimState.mode.startsWith('visual') && vimState.visualAnchor !== null) {
            const anchor = vimState.visualAnchor
            vimState.visualHead = cursor
            const [from, to] = cursor >= anchor ? [anchor, cursor + 1] : [cursor, anchor + 1]
            try {
              tr.setSelection(TextSelection.create(tr.doc, from, Math.min(to, tr.doc.content.size)))
            } catch {
              tr.setSelection(TextSelection.create(tr.doc, cursor))
            }
          } else {
            try {
              tr.setSelection(TextSelection.create(tr.doc, cursor))
            } catch {
              return false
            }
          }
          tr.scrollIntoView()
          view.dispatch(tr)
          vimState.goalColumn = savedGoal
          vimState.count = null
          return true
        }
      }
    })
)

/** Replaces a code block with plain paragraphs of its source, fences included. */
function unfenceInto(tr: Transaction, pos: number, node: ProseNode): void {
  const schema = tr.doc.type.schema
  const children: ProseNode[] = []
  node.forEach((child) => children.push(child))
  const texts: string[] = []
  let first = 0
  let last = children.length
  if (children[0]?.type.name === 'code_fence') {
    texts.push(children[0].textContent)
    first = 1
  }
  let closeText: string | null = null
  if (last > first && children[last - 1]?.type.name === 'code_fence') {
    closeText = children[last - 1].textContent
    last -= 1
  }
  for (let index = first; index < last; index += 1) {
    texts.push(...children[index].textContent.split('\n'))
  }
  if (closeText != null) texts.push(closeText)
  const paragraphs = (texts.length ? texts : ['']).map((text) =>
    schema.nodes.paragraph.create(null, text ? schema.text(text) : null)
  )
  tr.replaceWith(pos, pos + node.nodeSize, paragraphs)
}

/** A code block is exactly [fence, code line, fence]; anything else dissolves. */
function isWellFormedCodeBlock(node: ProseNode): boolean {
  return (
    node.childCount === 3 &&
    node.child(0).type.name === 'code_fence' &&
    node.child(1).type.name === 'code_line' &&
    node.child(2).type.name === 'code_fence' &&
    isOpenFenceText(node.child(0).textContent) &&
    isCloseFenceText(node.child(2).textContent)
  )
}

/**
 * The fence lines are the source of truth for whether a block exists, like in
 * source mode: the moment a fence no longer parses (ticks deleted, text typed
 * after the closing ticks), the block dissolves into plain paragraphs. This
 * also repairs blocks that picked up unexpected children (e.g. from foreign
 * vim commands), whose stray paragraphs would serialize as raw <br />.
 */
export const richMarkdownCodeFenceSync = $prose(
  () =>
    new Plugin({
      appendTransaction: (transactions, _oldState, newState) => {
        if (!transactions.some((tr) => tr.docChanged)) return null
        const invalid: Array<{ pos: number; node: ProseNode }> = []
        newState.doc.descendants((node, pos) => {
          if (node.type.name !== 'code_block') return
          if (isWellFormedCodeBlock(node)) return
          invalid.push({ pos, node })
        })
        if (invalid.length === 0) return null
        const tr = newState.tr
        for (const { pos, node } of invalid.reverse()) unfenceInto(tr, pos, node)
        tr.setMeta('addToHistory', false)
        return tr
      }
    })
)

/**
 * Boundary keys behave like they do on source text: Enter inside a fence line
 * splits it (a still-valid opener hands the remainder to the code), and
 * Backspace/Delete across a fence or code boundary eats the newline, which
 * breaks the fence and dissolves the block. In vim normal mode these keys are
 * motions, so they pass through.
 */
export const richMarkdownCodeBoundary = $prose(
  () =>
    new Plugin({
      props: {
        handleKeyDown: (view, event) => {
          const key = event.key
          if (key !== 'Backspace' && key !== 'Delete' && key !== 'Enter') return false
          const { state } = view
          const { $from, empty } = state.selection
          if (!empty) return false
          const parent = $from.parent
          const isFence = parent.type.name === 'code_fence'
          if (!isFence && parent.type.name !== 'code_line') return false
          const vim = getVimStateFromEditorState(state)
          if (vim && vim.mode !== 'insert' && vim.mode !== 'replace') return false
          let depth = $from.depth
          while (depth > 0 && $from.node(depth).type.name !== 'code_block') depth -= 1
          if (depth === 0) return false
          const blockPos = $from.before(depth)
          const blockNode = $from.node(depth)

          if (key === 'Enter' && !isFence) {
            view.dispatch(state.tr.insertText('\n').scrollIntoView())
            return true
          }
          if (key === 'Enter') {
            const before = parent.textContent.slice(0, $from.parentOffset)
            const after = parent.textContent.slice($from.parentOffset)
            if ($from.index(depth) === 0 && before.length > 0 && isOpenFenceText(before)) {
              const tr = state.tr
              const fenceContentStart = blockPos + 1
              const lineContentStart = fenceContentStart + blockNode.child(0).nodeSize + 1
              if (after) tr.insertText(after, lineContentStart, lineContentStart)
              tr.insertText(before, fenceContentStart, fenceContentStart + parent.content.size)
              tr.setSelection(TextSelection.create(tr.doc, lineContentStart))
              view.dispatch(tr.scrollIntoView())
              return true
            }
            unfenceIntoAndDispatch(view, blockPos, blockNode)
            return true
          }
          const atStart = $from.parentOffset === 0 && key === 'Backspace'
          const atEnd = $from.parentOffset === parent.content.size && key === 'Delete'
          if (!atStart && !atEnd) return false
          unfenceIntoAndDispatch(view, blockPos, blockNode)
          return true
        }
      }
    })
)

function unfenceIntoAndDispatch(
  view: ProseEditorView,
  blockPos: number,
  blockNode: ProseNode
): void {
  const tr = view.state.tr
  unfenceInto(tr, blockPos, blockNode)
  tr.scrollIntoView()
  view.dispatch(tr)
}

/**
 * Renders the code block chrome around its real source content: a background,
 * the horizontal scroll container (scrollbar below the closing fence), and a
 * hover-revealed copy button. The fence and code lines themselves are plain
 * ProseMirror text rendered by their schema toDOM.
 */
export function codeBlockNodeView(node: ProseNode): NodeView {
  const wrapper = document.createElement('div')
  wrapper.className = 'kuskus-code-block not-typeset kuskus-rich-code-block'
  wrapper.setAttribute('spellcheck', 'false')
  wrapper.setAttribute('autocorrect', 'off')
  wrapper.setAttribute('autocapitalize', 'off')

  const content = document.createElement('div')
  content.className = 'kuskus-code-source'
  wrapper.append(content)

  const copy = document.createElement('button')
  copy.type = 'button'
  copy.className = 'kuskus-code-copy kuskus-code-fence-copy'
  copy.textContent = 'Copy'
  copy.addEventListener('mousedown', (event) => event.preventDefault())
  wrapper.append(copy)

  let current = node
  let copiedTimer = 0
  copy.addEventListener('click', async () => {
    if (!(await copyMarkdownCode(current.maybeChild(1)?.textContent ?? ''))) return
    copy.textContent = 'Copied'
    window.clearTimeout(copiedTimer)
    copiedTimer = window.setTimeout(() => {
      copy.textContent = 'Copy'
    }, 1500)
  })

  return {
    dom: wrapper,
    contentDOM: content,
    update: (next) => {
      if (next.type.name !== 'code_block') return false
      current = next
      return true
    },
    stopEvent: (event) =>
      event.target instanceof Element && event.target.closest('.kuskus-code-copy') !== null,
    destroy: () => window.clearTimeout(copiedTimer)
  }
}

/**
 * vim-prosemirror draws its block cursor as an inline decoration over the
 * character under the head, but inside the code line every visual line but
 * the last ends at a literal '\n', which paints with zero width — the cursor
 * vanishes there. When the head sits on a newline, draw the same end-of-line
 * widget the library uses for the block's final line.
 */
export const richMarkdownVimCodeCursor = $prose(
  () =>
    new Plugin({
      props: {
        decorations: (state) => {
          const vim = getVimStateFromEditorState(state)
          if (!vim || vim.mode === 'insert' || vim.mode === 'replace') return null
          const head = vim.visualHead ?? state.selection.$head.pos
          const info = findCodeBlockInfo(state, head)
          if (!info) return null
          const offset = head - info.start
          if (offset >= info.text.length || info.text[offset] !== '\n') return null
          return DecorationSet.create(state.doc, [
            Decoration.widget(
              head,
              () => {
                const span = document.createElement('span')
                span.className = 'vim-block-cursor-eol'
                span.textContent = '\u00a0'
                return span
              },
              { side: 0 }
            )
          ])
        }
      }
    })
)

/** Marks the code block under the cursor so its chrome can react (Copy hides). */
export const richMarkdownCodeFocus = $prose(
  () =>
    new Plugin({
      props: {
        decorations: (state) => {
          const $from = state.selection.$from
          let depth = $from.depth
          while (depth > 0 && $from.node(depth).type.name !== 'code_block') depth -= 1
          if (depth === 0) return null
          return DecorationSet.create(state.doc, [
            Decoration.node($from.before(depth), $from.after(depth), {
              class: 'kuskus-rich-code-active'
            })
          ])
        }
      }
    })
)
