import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import {
  EditorSelection,
  Facet,
  Prec,
  StateField,
  StateEffect,
  Transaction,
  type EditorState,
  type Extension,
  type Range
} from '@codemirror/state'
import { Decoration, EditorView, WidgetType, keymap, type DecorationSet } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { getCM, Vim } from '@replit/codemirror-vim'
import katex from 'katex'
import { matchHighlight } from './highlight'
import { treeGrowthEffect, treeProgressPlugin } from './tree-progress'
import { readOnlyFacet } from './read-only'
import { openTableContextMenu, type TableContextMenuEntry } from './table-context-menu'
import {
  clearTableSelection,
  deleteTableColumns,
  deleteTableRows,
  duplicateTableColumn,
  duplicateTableRow,
  formatTableSelection,
  insertTableColumn,
  insertTableRow,
  moveTableColumn,
  moveTableVisualRow,
  normalizeTableSelection,
  parseMarkdownTable,
  parseTableClipboard,
  pasteTableSelection,
  serializeTable,
  setTableAlign,
  sortTableRows,
  tableSelectionToTsv,
  type TableAlign,
  type TableCellPoint,
  type TableModel,
  type TableSelection
} from '../../markdown-table-model'

// GFM tables as a WYSIWYG block widget.
//
// Strategy: replace the entire Table node in the source with a block
// Decoration.replace widget. The widget renders an HTML `<table>`
// whose `<th>` / `<td>` cells are `contenteditable`. Editing flows
// DOM → source: on every cell `input` event we re-serialize the
// widget's DOM state to markdown and dispatch a single change that
// replaces the table's current source range. Source → DOM is handled
// by the StateField rebuilding a widget from the parsed tree, but
// crucially our widget's `eq` is structure-only: same row/col count
// returns true, so CM6 keeps the existing DOM across keystrokes and
// the caret / focus survive.
//
// Tab / Shift-Tab move focus between cells. Tab past the last cell
// appends a new row and focuses its first cell. Backspace/Delete
// inside a cell uses browser default (per-char). Outside the widget
// (at the table's atomic boundary), CM6's atomic-range handling
// deletes the whole table as one unit — matching Obsidian's "table
// is a unit" feel.
//
// ---- model / parse / serialize --------------------------------------

function parseTable(state: EditorState, tableNode: SyntaxNode): TableModel | null {
  return parseMarkdownTable(state.sliceDoc(tableNode.from, tableNode.to))
}

function readModelFromDom(wrap: HTMLElement): TableModel {
  const headerCells = Array.from(wrap.querySelectorAll<HTMLElement>('thead th'))
  const header = headerCells.map(readCellSource)
  const rows = Array.from(wrap.querySelectorAll<HTMLElement>('tbody tr')).map((tr) =>
    Array.from(tr.querySelectorAll<HTMLElement>('td')).map(readCellSource)
  )
  const aligns = headerCells.map((cell): TableAlign | null => {
    const align = cell.dataset.align
    return align === 'left' || align === 'center' || align === 'right' ? align : null
  })
  return { header, rows, aligns }
}

// A cell's raw markdown lives in `dataset.raw` — the source of truth
// that `readModelFromDom` reads when serializing the table back to
// markdown. The inner `.cm-atomic-table-cell-source` element displays
// an escape-stripped view of that raw text so RSS-ingested cells
// don't show `\.` / `\(` / `\-` style literal backslashes in the
// reader; the input handler pulls innerText back to dataset.raw on
// every keystroke (any escapes the user types get preserved there,
// but won't round-trip back through stripEscapes on re-render —
// acceptable tradeoff because the escapes are typically ingestion
// artifacts users don't want to preserve anyway).
function readCellSource(cell: HTMLElement): string {
  return (cell.dataset.raw ?? '').trim()
}

function getCellSource(cell: HTMLElement): HTMLElement | null {
  return cell.querySelector<HTMLElement>('.cm-atomic-table-cell-source')
}

// ---- inline-mark parsing for cell source --------------------------------

// Cells render a subset of inline markdown — bold, italic, strikethrough,
// highlight, and links. No code spans (the `|` inside a backtick would silently
// break row parsing), no lists/blocks (cells are single-line by
// construction), no images (handled by the separate cell-preview strip).
//
// The parser is recursive so `**[text](url)**` nests cleanly, but each
// mark is a straightforward delimiter pair. Highlights share their
// delimiter/flanking rules with the main markdown parser so the same
// source renders consistently inside and outside tables.

type CellToken =
  | { type: 'text'; text: string }
  | { type: 'strong'; delim: '**' | '__'; children: CellToken[] }
  | { type: 'em'; delim: '*' | '_'; children: CellToken[] }
  | { type: 'strike'; children: CellToken[] }
  | { type: 'highlight'; children: CellToken[] }
  | { type: 'link'; textChildren: CellToken[]; url: string }

export function parseCellInline(raw: string): CellToken[] {
  const tokens: CellToken[] = []
  let textBuf = ''
  let i = 0

  const flushText = () => {
    if (textBuf.length) {
      tokens.push({ type: 'text', text: textBuf })
      textBuf = ''
    }
  }

  while (i < raw.length) {
    // CommonMark backslash escape — the following char is emitted
    // literally and can't open/close a mark. Pair is consumed.
    if (raw[i] === '\\' && i + 1 < raw.length && /[!-/:-@[-`{-~]/.test(raw[i + 1])) {
      textBuf += raw[i + 1]
      i += 2
      continue
    }

    const match = matchCellMarkAt(raw, i)
    if (match) {
      flushText()
      tokens.push(match.token)
      i = match.end
      continue
    }

    textBuf += raw[i]
    i++
  }

  flushText()
  return tokens
}

function matchCellMarkAt(raw: string, from: number): { token: CellToken; end: number } | null {
  const rest = raw.slice(from)

  // Bold with `**` or `__` — greedy on the outside, lazy on the
  // content so we catch the nearest closer.
  let m = rest.match(/^\*\*([\s\S]+?)\*\*/)
  if (m) {
    return {
      token: { type: 'strong', delim: '**', children: parseCellInline(m[1]) },
      end: from + m[0].length
    }
  }
  m = rest.match(/^__([\s\S]+?)__/)
  if (m) {
    return {
      token: { type: 'strong', delim: '__', children: parseCellInline(m[1]) },
      end: from + m[0].length
    }
  }

  // Strikethrough.
  m = rest.match(/^~~([\s\S]+?)~~/)
  if (m) {
    return {
      token: { type: 'strike', children: parseCellInline(m[1]) },
      end: from + m[0].length
    }
  }

  // Highlight. Keep exact-delimiter and whitespace rules aligned with
  // the main Lezer extension.
  const highlight = matchHighlight(raw, from)
  if (highlight) {
    return {
      token: {
        type: 'highlight',
        children: parseCellInline(raw.slice(highlight.contentFrom, highlight.contentTo))
      },
      end: highlight.end
    }
  }

  // Link `[text](url)`. Reject empty text / url via `+` quantifiers.
  // `]` and `)` can't appear unescaped inside their respective fields.
  m = rest.match(/^\[([^\]\n]+)\]\(([^\s)"'\n]+)\)/)
  if (m) {
    return {
      token: {
        type: 'link',
        textChildren: parseCellInline(m[1]),
        url: m[2]
      },
      end: from + m[0].length
    }
  }

  // Italic with `*`. Reject a leading `*` (that would have matched
  // the bold regex above; this guards against pathological inputs
  // like `***` that slip through).
  m = rest.match(/^\*([^*\n]+?)\*/)
  if (m) {
    return {
      token: { type: 'em', delim: '*', children: parseCellInline(m[1]) },
      end: from + m[0].length
    }
  }

  // Italic with `_`. Avoid triggering inside words like `snake_case`
  // by requiring the char before `_` to not be a word character.
  // (Fallback to true when `_` is at start-of-input.)
  const prev = from > 0 ? raw[from - 1] : ''
  if (!/\w/.test(prev)) {
    m = rest.match(/^_([^_\n]+?)_/)
    if (m) {
      return {
        token: { type: 'em', delim: '_', children: parseCellInline(m[1]) },
        end: from + m[0].length
      }
    }
  }

  return null
}

// Build the decorated DOM for a cell's source. The parser strips
// CommonMark backslash escapes inline (so `\*` emits a literal `*`
// text node); the fragment's `textContent` equals the escape-stripped
// raw. The cell's input handler reads `textContent` to update
// `dataset.raw` — round-trip is one-way for escapes (same as the
// pre-markdown-in-cells behavior), but fully preserves every inline
// mark delimiter because those live in `display: none` spans inside
// the DOM rather than being derived on serialize.
function buildCellSourceDom(raw: string): DocumentFragment {
  const frag = document.createDocumentFragment()
  const tokens = parseCellInline(raw)
  for (const tok of tokens) frag.appendChild(renderCellToken(tok))
  return frag
}

function renderCellToken(tok: CellToken): Node {
  if (tok.type === 'text') {
    return document.createTextNode(tok.text)
  }

  if (tok.type === 'strong') {
    const wrap = document.createElement('span')
    wrap.className = 'cm-atomic-strong-wrap'
    wrap.appendChild(makeCellMark(tok.delim))
    const inner = document.createElement('span')
    inner.className = 'cm-atomic-strong'
    inner.appendChild(renderTokensTo(tok.children))
    wrap.appendChild(inner)
    wrap.appendChild(makeCellMark(tok.delim))
    return wrap
  }

  if (tok.type === 'em') {
    const wrap = document.createElement('span')
    wrap.className = 'cm-atomic-em-wrap'
    wrap.appendChild(makeCellMark(tok.delim))
    const inner = document.createElement('span')
    inner.className = 'cm-atomic-em'
    inner.appendChild(renderTokensTo(tok.children))
    wrap.appendChild(inner)
    wrap.appendChild(makeCellMark(tok.delim))
    return wrap
  }

  if (tok.type === 'strike') {
    const wrap = document.createElement('span')
    wrap.className = 'cm-atomic-strike-wrap'
    wrap.appendChild(makeCellMark('~~'))
    const inner = document.createElement('span')
    inner.className = 'cm-atomic-strike'
    inner.appendChild(renderTokensTo(tok.children))
    wrap.appendChild(inner)
    wrap.appendChild(makeCellMark('~~'))
    return wrap
  }

  if (tok.type === 'highlight') {
    const wrap = document.createElement('span')
    wrap.className = 'cm-atomic-highlight-wrap'
    wrap.appendChild(makeCellMark('=='))
    const inner = document.createElement('span')
    inner.className = 'cm-atomic-highlight'
    inner.appendChild(renderTokensTo(tok.children))
    wrap.appendChild(inner)
    wrap.appendChild(makeCellMark('=='))
    return wrap
  }

  // Link. Shape mirrors the outer-editor markup: `.cm-atomic-link` on
  // the visible text (picks up link color + external-link icon via
  // `::after`), faint marks for `[`, `]`, `(`, URL, `)`, and highlight
  // uses the same decorated wrapper pattern as the main editor.
  // `data-url`
  // lets the cell-source click handler open the right URL without
  // re-parsing.
  const wrap = document.createElement('span')
  wrap.className = 'cm-atomic-link-wrap'
  wrap.dataset.url = tok.url
  wrap.appendChild(makeCellMark('['))
  const inner = document.createElement('span')
  inner.className = 'cm-atomic-link'
  inner.appendChild(renderTokensTo(tok.textChildren))
  wrap.appendChild(inner)
  wrap.appendChild(makeCellMark(']'))
  wrap.appendChild(makeCellMark('('))
  const urlMark = makeCellMark(tok.url)
  urlMark.classList.add('cm-atomic-link-url')
  wrap.appendChild(urlMark)
  wrap.appendChild(makeCellMark(')'))
  // Real, clickable external-link icon. A CSS `::after` pseudo can't
  // receive a click (no event target), so the icon is its own
  // non-editable element; the source's delegated click handler opens
  // the URL. `contenteditable=false` keeps it out of caret navigation
  // and out of the cell's serialized text.
  const icon = document.createElement('span')
  icon.className = 'cm-atomic-link-icon'
  icon.contentEditable = 'false'
  icon.setAttribute('aria-hidden', 'true')
  wrap.appendChild(icon)
  return wrap
}

function renderTokensTo(tokens: CellToken[]): DocumentFragment {
  const frag = document.createDocumentFragment()
  for (const tok of tokens) frag.appendChild(renderCellToken(tok))
  return frag
}

function makeCellMark(text: string): HTMLElement {
  const el = document.createElement('span')
  el.className = 'cm-atomic-mark'
  el.textContent = text
  return el
}

// Render a cell source element in its decorated form. Safe to call
// multiple times — overwrites whatever was there.
//
// Marks start collapsed: all `.cm-atomic-mark` descendants (delimiters
// like `**`, `_`, `~~`, `[`, `]`, `(`, `)`, and URL text) are hidden
// via CSS by default. When the caret enters a mark wrap, JS adds an
// `active` class that reveals that wrap's delimiters — mirroring the
// outer editor's cursor-inside-link unfold for every inline mark.
function renderCellSourceDecorated(source: HTMLElement): void {
  const raw = source.parentElement?.dataset.raw ?? ''
  source.replaceChildren(buildCellSourceDom(raw))
}

// Caret utilities — encode positions as character offsets within the
// element's textContent so we can survive the full-DOM re-render that
// follows every keystroke (new marks need to decorate immediately;
// the whole tree rebuilds from scratch).

function getCaretCharOffset(container: HTMLElement): number | null {
  const selection = container.ownerDocument?.defaultView?.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!container.contains(range.startContainer)) return null
  const pre = range.cloneRange()
  pre.selectNodeContents(container)
  pre.setEnd(range.startContainer, range.startOffset)
  return pre.toString().length
}

function setCaretCharOffset(container: HTMLElement, offset: number): void {
  const doc = container.ownerDocument
  if (!doc) return
  const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let remaining = offset
  let target: Text | null = null
  let targetOffset = 0
  let node = walker.nextNode() as Text | null
  while (node) {
    const len = node.data.length
    if (remaining <= len) {
      target = node
      targetOffset = remaining
      break
    }
    remaining -= len
    node = walker.nextNode() as Text | null
  }
  const selection = doc.defaultView?.getSelection()
  if (!selection) return
  const range = doc.createRange()
  if (target) {
    range.setStart(target, targetOffset)
  } else {
    // Offset past the end — place caret at the container's end.
    range.selectNodeContents(container)
    range.collapse(false)
  }
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

const MARK_WRAP_CLASSES = [
  'cm-atomic-strong-wrap',
  'cm-atomic-em-wrap',
  'cm-atomic-strike-wrap',
  'cm-atomic-link-wrap'
]

function isMarkWrap(el: Element): boolean {
  for (const c of MARK_WRAP_CLASSES) if (el.classList.contains(c)) return true
  return false
}

// Reveal the delimiters of whatever mark wrap(s) contain the caret,
// and collapse every other wrap in this cell. Walks from the caret
// anchor up to the source element, flagging every ancestor mark wrap
// so nested marks (bold-containing-italic) all reveal together — the
// user sees the full structure around their caret.
function updateActiveMarkForSource(source: HTMLElement): void {
  // Clear existing `active` classes within this cell only — other
  // cells track their own state via their own focus lifecycle.
  for (const el of source.querySelectorAll('.active')) {
    el.classList.remove('active')
  }

  const doc = source.ownerDocument
  if (!doc) return
  const selection = doc.defaultView?.getSelection()
  if (!selection || selection.rangeCount === 0) return
  const anchor = selection.anchorNode
  if (!anchor || !source.contains(anchor)) return

  let node: Node | null = anchor
  while (node && node !== source) {
    if (node instanceof Element && isMarkWrap(node)) {
      node.classList.add('active')
    }
    node = node.parentNode
  }
}

function clearActiveMarksInSource(source: HTMLElement): void {
  for (const el of source.querySelectorAll('.active')) {
    el.classList.remove('active')
  }
}

interface CellImage {
  src: string
  alt: string
}

// Scan raw markdown for `![alt](url)` occurrences. The regex bans `]`
// inside the alt and whitespace inside the URL so we fail closed on
// malformed sources rather than embedding a broken preview.
function extractCellImages(text: string): CellImage[] {
  const imgs: CellImage[] = []
  const re = /!\[([^\]]*)\]\(([^\s)"']+)(?:\s+["'][^)]*["'])?\)/g
  for (const match of text.matchAll(re)) {
    imgs.push({ alt: match[1] || '', src: match[2] })
  }
  return imgs
}

// Refresh (or remove) the rendered-content strip that sits below the
// source line. Images and whole-cell inline math use the Markdown as
// their source of truth, render while resting, and reveal the source
// when the cell receives focus.
function refreshCellPreview(cell: HTMLElement): void {
  const existing = cell.querySelector<HTMLElement>('.cm-atomic-table-cell-preview')
  if (existing) existing.remove()

  const text = cell.dataset.raw ?? ''
  const imgs = extractCellImages(text)
  const math = /^\$([^$\n]+)\$$/.exec(text)?.[1] ?? null
  if (imgs.length === 0 && math === null) {
    delete cell.dataset.hasImage
    delete cell.dataset.hasMath
    return
  }

  const preview = document.createElement('div')
  preview.className = 'cm-atomic-table-cell-preview'
  // Preview is visual only — no caret, no contenteditable scope.
  // Keeping it out of contenteditable also means clicking the image
  // won't create a phantom caret position at the preview boundary.
  preview.contentEditable = 'false'

  if (math !== null) {
    delete cell.dataset.hasImage
    cell.dataset.hasMath = 'true'
    preview.dataset.kind = 'math'
    const renderedMath = document.createElement('span')
    renderedMath.className = 'kuskus-math cm-atomic-table-cell-math'
    try {
      renderedMath.innerHTML = katex.renderToString(math, {
        displayMode: false,
        throwOnError: false
      })
    } catch {
      renderedMath.textContent = math
    }
    preview.appendChild(renderedMath)
  } else {
    delete cell.dataset.hasMath
    cell.dataset.hasImage = 'true'
    preview.dataset.kind = 'images'
    for (const { src, alt } of imgs) {
      const img = document.createElement('img')
      img.src = src
      img.alt = alt
      img.loading = 'lazy'
      img.className = 'cm-atomic-table-cell-image'
      // Clicking the image puts the caret in the source text so the
      // user can edit the underlying markdown — same affordance as
      // clicking a block-level image outside a table.
      img.addEventListener('pointerdown', (event) => {
        event.preventDefault()
        event.stopPropagation()
        const source = getCellSource(cell)
        if (!source) return
        source.focus()
        placeCaretAtEnd(source)
      })
      preview.appendChild(img)
    }
  }

  cell.appendChild(preview)
}

// ---- position resolution --------------------------------------------

// posAtDOM on a block-replace widget returns the start of the replaced
// range. Walk the tree from there to find the enclosing Table node so
// our dispatch targets the current range (positions shift as the user
// types — we can't rely on the from/to captured at widget creation).
function findCurrentTableRange(
  view: EditorView,
  dom: HTMLElement
): { from: number; to: number } | null {
  const pos = view.posAtDOM(dom)
  if (pos < 0) return null
  const tree = syntaxTree(view.state)
  let node: SyntaxNode | null = tree.resolveInner(pos, 1)
  while (node && node.name !== 'Table') node = node.parent
  if (node) return { from: node.from, to: node.to }

  // Fallback: scan for the nearest Table node containing or starting
  // at pos. Rare — resolveInner + parent walk handles almost every
  // case — but guards against parser edge cases.
  let found: SyntaxNode | null = null
  tree.iterate({
    enter: (n) => {
      if (n.name !== 'Table') return
      if (n.from <= pos && n.to >= pos) {
        found = n.node
        return false
      }
      return
    }
  })
  if (found) return { from: (found as SyntaxNode).from, to: (found as SyntaxNode).to }
  return null
}

// ---- DOM helpers ----------------------------------------------------

function placeCaretAtEnd(el: HTMLElement): void {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  if (!sel) return
  sel.removeAllRanges()
  sel.addRange(range)
}

function placeCaretAtStart(el: HTMLElement): void {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(true)
  const sel = window.getSelection()
  if (!sel) return
  sel.removeAllRanges()
  sel.addRange(range)
}

function focusCellCaret(view: EditorView, cell: HTMLElement, atEnd: boolean, x?: number): void {
  const source = getCellSource(cell)
  if (!source) return
  source.focus({ preventScroll: true })
  if (atEnd) placeCaretAtEnd(source)
  else placeCaretAtStart(source)
  if (x !== undefined) {
    const rect = source.getBoundingClientRect()
    const y = Math.min(rect.bottom - 1, Math.max(rect.top + 1, rect.top + rect.height / 2))
    const hit = document.caretRangeFromPoint(x, y)
    if (hit && source.contains(hit.startContainer)) {
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(hit)
    }
  }
  cell.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  updateTableVimCursor(view, source)
}

function getAllCells(wrap: HTMLElement): HTMLElement[] {
  return Array.from(wrap.querySelectorAll<HTMLElement>('th, td'))
}

const tableSelections = new WeakMap<HTMLElement, TableSelection>()
const tableCleanups = new WeakMap<HTMLElement, () => void>()

function pointForCell(cell: HTMLElement): TableCellPoint {
  return {
    row: Number(cell.dataset.row ?? 0),
    column: Number(cell.dataset.column ?? 0)
  }
}

function cellAtPoint(wrap: HTMLElement, point: TableCellPoint): HTMLElement | null {
  return wrap.querySelector<HTMLElement>(`[data-row="${point.row}"][data-column="${point.column}"]`)
}

function selectionContains(
  model: TableModel,
  selection: TableSelection,
  point: TableCellPoint
): boolean {
  const bounds = normalizeTableSelection(model, selection)
  return (
    point.row >= bounds.top &&
    point.row <= bounds.bottom &&
    point.column >= bounds.left &&
    point.column <= bounds.right
  )
}

function handleCellContextPointerDown(event: PointerEvent, cell: HTMLElement): boolean {
  if (event.button !== 2) return false
  const wrap = cell.closest<HTMLElement>('.cm-atomic-table')
  const selection = wrap ? tableSelections.get(wrap) : undefined
  if (
    wrap &&
    selection &&
    selectionContains(readModelFromDom(wrap), selection, pointForCell(cell))
  ) {
    // Keep the wrapper focused when opening a menu from inside an existing
    // range. Otherwise the browser focuses the contenteditable first and its
    // focus handler clears the range before `contextmenu` is dispatched.
    event.preventDefault()
  }
  return true
}

type TableDragAxis = 'column' | 'row'

function tableDragTarget(wrap: HTMLElement, axis: TableDragAxis, clientX: number, clientY: number) {
  const candidates =
    axis === 'column'
      ? Array.from(wrap.querySelectorAll<HTMLElement>('thead th'))
      : Array.from(wrap.querySelectorAll<HTMLElement>('thead tr, tbody tr'))
  let nearest = -1
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const [index, candidate] of candidates.entries()) {
    const rect = candidate.getBoundingClientRect()
    const center = axis === 'column' ? rect.left + rect.width / 2 : rect.top + rect.height / 2
    const pointer = axis === 'column' ? clientX : clientY
    const distance = Math.abs(pointer - center)
    if (distance < nearestDistance) {
      nearest = index
      nearestDistance = distance
    }
  }
  return nearest
}

function paintTableDragTarget(wrap: HTMLElement, axis?: TableDragAxis, index?: number): void {
  for (const cell of getAllCells(wrap)) {
    delete cell.dataset.dragTarget
    delete cell.dataset.dragTop
    delete cell.dataset.dragBottom
    delete cell.dataset.dragLeft
    delete cell.dataset.dragRight
  }
  if (axis === undefined || index === undefined || index < 0) return
  const selector = axis === 'column' ? `[data-column="${index}"]` : `[data-row="${index}"]`
  const model = readModelFromDom(wrap)
  const lastRow = model.rows.length
  const lastColumn = model.header.length - 1
  for (const cell of wrap.querySelectorAll<HTMLElement>(selector)) {
    cell.dataset.dragTarget = axis
    const point = pointForCell(cell)
    if (axis === 'row' || point.row === 0) cell.dataset.dragTop = 'true'
    if (axis === 'row' || point.row === lastRow) cell.dataset.dragBottom = 'true'
    if (axis === 'column' || point.column === 0) cell.dataset.dragLeft = 'true'
    if (axis === 'column' || point.column === lastColumn) cell.dataset.dragRight = 'true'
  }
}

function attachTableDragHandle(
  view: EditorView,
  cell: HTMLElement,
  handle: HTMLButtonElement,
  axis: TableDragAxis
): void {
  handle.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
  })
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    const wrap = cell.closest<HTMLElement>('.cm-atomic-table')
    if (!wrap) return
    event.preventDefault()
    event.stopPropagation()
    const currentOrigin = axis === 'column' ? pointForCell(cell).column : pointForCell(cell).row
    const startX = event.clientX
    const startY = event.clientY
    let dragging = false
    let target = currentOrigin

    const finish = (commit: boolean) => {
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', cancel, true)
      window.removeEventListener('blur', cancel)
      delete handle.dataset.dragging
      delete wrap.dataset.dragging
      paintTableDragTarget(wrap)

      if (commit && dragging && target !== currentOrigin) {
        const model = readModelFromDom(wrap)
        if (axis === 'column') {
          dispatchModel(
            view,
            wrap,
            moveTableColumn(model, currentOrigin, target),
            {
              anchor: { row: 0, column: target },
              head: { row: model.rows.length, column: target }
            },
            { axis, from: currentOrigin, to: target }
          )
        } else {
          dispatchModel(
            view,
            wrap,
            moveTableVisualRow(model, currentOrigin, target),
            {
              anchor: { row: target, column: 0 },
              head: { row: target, column: model.header.length - 1 }
            },
            { axis, from: currentOrigin, to: target }
          )
        }
        return
      }

      if (!dragging) {
        if (axis === 'column') selectWholeColumn(wrap, currentOrigin, false)
        else selectWholeRow(wrap, currentOrigin, false)
      }
    }
    const move = (moveEvent: PointerEvent) => {
      if (!dragging && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 4) {
        return
      }
      if (!dragging) {
        dragging = true
        handle.dataset.dragging = 'true'
        wrap.dataset.dragging = axis
        if (axis === 'column') selectWholeColumn(wrap, currentOrigin, false)
        else selectWholeRow(wrap, currentOrigin, false)
      }
      target = tableDragTarget(wrap, axis, moveEvent.clientX, moveEvent.clientY)
      paintTableDragTarget(wrap, axis, target)
    }
    const up = () => finish(true)
    const cancel = () => finish(false)
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', cancel, true)
    window.addEventListener('blur', cancel)
  })
}

function paintTableSelection(wrap: HTMLElement): void {
  const selection = tableSelections.get(wrap)
  const cells = getAllCells(wrap)
  for (const cell of cells) {
    delete cell.dataset.selected
    delete cell.dataset.selectionTop
    delete cell.dataset.selectionBottom
    delete cell.dataset.selectionLeft
    delete cell.dataset.selectionRight
    delete cell.dataset.active
    cell.removeAttribute('aria-selected')
  }
  if (!selection) {
    delete wrap.dataset.hasSelection
    return
  }

  const model = readModelFromDom(wrap)
  const bounds = normalizeTableSelection(model, selection)
  wrap.dataset.hasSelection = 'true'
  for (let row = bounds.top; row <= bounds.bottom; row++) {
    for (let column = bounds.left; column <= bounds.right; column++) {
      const cell = cellAtPoint(wrap, { row, column })
      if (!cell) continue
      cell.dataset.selected = 'true'
      cell.setAttribute('aria-selected', 'true')
      if (row === bounds.top) cell.dataset.selectionTop = 'true'
      if (row === bounds.bottom) cell.dataset.selectionBottom = 'true'
      if (column === bounds.left) cell.dataset.selectionLeft = 'true'
      if (column === bounds.right) cell.dataset.selectionRight = 'true'
    }
  }
  const active = cellAtPoint(wrap, selection.head)
  if (active) active.dataset.active = 'true'
}

function selectTableCells(
  wrap: HTMLElement,
  selection: TableSelection,
  focus = true,
  scroll = true
): void {
  const model = readModelFromDom(wrap)
  const bounds = normalizeTableSelection(model, selection)
  const clamped: TableSelection = {
    anchor: {
      row: Math.min(bounds.bottom, Math.max(bounds.top, selection.anchor.row)),
      column: Math.min(bounds.right, Math.max(bounds.left, selection.anchor.column))
    },
    head: {
      row: Math.min(bounds.bottom, Math.max(bounds.top, selection.head.row)),
      column: Math.min(bounds.right, Math.max(bounds.left, selection.head.column))
    }
  }
  tableSelections.set(wrap, clamped)
  paintTableSelection(wrap)
  if (focus) wrap.focus({ preventScroll: true })
  if (scroll)
    cellAtPoint(wrap, clamped.head)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function clearTableCellSelection(wrap: HTMLElement): void {
  tableSelections.delete(wrap)
  paintTableSelection(wrap)
}

function selectWholeRow(wrap: HTMLElement, row: number, scroll = true): void {
  const lastColumn = Math.max(0, readModelFromDom(wrap).header.length - 1)
  selectTableCells(
    wrap,
    {
      anchor: { row, column: 0 },
      head: { row, column: lastColumn }
    },
    true,
    scroll
  )
}

function selectWholeColumn(wrap: HTMLElement, column: number, scroll = true): void {
  const lastRow = readModelFromDom(wrap).rows.length
  selectTableCells(
    wrap,
    {
      anchor: { row: 0, column },
      head: { row: lastRow, column }
    },
    true,
    scroll
  )
}

function selectionForPastedMatrix(
  model: TableModel,
  selection: TableSelection,
  matrix: string[][]
): TableSelection {
  const bounds = normalizeTableSelection(model, selection)
  const anchor = { row: bounds.top, column: bounds.left }
  if (matrix.length === 1 && matrix[0].length === 1) return selection
  return {
    anchor,
    head: {
      row: bounds.top + matrix.length - 1,
      column: bounds.left + Math.max(...matrix.map((row) => row.length)) - 1
    }
  }
}

// ---- widget ---------------------------------------------------------

class TableWidget extends WidgetType {
  constructor(
    readonly model: TableModel,
    readonly readOnly: boolean,
    readonly revision: number,
    readonly presentation: TablePresentation,
    readonly source: string,
    readonly showSource: boolean
  ) {
    super()
  }

  // Cell typing keeps the current revision and DOM so the caret survives.
  // Structural edits and undo advance the revision to render fresh content,
  // even when the table dimensions and alignment have not changed.
  //
  // `readOnly` is part of the identity: cells are built editable or
  // inert at `toDOM` time, so a reading-mode toggle must force a fresh
  // DOM rather than reusing the stale (editable) one.
  eq(other: TableWidget): boolean {
    if (other.revision !== this.revision) return false
    if (other.readOnly !== this.readOnly) return false
    if (other.presentation !== this.presentation) return false
    if (other.showSource !== this.showSource) return false
    if (this.showSource) return other.source === this.source
    if (other.model.header.length !== this.model.header.length) return false
    if (other.model.rows.length !== this.model.rows.length) return false
    if (other.model.aligns.some((align, column) => align !== this.model.aligns[column]))
      return false
    return true
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = `kuskus-markdown-table-scroll cm-atomic-table${this.presentation === 'source' ? ' cm-atomic-table-source' : ''}`
    wrap.tabIndex = -1

    if (this.presentation === 'source') {
      const toggle = document.createElement('button')
      toggle.type = 'button'
      toggle.className = 'cm-atomic-table-source-toggle'
      toggle.textContent = this.showSource ? 'Show table' : 'View source'
      toggle.setAttribute('aria-label', this.showSource ? 'Show table' : 'View table source')
      toggle.setAttribute('aria-pressed', String(this.showSource))
      toggle.addEventListener('click', () => {
        const range = findCurrentTableRange(view, wrap)
        if (range)
          view.dispatch({ effects: toggleTableSource.of(view.state.doc.lineAt(range.from).from) })
      })
      wrap.appendChild(toggle)
    }

    if (this.showSource) {
      const source = document.createElement('pre')
      source.className = 'cm-atomic-table-raw-source'
      source.textContent = this.source
      wrap.appendChild(source)
      const updateOverflowState = () => {
        const maxScrollLeft = Math.max(0, source.scrollWidth - source.clientWidth)
        source.toggleAttribute('data-overflow-left', source.scrollLeft > 1)
        source.toggleAttribute('data-overflow-right', source.scrollLeft < maxScrollLeft - 1)
      }
      source.addEventListener('scroll', updateOverflowState, { passive: true })
      const resizeObserver = new ResizeObserver(updateOverflowState)
      resizeObserver.observe(source)
      tableCleanups.set(wrap, () => {
        source.removeEventListener('scroll', updateOverflowState)
        resizeObserver.disconnect()
      })
      return wrap
    }

    const table = document.createElement('table')
    table.className = 'kuskus-markdown-table'
    table.setAttribute('role', 'grid')
    table.setAttribute('aria-label', 'Markdown table')
    table.setAttribute('aria-multiselectable', 'true')
    table.setAttribute('aria-readonly', String(this.readOnly))
    const layout = document.createElement('div')
    layout.className = 'cm-atomic-table-layout'
    layout.style.setProperty('--cm-table-column-count', String(this.model.header.length))
    if (!this.readOnly) layout.dataset.editable = 'true'
    layout.appendChild(table)
    wrap.appendChild(layout)

    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    for (const [column, text] of this.model.header.entries()) {
      headerRow.appendChild(
        makeCell('th', text, view, this.model.aligns[column] ?? null, 0, column, this.presentation)
      )
    }
    thead.appendChild(headerRow)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    const colCount = this.model.header.length
    for (const [rowIndex, row] of this.model.rows.entries()) {
      const tr = document.createElement('tr')
      for (let c = 0; c < colCount; c++) {
        tr.appendChild(
          makeCell(
            'td',
            row[c] ?? '',
            view,
            this.model.aligns[c] ?? null,
            rowIndex + 1,
            c,
            this.presentation
          )
        )
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)

    if (!this.readOnly) {
      const addRow = document.createElement('button')
      addRow.type = 'button'
      addRow.className = 'cm-atomic-table-add cm-atomic-table-add-row'
      addRow.textContent = '+'
      addRow.title = 'Add row below'
      addRow.setAttribute('aria-label', 'Add row below')
      addRow.addEventListener('click', () => {
        const model = readModelFromDom(wrap)
        const row = model.rows.length + 1
        dispatchModel(view, wrap, insertTableRow(model, model.rows.length), {
          anchor: { row, column: 0 },
          head: { row, column: 0 }
        })
      })
      layout.appendChild(addRow)

      const addColumn = document.createElement('button')
      addColumn.type = 'button'
      addColumn.className = 'cm-atomic-table-add cm-atomic-table-add-column'
      addColumn.textContent = '+'
      addColumn.title = 'Add column to the right'
      addColumn.setAttribute('aria-label', 'Add column to the right')
      addColumn.addEventListener('click', () => {
        const model = readModelFromDom(wrap)
        const column = model.header.length
        dispatchModel(view, wrap, insertTableColumn(model, column), {
          anchor: { row: 0, column },
          head: { row: 0, column }
        })
      })
      layout.appendChild(addColumn)
      attachTableInteractions(view, wrap)
    }

    return wrap
  }

  // All cell interactions are handled by the listeners we attach in
  // `makeCell`; tell CM6 to stay out of events within the widget so
  // its own selection/click logic doesn't compete with contenteditable.
  ignoreEvent(): boolean {
    return true
  }

  destroy(dom: HTMLElement): void {
    tableCleanups.get(dom)?.()
    tableCleanups.delete(dom)
  }
}

function makeCell(
  tag: 'th' | 'td',
  text: string,
  view: EditorView,
  align: TableAlign | null,
  row: number,
  column: number,
  presentation: TablePresentation
): HTMLElement {
  const cell = document.createElement(tag)
  cell.dataset.raw = text
  cell.dataset.align = align ?? ''
  cell.dataset.row = String(row)
  cell.dataset.column = String(column)
  cell.setAttribute('role', tag === 'th' ? 'columnheader' : 'gridcell')
  cell.setAttribute('aria-rowindex', String(row + 1))
  cell.setAttribute('aria-colindex', String(column + 1))
  if (align) cell.setAttribute('align', align)

  // The cell itself is not contenteditable — only the inner source
  // element is. This keeps the image preview strictly visual (no
  // phantom caret positions around images) while the source text
  // stays in a dedicated editable box above it.
  const readOnly = view.state.facet(readOnlyFacet)
  const source = document.createElement('div')
  source.className = 'cm-atomic-table-cell-source'
  // Read-only cells still show their decorated source but accept no
  // edits — the editing listeners below are skipped entirely.
  source.contentEditable = readOnly ? 'false' : 'true'
  source.spellcheck = !readOnly
  // Decorated DOM on mount. Delimiters (`.cm-atomic-mark`) are
  // `display: none` by default — the caret can't navigate into them,
  // the reader sees a clean rendered view. When the caret enters a
  // mark wrap, JS adds `.active` to reveal that wrap's delimiters —
  // matching the outer-editor cursor-inside-link unfold, applied
  // uniformly to every inline mark inside cells.
  cell.appendChild(source)
  if (presentation === 'source') source.textContent = text
  else renderCellSourceDecorated(source)

  const addDragHandle = (axis: TableDragAxis) => {
    const handle = document.createElement('button')
    handle.type = 'button'
    handle.className = `cm-atomic-table-handle cm-atomic-table-${axis}-handle`
    handle.textContent = axis === 'column' ? '⋮' : '⋯'
    handle.title = axis === 'column' ? 'Select or drag column' : 'Select or drag row'
    handle.setAttribute('aria-label', handle.title)
    attachTableDragHandle(view, cell, handle, axis)
    cell.appendChild(handle)
  }
  if (!readOnly) {
    if (tag === 'th') addDragHandle('column')
    if (column === 0) addDragHandle('row')
  }

  // All write paths (typing, paste, IME, Tab/Enter navigation, the
  // context menu, focus-routing) live in `attachCellEditing` and are
  // wired only when the cell is editable. Read-only cells keep just the
  // link-open handlers below.
  if (!readOnly) attachCellEditing(view, cell, source, presentation)

  // Link open. The external-link icon is rendered as a real
  // `.cm-atomic-link-icon` element (see `renderCellToken`), not a CSS
  // `::after` pseudo — a pseudo-element has no event target, so clicking
  // its painted region dispatched no pointer event and the link never
  // opened. We open on `click` (a proper popup-activation gesture, so
  // `window.open` isn't blocked) and block the caret on `pointerdown`.
  //
  // In read-only mode and on Ctrl/Meta-click, the whole link opens.
  // Plain clicks in edit mode stay scoped to the trailing icon so the
  // text itself remains clickable-to-edit.
  const openTargetFromEvent = (event: Event): HTMLElement | null => {
    const target = event.target
    if (!(target instanceof Element)) return null
    const modifier = event instanceof MouseEvent && (event.metaKey || event.ctrlKey)
    const selector = readOnly || modifier ? '.cm-atomic-link-wrap' : '.cm-atomic-link-icon'
    return target.closest<HTMLElement>(selector)
  }

  source.addEventListener('pointerdown', (event) => {
    if (handleCellContextPointerDown(event, cell)) return
    if (event.button !== 0) return
    // Block focus / caret placement when pressing the open target; the
    // open happens on the following `click`.
    if (openTargetFromEvent(event)) event.preventDefault()
  })

  source.addEventListener('click', (event) => {
    const hit = openTargetFromEvent(event)
    if (!hit) return
    if (event.shiftKey || event.altKey) return
    const url = hit.closest<HTMLElement>('.cm-atomic-link-wrap')?.dataset.url
    if (!url) return
    event.preventDefault()
    event.stopPropagation()
    view.state.facet(tableLinkClickFacet)(url)
  })

  if (presentation === 'live') refreshCellPreview(cell)

  return cell
}

function attachTableInteractions(view: EditorView, wrap: HTMLElement): void {
  const table = wrap.querySelector<HTMLElement>('table')
  if (!table) return

  const updateOverflowState = () => {
    const max = Math.max(0, wrap.scrollWidth - wrap.clientWidth)
    wrap.toggleAttribute('data-overflow-left', wrap.scrollLeft > 1)
    wrap.toggleAttribute('data-overflow-right', wrap.scrollLeft < max - 1)
  }
  const resizeObserver = new ResizeObserver(updateOverflowState)
  resizeObserver.observe(wrap)
  resizeObserver.observe(table)
  wrap.addEventListener('scroll', updateOverflowState, { passive: true })
  requestAnimationFrame(updateOverflowState)

  const moveSelection = (rowDelta: number, columnDelta: number, extend: boolean): void => {
    const current = tableSelections.get(wrap)
    if (!current) return
    const model = readModelFromDom(wrap)
    const nextHead = {
      row: Math.min(model.rows.length, Math.max(0, current.head.row + rowDelta)),
      column: Math.min(model.header.length - 1, Math.max(0, current.head.column + columnDelta))
    }
    selectTableCells(wrap, {
      anchor: extend ? current.anchor : nextHead,
      head: nextHead
    })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const selection = tableSelections.get(wrap)
    if (!selection || event.target !== wrap) return
    const model = readModelFromDom(wrap)
    const mod = event.metaKey || event.ctrlKey
    let handled = true

    if (event.key === 'ArrowUp') {
      moveSelection(mod ? -selection.head.row : -1, 0, event.shiftKey)
    } else if (event.key === 'ArrowDown') {
      moveSelection(mod ? model.rows.length - selection.head.row : 1, 0, event.shiftKey)
    } else if (event.key === 'ArrowLeft') {
      moveSelection(0, mod ? -selection.head.column : -1, event.shiftKey)
    } else if (event.key === 'ArrowRight') {
      moveSelection(0, mod ? model.header.length - 1 - selection.head.column : 1, event.shiftKey)
    } else if (event.key === 'Home') {
      moveSelection(0, -selection.head.column, event.shiftKey)
    } else if (event.key === 'End') {
      moveSelection(0, model.header.length - 1 - selection.head.column, event.shiftKey)
    } else if (event.key === 'Tab') {
      const columns = model.header.length
      const flat = selection.head.row * columns + selection.head.column + (event.shiftKey ? -1 : 1)
      const clamped = Math.min((model.rows.length + 1) * columns - 1, Math.max(0, flat))
      const point = { row: Math.floor(clamped / columns), column: clamped % columns }
      selectTableCells(wrap, { anchor: point, head: point })
    } else if (event.key === 'Enter' || event.key === 'F2') {
      const source = getCellSource(cellAtPoint(wrap, selection.head) ?? wrap)
      if (source) {
        source.focus()
        placeCaretAtEnd(source)
      }
    } else if (event.key === 'Escape') {
      clearTableCellSelection(wrap)
      view.focus()
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      dispatchModel(view, wrap, clearTableSelection(model, selection), selection)
    } else if (mod && event.key.toLowerCase() === 'b') {
      dispatchModel(view, wrap, formatTableSelection(model, selection, 'bold'), selection)
    } else if (mod && event.key.toLowerCase() === 'i') {
      dispatchModel(view, wrap, formatTableSelection(model, selection, 'italic'), selection)
    } else if (mod && event.key.toLowerCase() === 'a') {
      selectTableCells(wrap, {
        anchor: { row: 0, column: 0 },
        head: { row: model.rows.length, column: model.header.length - 1 }
      })
    } else if (event.code === 'Space' && event.ctrlKey) {
      selectWholeColumn(wrap, selection.head.column)
    } else if (event.code === 'Space' && event.shiftKey) {
      selectWholeRow(wrap, selection.head.row)
    } else {
      handled = false
    }

    if (handled) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const onCopy = (event: ClipboardEvent) => {
    const selection = tableSelections.get(wrap)
    if (!selection || event.target !== wrap) return
    event.preventDefault()
    event.clipboardData?.setData(
      'text/plain',
      tableSelectionToTsv(readModelFromDom(wrap), selection)
    )
  }

  const onCut = (event: ClipboardEvent) => {
    const selection = tableSelections.get(wrap)
    if (!selection || event.target !== wrap) return
    onCopy(event)
    dispatchModel(view, wrap, clearTableSelection(readModelFromDom(wrap), selection), selection)
  }

  const onPaste = (event: ClipboardEvent) => {
    const selection = tableSelections.get(wrap)
    if (!selection || event.target !== wrap) return
    event.preventDefault()
    const matrix = parseTableClipboard(event.clipboardData?.getData('text/plain') ?? '')
    const sourceModel = readModelFromDom(wrap)
    const model = pasteTableSelection(sourceModel, selection, matrix)
    dispatchModel(view, wrap, model, selectionForPastedMatrix(sourceModel, selection, matrix))
  }

  let dragAnchor: TableCellPoint | null = null
  let pendingSourceDrag = false
  const onPointerMove = (event: PointerEvent) => {
    if (!dragAnchor) return
    const hit = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('th, td')
    if (!hit || hit.closest('.cm-atomic-table') !== wrap) return
    const head = pointForCell(hit)
    if (pendingSourceDrag) {
      if (head.row === dragAnchor.row && head.column === dragAnchor.column) return
      pendingSourceDrag = false
      window.getSelection()?.removeAllRanges()
    }
    event.preventDefault()
    selectTableCells(wrap, { anchor: dragAnchor, head }, true, false)
  }
  const endPointerSelection = () => {
    dragAnchor = null
    pendingSourceDrag = false
    window.removeEventListener('pointermove', onPointerMove, true)
    window.removeEventListener('pointerup', endPointerSelection, true)
    window.removeEventListener('pointercancel', endPointerSelection, true)
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    const target = event.target
    if (!(target instanceof Element)) return
    const cell = target.closest<HTMLElement>('th, td')
    if (!cell || cell.closest('.cm-atomic-table') !== wrap) return
    if (target.closest('.cm-atomic-table-handle')) return
    const source = getCellSource(cell)

    // Dragging the last few pixels of a header border resizes that
    // column. Width is deliberately view-local: Markdown has no
    // portable column-width syntax.
    if (cell.tagName === 'TH' && cell.getBoundingClientRect().right - event.clientX <= 7) {
      event.preventDefault()
      event.stopPropagation()
      const column = pointForCell(cell).column
      const startX = event.clientX
      const startWidth = cell.getBoundingClientRect().width
      const onResize = (moveEvent: PointerEvent) => {
        const width = Math.max(72, startWidth + moveEvent.clientX - startX)
        for (const candidate of getAllCells(wrap)) {
          if (pointForCell(candidate).column === column) candidate.style.width = `${width}px`
        }
      }
      const stopResize = () => {
        window.removeEventListener('pointermove', onResize, true)
        window.removeEventListener('pointerup', stopResize, true)
      }
      window.addEventListener('pointermove', onResize, true)
      window.addEventListener('pointerup', stopResize, true)
      return
    }

    const point = pointForCell(cell)
    const existing = tableSelections.get(wrap)
    dragAnchor = event.shiftKey && existing ? existing.anchor : point
    pendingSourceDrag = Boolean(source && source.contains(target) && !event.shiftKey)
    if (pendingSourceDrag) {
      clearTableCellSelection(wrap)
    } else {
      event.preventDefault()
      event.stopPropagation()
      selectTableCells(wrap, { anchor: dragAnchor, head: point }, true, false)
    }
    window.addEventListener('pointermove', onPointerMove, true)
    window.addEventListener('pointerup', endPointerSelection, true)
    window.addEventListener('pointercancel', endPointerSelection, true)
  }

  const onDocumentPointerDown = (event: PointerEvent) => {
    if (event.target instanceof Node && wrap.contains(event.target)) return
    clearTableCellSelection(wrap)
  }

  const onSelectionChange = () => {
    const active = document.activeElement
    if (
      active instanceof HTMLElement &&
      wrap.contains(active) &&
      active.classList.contains('cm-atomic-table-cell-source')
    ) {
      updateTableVimCursor(view, active)
    }
  }

  wrap.addEventListener('keydown', onKeyDown)
  wrap.addEventListener('copy', onCopy)
  wrap.addEventListener('cut', onCut)
  wrap.addEventListener('paste', onPaste)
  wrap.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('selectionchange', onSelectionChange)
  tableCleanups.set(wrap, () => {
    endPointerSelection()
    resizeObserver.disconnect()
    wrap.removeEventListener('scroll', updateOverflowState)
    document.removeEventListener('pointerdown', onDocumentPointerDown, true)
    document.removeEventListener('selectionchange', onSelectionChange)
  })
}

// Wire every write path for an editable cell: typing / paste / IME
// commits, caret-driven mark reveal, Tab/Enter cell navigation, the
// right-click context menu, and focus-routing for clicks that land
// outside the inner source element. Skipped wholesale for read-only
// cells, which keep only the link-open handlers in `makeCell`.
function attachCellEditing(
  view: EditorView,
  cell: HTMLElement,
  source: HTMLElement,
  presentation: TablePresentation
): void {
  const vimCursor = document.createElement('span')
  vimCursor.className = 'cm-atomic-table-vim-cursor'
  vimCursor.setAttribute('aria-hidden', 'true')
  vimCursor.hidden = true
  cell.appendChild(vimCursor)

  // Commit the cell's current DOM text to `dataset.raw`, re-render its
  // decorated form (so marks the user just typed — e.g. a new `**` pair
  // — decorate immediately), restore the caret across that rebuild, and
  // push the change into the document.
  const commit = () => {
    // textContent (not innerText) so `display: none` delimiters inside
    // mark wraps are still captured — otherwise a cell containing
    // `**bold**` would serialize to just `bold` on every keystroke.
    const raw = (source.textContent ?? '').replace(/\s+/g, ' ').trim()
    cell.dataset.raw = raw
    const offset = getCaretCharOffset(source)
    if (presentation === 'live') renderCellSourceDecorated(source)
    if (offset != null) setCaretCharOffset(source, offset)
    updateActiveMarkForSource(source)
    if (presentation === 'live') refreshCellPreview(cell)
    dispatchModelFromDom(view, cell)
  }

  // IME / dead-key composition. `commit` rebuilds the contenteditable
  // DOM, and doing that mid-composition cancels the composition session
  // — dropping CJK input, accented characters, and dictation. Suppress
  // every update while composing and run one commit when it ends.
  let composing = false
  source.addEventListener('compositionstart', () => {
    composing = true
  })
  source.addEventListener('compositionend', () => {
    composing = false
    commit()
  })

  source.addEventListener('input', (event) => {
    if (composing || (event as InputEvent).isComposing) return
    commit()
    updateTableVimCursor(view, source)
  })

  source.addEventListener('beforeinput', (event) => {
    if (vimIsNormal(view)) event.preventDefault()
  })

  // Paste: drop clipboard content in as a single line of plain text.
  // Without this, pasted rich HTML, newlines, or pipes land in the cell
  // verbatim; newlines and `|` corrupt the row. We flatten whitespace
  // and strip markup here, and `escapeCell` neutralizes any literal `|`
  // on serialize.
  source.addEventListener('paste', (event) => {
    event.preventDefault()
    if (vimIsNormal(view)) return
    const clipboardText = event.clipboardData?.getData('text/plain') ?? ''
    if (clipboardText.includes('\t') || /\r?\n/.test(clipboardText.trim())) {
      const wrap = cell.closest<HTMLElement>('.cm-atomic-table')
      if (!wrap) return
      const point = pointForCell(cell)
      const selection = { anchor: point, head: point }
      const matrix = parseTableClipboard(clipboardText)
      const model = readModelFromDom(wrap)
      dispatchModel(
        view,
        wrap,
        pasteTableSelection(model, selection, matrix),
        selectionForPastedMatrix(model, selection, matrix)
      )
      return
    }
    const text = clipboardText.replace(/\s+/g, ' ').trim()
    const sel = source.ownerDocument.defaultView?.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    range.deleteContents()
    range.insertNode(document.createTextNode(text))
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
    commit()
  })

  // Caret-position listeners. `focus` / `mouseup` / `keyup` cover the
  // three ways the caret can land in a new mark without firing an
  // input event (click-to-place, arrow-key nav, tab-into-cell). The
  // update is idempotent — redundant calls cost nothing.
  source.addEventListener('focus', () => {
    const wrap = cell.closest<HTMLElement>('.cm-atomic-table')
    if (wrap) clearTableCellSelection(wrap)
    updateActiveMarkForSource(source)
    updateTableVimCursor(view, source)
  })
  source.addEventListener('mouseup', () => {
    updateActiveMarkForSource(source)
    updateTableVimCursor(view, source)
  })
  source.addEventListener('keyup', () => {
    updateActiveMarkForSource(source)
    updateTableVimCursor(view, source)
  })

  // Blur: collapse every active wrap so the reader-resting state
  // hides all delimiters.
  source.addEventListener('blur', () => {
    clearActiveMarksInSource(source)
    source.removeAttribute('data-vim-normal')
    vimCursor.hidden = true
  })

  source.addEventListener('keydown', (event) => {
    if (event.isComposing) return
    const direction: CaretDirection | null =
      event.key === 'ArrowLeft' || (vimIsNormal(view) && event.key === 'h')
        ? 'left'
        : event.key === 'ArrowRight' || (vimIsNormal(view) && event.key === 'l')
          ? 'right'
          : event.key === 'ArrowUp' || (vimIsNormal(view) && event.key === 'k')
            ? 'up'
            : event.key === 'ArrowDown' || (vimIsNormal(view) && event.key === 'j')
              ? 'down'
              : null
    if (direction && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()
      moveTableCaret(view, cell, direction)
      return
    }
    if (event.key === 'Escape') {
      const wrap = cell.closest<HTMLElement>('.cm-atomic-table')
      if (!wrap) return
      event.preventDefault()
      event.stopPropagation()
      if (getCM(view)?.state.vim?.insertMode) sendVimCellKey(view, source, '<Esc>')
      else leaveTableCaret(view, wrap, 'right')
      return
    }
    if (
      vimIsNormal(view) &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete')
    ) {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'i') sendVimCellKey(view, source, 'i')
      return
    }
    if (event.code === 'Space' && (event.ctrlKey || event.shiftKey)) {
      const wrap = cell.closest<HTMLElement>('.cm-atomic-table')
      if (!wrap) return
      event.preventDefault()
      event.stopPropagation()
      if (event.ctrlKey) selectWholeColumn(wrap, pointForCell(cell).column)
      else selectWholeRow(wrap, pointForCell(cell).row)
      return
    }
    // Enter mirrors Tab — advance to the next cell (appending a row past
    // the last one) instead of inserting a line break a single-line cell
    // can't represent. Shift reverses direction for both.
    if (event.key === 'Tab' || event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      moveCellFocus(view, cell, event.shiftKey ? -1 : 1)
    }
  })

  cell.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    event.stopPropagation()
    openCellMenu(view, cell, event.clientX, event.clientY)
  })

  // When the cell has an image and the source is visually hidden,
  // clicks land on the cell/image/empty space but not on the source
  // itself. Route every pointerdown inside the cell to a focus on
  // the source so the user can edit regardless of where they tapped.
  // The image's own pointerdown handler already does this, but
  // covers only image hits — this covers empty padding and the
  // space between/around images.
  cell.addEventListener('pointerdown', (event) => {
    if (handleCellContextPointerDown(event, cell)) return
    // A click on the editable source — including its inner mark spans
    // and text — must keep the browser's native caret placement. Forcing
    // focus-at-end here would yank the caret to the end of the cell
    // whenever the user clicks a styled run (bold/italic/link). Only
    // intercept clicks that land OUTSIDE the source (cell padding, the
    // image preview, the cell box itself) to route focus into it.
    const target = event.target
    if (target instanceof Node && source.contains(target)) return
    event.preventDefault()
    source.focus()
    placeCaretAtEnd(source)
  })
}

// ---- context menu -------------------------------------------------

function cellRowIndex(cell: HTMLElement): number {
  // Rows are indexed within tbody (header isn't a "row" we can
  // insert-above; header context items are column-only).
  const tr = cell.closest<HTMLElement>('tr')
  const tbody = tr?.closest<HTMLElement>('tbody')
  if (!tr || !tbody) return -1
  return Array.from(tbody.querySelectorAll<HTMLElement>('tr')).indexOf(tr)
}

function cellColIndex(cell: HTMLElement): number {
  const tr = cell.closest<HTMLElement>('tr')
  if (!tr) return -1
  return Array.from(tr.querySelectorAll<HTMLElement>('th, td')).indexOf(cell)
}

function findTableWrapAt(view: EditorView, from: number): HTMLElement | null {
  for (const element of view.dom.querySelectorAll<HTMLElement>('.cm-atomic-table')) {
    try {
      if (view.posAtDOM(element) === from) return element
    } catch {
      // Ignore a detached widget while CodeMirror reconciles the view.
    }
  }
  return null
}

type TableMove = { axis: TableDragAxis; from: number; to: number }

function moveElements(wrap: HTMLElement, axis: TableDragAxis): HTMLElement[] {
  return Array.from(
    wrap.querySelectorAll<HTMLElement>(axis === 'row' ? 'thead tr, tbody tr' : 'thead th, tbody td')
  )
}

function originalIndexAt(newIndex: number, from: number, to: number): number {
  if (newIndex === to) return from
  if (from < to && newIndex >= from && newIndex < to) return newIndex + 1
  if (from > to && newIndex > to && newIndex <= from) return newIndex - 1
  return newIndex
}

function animateTableMove(wrap: HTMLElement, move: TableMove, previous: DOMRect[]): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const elements = moveElements(wrap, move.axis)
  const columnCount = wrap.querySelectorAll('thead th').length
  for (const [index, element] of elements.entries()) {
    const row = move.axis === 'row' ? 0 : Math.floor(index / columnCount)
    const position = move.axis === 'row' ? index : index % columnCount
    const oldIndex = originalIndexAt(position, move.from, move.to)
    const oldRect = previous[move.axis === 'row' ? oldIndex : row * columnCount + oldIndex]
    if (!oldRect) continue
    const newRect = element.getBoundingClientRect()
    const dx = oldRect.left - newRect.left
    const dy = oldRect.top - newRect.top
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
    element.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
      { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
    )
  }
}

function restoreTableViewAfterDispatch(
  view: EditorView,
  from: number,
  scrollLeft: number,
  selection?: TableSelection,
  move?: TableMove,
  previous?: DOMRect[]
): void {
  requestAnimationFrame(() => {
    if (view.state.facet(readOnlyFacet)) return
    const nextWrap = findTableWrapAt(view, from)
    if (!nextWrap) return
    nextWrap.scrollLeft = scrollLeft
    if (selection) selectTableCells(nextWrap, selection, true, false)
    if (move && previous) animateTableMove(nextWrap, move, previous)
  })
}

function dispatchModel(
  view: EditorView,
  wrap: HTMLElement,
  nextModel: TableModel,
  selection?: TableSelection,
  move?: TableMove
): void {
  // A menu can outlive the editable widget that created it when the
  // host toggles reading mode. Guard before touching its now-detached
  // DOM so a stale menu action cannot mutate a read-only document (or
  // make posAtDOM throw on the detached table wrapper).
  if (view.state.facet(readOnlyFacet)) return
  const range = findCurrentTableRange(view, wrap)
  if (!range) return
  const scrollLeft = wrap.scrollLeft
  const previous = move
    ? moveElements(wrap, move.axis).map((element) => element.getBoundingClientRect())
    : undefined
  const next = serializeTable(nextModel)
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: next }
  })
  restoreTableViewAfterDispatch(view, range.from, scrollLeft, selection, move, previous)
}

function deleteTable(view: EditorView, wrap: HTMLElement): void {
  if (view.state.facet(readOnlyFacet) || !view.dom.contains(wrap)) return
  const range = findCurrentTableRange(view, wrap)
  if (!range) return
  const start = view.state.doc.lineAt(range.from).from
  const endLine = view.state.doc.lineAt(range.to)
  const end = Math.min(view.state.doc.length, endLine.to + 1)
  view.dispatch({
    changes: { from: start, to: end },
    selection: EditorSelection.cursor(start),
    scrollIntoView: true,
    annotations: Transaction.userEvent.of('delete')
  })
  view.focus()
}

function openCellMenu(view: EditorView, cell: HTMLElement, x: number, y: number): void {
  const wrap = cell.closest<HTMLElement>('.cm-atomic-table')
  if (!wrap) return
  const isHeader = cell.tagName === 'TH'
  const row = cellRowIndex(cell)
  const col = cellColIndex(cell)
  const point = pointForCell(cell)
  const currentModel = readModelFromDom(wrap)
  let selection = tableSelections.get(wrap)
  if (!selection || !selectionContains(currentModel, selection, point)) {
    selection = { anchor: point, head: point }
    selectTableCells(wrap, selection, false, false)
  }
  const bounds = normalizeTableSelection(currentModel, selection)
  const selectedColumnCount = bounds.right - bounds.left + 1
  const firstSelectedBodyRow = Math.max(0, bounds.top - 1)
  const lastSelectedBodyRow = Math.min(currentModel.rows.length - 1, bounds.bottom - 1)
  const selectedBodyRowCount = Math.max(0, lastSelectedBodyRow - firstSelectedBodyRow + 1)

  const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'
  const formatItems: TableContextMenuEntry[] = [
    {
      label: 'Bold',
      icon: 'bold',
      shortcut: `${modifier}B`,
      action: () =>
        dispatchModel(
          view,
          wrap,
          formatTableSelection(readModelFromDom(wrap), selection, 'bold'),
          selection
        )
    },
    {
      label: 'Italic',
      icon: 'italic',
      shortcut: `${modifier}I`,
      action: () =>
        dispatchModel(
          view,
          wrap,
          formatTableSelection(readModelFromDom(wrap), selection, 'italic'),
          selection
        )
    },
    {
      label: 'Strikethrough',
      icon: 'strike',
      action: () =>
        dispatchModel(
          view,
          wrap,
          formatTableSelection(readModelFromDom(wrap), selection, 'strikethrough'),
          selection
        )
    }
  ]

  const rowItems: TableContextMenuEntry[] = [
    {
      label: 'Add row above',
      icon: 'add',
      action: () => dispatchModel(view, wrap, insertTableRow(readModelFromDom(wrap), row))
    },
    {
      label: 'Add row below',
      icon: 'add',
      action: () => dispatchModel(view, wrap, insertTableRow(readModelFromDom(wrap), row + 1))
    },
    'separator',
    {
      label: 'Move row up',
      icon: 'move-up',
      action: () =>
        dispatchModel(view, wrap, moveTableVisualRow(readModelFromDom(wrap), row + 1, row))
    },
    {
      label: 'Move row down',
      icon: 'move-down',
      disabled: row >= currentModel.rows.length - 1,
      action: () =>
        dispatchModel(view, wrap, moveTableVisualRow(readModelFromDom(wrap), row + 1, row + 2))
    },
    {
      label: 'Duplicate row',
      icon: 'duplicate',
      action: () => dispatchModel(view, wrap, duplicateTableRow(readModelFromDom(wrap), row))
    },
    'separator',
    {
      label: selectedBodyRowCount > 1 ? 'Delete rows' : 'Delete row',
      icon: 'delete',
      destructive: true,
      action: () =>
        dispatchModel(
          view,
          wrap,
          deleteTableRows(readModelFromDom(wrap), firstSelectedBodyRow, selectedBodyRowCount)
        )
    }
  ]

  const columnItems: TableContextMenuEntry[] = [
    {
      label: 'Add column left',
      icon: 'add',
      action: () => dispatchModel(view, wrap, insertTableColumn(readModelFromDom(wrap), col))
    },
    {
      label: 'Add column right',
      icon: 'add',
      action: () => dispatchModel(view, wrap, insertTableColumn(readModelFromDom(wrap), col + 1))
    },
    'separator',
    {
      label: 'Move column left',
      icon: 'move-left',
      disabled: col <= 0,
      action: () => dispatchModel(view, wrap, moveTableColumn(readModelFromDom(wrap), col, col - 1))
    },
    {
      label: 'Move column right',
      icon: 'move-right',
      disabled: col >= currentModel.header.length - 1,
      action: () => dispatchModel(view, wrap, moveTableColumn(readModelFromDom(wrap), col, col + 1))
    },
    {
      label: 'Duplicate column',
      icon: 'duplicate',
      action: () => dispatchModel(view, wrap, duplicateTableColumn(readModelFromDom(wrap), col))
    },
    'separator',
    {
      label: selectedColumnCount > 1 ? 'Delete columns' : 'Delete column',
      icon: 'delete',
      destructive: true,
      disabled: selectedColumnCount >= currentModel.header.length,
      action: () =>
        dispatchModel(
          view,
          wrap,
          deleteTableColumns(readModelFromDom(wrap), bounds.left, selectedColumnCount)
        )
    }
  ]

  const currentAlign = currentModel.aligns[col] ?? 'left'
  const alignItems: TableContextMenuEntry[] = (['left', 'center', 'right'] as const).map(
    (align) => ({
      label: `Align ${align}`,
      icon: align,
      checked: currentAlign === align,
      action: () => dispatchModel(view, wrap, setTableAlign(readModelFromDom(wrap), col, align))
    })
  )
  const rowMenuItems: TableContextMenuEntry[] = [
    {
      label: 'Row',
      icon: 'row',
      children: isHeader
        ? [
            {
              label: 'Move row down',
              icon: 'move-down',
              disabled: currentModel.rows.length === 0,
              action: () =>
                dispatchModel(view, wrap, moveTableVisualRow(readModelFromDom(wrap), 0, 1))
            }
          ]
        : rowItems
    }
  ]

  const items: TableContextMenuEntry[] = [
    {
      label: 'Copy',
      icon: 'copy',
      shortcut: `${modifier}C`,
      action: () =>
        navigator.clipboard.writeText(tableSelectionToTsv(readModelFromDom(wrap), selection))
    },
    {
      label: 'Cut',
      icon: 'cut',
      shortcut: `${modifier}X`,
      action: async () => {
        const model = readModelFromDom(wrap)
        await navigator.clipboard.writeText(tableSelectionToTsv(model, selection))
        dispatchModel(view, wrap, clearTableSelection(model, selection), selection)
      }
    },
    {
      label: 'Paste',
      icon: 'paste',
      shortcut: `${modifier}V`,
      action: async () => {
        const text = await navigator.clipboard.readText()
        const model = readModelFromDom(wrap)
        const matrix = parseTableClipboard(text)
        dispatchModel(
          view,
          wrap,
          pasteTableSelection(model, selection, matrix),
          selectionForPastedMatrix(model, selection, matrix)
        )
      }
    },
    {
      label: 'Clear cells',
      icon: 'clear',
      shortcut: 'Backspace',
      action: () =>
        dispatchModel(view, wrap, clearTableSelection(readModelFromDom(wrap), selection), selection)
    },
    'separator',
    { label: 'Format', icon: 'format', children: formatItems },
    ...rowMenuItems,
    { label: 'Column', icon: 'column', children: columnItems },
    { label: 'Alignment', icon: 'align', children: alignItems },
    {
      label: 'Sort',
      icon: 'sort',
      children: [
        {
          label: 'Ascending',
          icon: 'ascending',
          action: () => dispatchModel(view, wrap, sortTableRows(readModelFromDom(wrap), col, 'asc'))
        },
        {
          label: 'Descending',
          icon: 'descending',
          action: () =>
            dispatchModel(view, wrap, sortTableRows(readModelFromDom(wrap), col, 'desc'))
        }
      ]
    },
    'separator',
    {
      label: 'Delete table',
      icon: 'delete',
      destructive: true,
      confirmation: {
        title: 'Delete this table?',
        description: 'All rows and columns will be removed from this note. You can undo this action.'
      },
      action: () => deleteTable(view, wrap)
    }
  ]

  const selectedRows = bounds.bottom - bounds.top + 1
  const selectedColumns = bounds.right - bounds.left + 1
  const selectionLabel =
    selectedRows === 1 && selectedColumns === 1
      ? `Row ${bounds.top + 1}, column ${bounds.left + 1}`
      : `${selectedRows} × ${selectedColumns} cells`

  openTableContextMenu({ x, y, label: selectionLabel, entries: items })
}

function dispatchModelFromDom(view: EditorView, cell: HTMLElement): void {
  if (view.state.facet(readOnlyFacet)) return
  const wrap = cell.closest<HTMLElement>('.cm-atomic-table')
  if (!wrap) return
  const range = findCurrentTableRange(view, wrap)
  if (!range) return

  const model = readModelFromDom(wrap)
  const next = serializeTable(model)
  // Guard against no-op dispatches.
  if (view.state.sliceDoc(range.from, range.to) === next) return

  view.dispatch({
    changes: { from: range.from, to: range.to, insert: next },
    // Tag as typing so CM6's history coalesces consecutive cell edits
    // into one undo group instead of one step per keystroke (each of
    // which rewrites the whole table range).
    annotations: Transaction.userEvent.of('input.type')
  })
}

function moveCellFocus(view: EditorView, cell: HTMLElement, dir: 1 | -1): void {
  const wrap = cell.closest<HTMLElement>('.cm-atomic-table')
  if (!wrap) return
  const cells = getAllCells(wrap)
  const idx = cells.indexOf(cell)
  if (idx < 0) return

  const next = idx + dir
  if (next < 0) {
    // Shift-Tab from the first cell — blur the source; let the
    // browser decide where focus goes next (probably the previous
    // focusable element on the page). CM6 keeps its own selection
    // where it was.
    getCellSource(cell)?.blur()
    return
  }
  if (next >= cells.length) {
    // Tab past the last cell — append a new empty row and focus its
    // first cell. We dispatch through the same path as a cell edit,
    // then grab the new first cell after the DOM reconciles.
    appendRow(view, wrap)
    return
  }
  const source = getCellSource(cells[next])
  if (!source) return
  source.focus()
  placeCaretAtEnd(source)
}

type CaretDirection = 'left' | 'right' | 'up' | 'down'

function vimIsNormal(view: EditorView): boolean {
  const vim = getCM(view)?.state.vim
  return Boolean(vim && !vim.insertMode)
}

function updateTableVimCursor(view: EditorView, source: HTMLElement): void {
  const cell = source.closest<HTMLElement>('th, td')
  const cursor = cell?.querySelector<HTMLElement>('.cm-atomic-table-vim-cursor')
  if (!cell || !cursor) return
  const selection = window.getSelection()
  const visible =
    document.activeElement === source &&
    vimIsNormal(view) &&
    selection?.isCollapsed &&
    selection.rangeCount > 0 &&
    selection.anchorNode &&
    source.contains(selection.anchorNode)
  source.toggleAttribute('data-vim-normal', Boolean(visible))
  cursor.hidden = !visible
  if (!visible || !selection) return

  const caret = selection.getRangeAt(0)
  let rect = caret.getBoundingClientRect()
  let letter = '\u00a0'
  let letterNode: Node = source
  const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node as Text
    if (!textNode.length || !textNode.parentElement?.getClientRects().length) continue
    if (node !== caret.startContainer && caret.comparePoint(node, 0) < 0) continue
    const offset = node === caret.startContainer ? caret.startOffset : 0
    if (offset >= textNode.length) continue
    const codePoint = textNode.data.codePointAt(offset)
    if (codePoint === undefined) continue
    letter = String.fromCodePoint(codePoint)
    letterNode = node
    const character = document.createRange()
    character.setStart(node, offset)
    character.setEnd(node, offset + letter.length)
    rect = character.getBoundingClientRect()
    break
  }

  const style = getComputedStyle(letterNode.parentElement ?? source)
  const cellRect = cell.getBoundingClientRect()
  if (!rect.height) rect = source.getBoundingClientRect()
  cursor.textContent = letter
  cursor.style.left = `${rect.left - cellRect.left}px`
  cursor.style.top = `${rect.top - cellRect.top}px`
  cursor.style.width = rect.width > 0 ? `${rect.width}px` : '0.65em'
  cursor.style.height = rect.height > 0 ? `${rect.height}px` : style.lineHeight
  cursor.style.lineHeight = cursor.style.height
  cursor.style.fontFamily = style.fontFamily
  cursor.style.fontSize = style.fontSize
  cursor.style.fontWeight = style.fontWeight
  cursor.style.fontStyle = style.fontStyle
  cursor.style.letterSpacing = style.letterSpacing
}

function sendVimCellKey(view: EditorView, source: HTMLElement, key: string): void {
  const cm = getCM(view)
  if (!cm) return
  const selection = window.getSelection()
  const range =
    selection?.rangeCount && source.contains(selection.anchorNode)
      ? selection.getRangeAt(0).cloneRange()
      : null
  Vim.handleKey(cm, key, 'user')
  source.focus({ preventScroll: true })
  if (range) {
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  updateTableVimCursor(view, source)
}

function leaveTableCaret(view: EditorView, wrap: HTMLElement, direction: CaretDirection): void {
  const range = findCurrentTableRange(view, wrap)
  if (!range) return
  const before = direction === 'left' || direction === 'up'
  const pos = before ? Math.max(0, range.from - 1) : Math.min(view.state.doc.length, range.to + 1)
  view.dispatch({ selection: EditorSelection.cursor(pos), scrollIntoView: true })
  view.focus()
}

function moveTableCaret(view: EditorView, cell: HTMLElement, direction: CaretDirection): void {
  const wrap = cell.closest<HTMLElement>('.cm-atomic-table')
  const source = getCellSource(cell)
  const selection = window.getSelection()
  if (!wrap || !source || !selection || !selection.isCollapsed || !selection.rangeCount) return

  const original = selection.getRangeAt(0).cloneRange()
  const rect = original.getBoundingClientRect()
  const x = rect.left
  const forward = direction === 'right' || direction === 'down'
  selection.modify(
    'move',
    forward ? 'forward' : 'backward',
    direction === 'left' || direction === 'right' ? 'character' : 'line'
  )
  const moved =
    selection.rangeCount &&
    (selection.anchorNode !== original.startContainer ||
      selection.anchorOffset !== original.startOffset)
  if (moved && selection.anchorNode && source.contains(selection.anchorNode)) return

  selection.removeAllRanges()
  selection.addRange(original)
  const cells = getAllCells(wrap)
  const index = cells.indexOf(cell)
  const columns = wrap.querySelectorAll('thead th').length
  const next =
    index +
    (direction === 'left'
      ? -1
      : direction === 'right'
        ? 1
        : direction === 'up'
          ? -columns
          : columns)
  if (next < 0 || next >= cells.length) {
    leaveTableCaret(view, wrap, direction)
    return
  }
  focusCellCaret(
    view,
    cells[next],
    direction === 'left',
    direction === 'up' || direction === 'down' ? x : undefined
  )
}

function enterTableCaret(view: EditorView, direction: CaretDirection): boolean {
  if (view.state.facet(readOnlyFacet) || !view.state.selection.main.empty) return false
  const pos = view.state.selection.main.head
  const line = view.state.doc.lineAt(pos)
  let target: HTMLElement | null = null
  for (const wrap of view.dom.querySelectorAll<HTMLElement>('.cm-atomic-table')) {
    const range = findCurrentTableRange(view, wrap)
    if (!range) continue
    const tableStartLine = view.state.doc.lineAt(range.from).number
    const tableEndLine = view.state.doc.lineAt(range.to).number
    const fromBefore =
      direction === 'down'
        ? line.number === tableStartLine - 1
        : direction === 'right' && pos === range.from - 1
    const fromAfter =
      direction === 'up'
        ? line.number === tableEndLine + 1
        : direction === 'left' && pos === range.to + 1
    if (fromBefore || fromAfter) {
      const cells = getAllCells(wrap)
      target = fromBefore ? cells[0] : cells[cells.length - 1]
      break
    }
  }
  if (!target) return false
  focusCellCaret(view, target, direction === 'up' || direction === 'left')
  return true
}

function appendRow(view: EditorView, wrap: HTMLElement): void {
  if (view.state.facet(readOnlyFacet)) return
  const range = findCurrentTableRange(view, wrap)
  if (!range) return
  const model = readModelFromDom(wrap)
  model.rows.push(model.header.map(() => ''))
  const next = serializeTable(model)
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: next }
  })

  // Adding a row changes the widget's row count, so `eq` returns
  // false and CM6 rebuilds the widget DOM. The old `wrap` reference
  // is now detached. Wait for the paint that attaches the new DOM,
  // then look up the fresh widget by position and focus its new
  // last-row cell. Double-rAF because the first rAF only guarantees
  // CM6 has processed the dispatch; the second ensures the layout
  // has painted so focus commands don't get lost.
  const { from } = range
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (view.state.facet(readOnlyFacet)) return
      const tables = Array.from(view.dom.querySelectorAll<HTMLElement>('.cm-atomic-table'))
      let target: HTMLElement | null = null
      for (const el of tables) {
        try {
          if (view.posAtDOM(el) === from) {
            target = el
            break
          }
        } catch {
          // posAtDOM can throw on detached/transitional DOM nodes
          // — skip and keep looking.
        }
      }
      if (!target) return
      const rows = target.querySelectorAll<HTMLElement>('tbody tr')
      const newRow = rows[rows.length - 1]
      const firstCell = newRow?.querySelector<HTMLElement>('td')
      const firstSource = firstCell ? getCellSource(firstCell) : null
      if (!firstSource) return
      firstSource.focus()
      placeCaretAtEnd(firstSource)
    })
  })
}

// Backspace at the line immediately after a table normally deletes
// the `\n` separator and merges the line-below into the table's last
// source line. Lezer then re-parses the merged content as part of
// the table (or mangles it), producing the "swallow" behavior where
// content below the table looks like it's been absorbed as new rows.
//
// Instead, when the caret sits right after a Table and the user hits
// backspace, select the whole Table range — same pattern Obsidian
// uses for treating the table as an atomic unit for deletion. The
// caller can press backspace again to actually delete the selected
// table.
function backspaceAtTableBoundary(view: EditorView): boolean {
  const { state } = view
  if (state.facet(readOnlyFacet)) return false
  const sel = state.selection.main
  if (!sel.empty) return false
  const pos = sel.head
  if (pos === 0) return false

  const tree = syntaxTree(state)
  let tableBefore: SyntaxNode | null = null

  // Scan a few positions back for a Table whose end is adjacent to
  // the caret. `table.to` is the position just after the table's
  // last character — if the caret sits on the next line, `pos` will
  // be one past `table.to` (the \n separator at `table.to` + start
  // of the line after). Accept both.
  tree.iterate({
    from: Math.max(0, pos - 2),
    to: pos,
    enter: (n) => {
      if (n.name !== 'Table') return
      if (n.to === pos || n.to + 1 === pos) {
        tableBefore = n.node
      }
    }
  })

  if (!tableBefore) return false

  const range: SyntaxNode = tableBefore
  view.dispatch({
    selection: EditorSelection.range(range.from, range.to)
  })
  return true
}

// ---- state field ----------------------------------------------------

function buildTableWidgets(
  state: EditorState,
  revision: number,
  sourcePositions: ReadonlySet<number>
): DecorationSet {
  const ranges: Range<Decoration>[] = []
  const readOnly = state.facet(readOnlyFacet)
  const presentation = state.facet(tablePresentationFacet)
  // Force full-doc parse so tables past the initial parsed region
  // also get the widget treatment. This StateField only rebuilds on
  // doc change; CM6's background parser advancing the tree later
  // doesn't retrigger it, so a partial tree at mount means orphaned
  // `| col |` raw lines for the rest of the session. 200ms budget
  // bounds the worst case on very long atoms.
  const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state)
  const doc = state.doc

  tree.iterate({
    enter: (node) => {
      if (node.name !== 'Table') return
      const model = parseTable(state, node.node)
      if (!model) return

      // Block-replace needs whole-line coverage.
      const startLine = doc.lineAt(node.from)
      const endLine = doc.lineAt(node.to)
      ranges.push(
        Decoration.replace({
          widget: new TableWidget(
            model,
            readOnly,
            revision,
            presentation,
            state.sliceDoc(startLine.from, endLine.to),
            presentation === 'source' && sourcePositions.has(startLine.from)
          ),
          block: true
        }).range(startLine.from, endLine.to)
      )
      return false // don't descend
    }
  })

  return Decoration.set(ranges, true)
}

// Detect whether a doc change could have added, removed, or modified
// a Table node. Two cheap signals:
//
//   1. Any existing table decoration overlaps the changed range
//      (edit to / deletion of an existing table).
//   2. Any line touched by the change contains a pipe `|`. GFM
//      tables are pipe-delimited, so every table line has one and
//      editing one without touching a pipe character is impossible.
//      Prose rarely contains pipes; the occasional false positive
//      is fine because `buildTableWidgets` fails cleanly when
//      lezer didn't emit a Table.
//
// If neither fires, skip the full-doc walk and just map existing
// decorations through the change.
function changeAffectsTables(tr: Transaction, existing: DecorationSet): boolean {
  let affected = false
  tr.changes.iterChanges((fromA, toA) => {
    if (affected) return
    existing.between(fromA, toA, () => {
      affected = true
      return false
    })
  })
  if (affected) return true

  const state = tr.state
  tr.changes.iterChanges((_fromA, _toA, fromB, toB) => {
    if (affected) return
    const startLine = state.doc.lineAt(fromB)
    const endLine = toB > startLine.to ? state.doc.lineAt(toB) : startLine
    for (let n = startLine.number; n <= endLine.number; n++) {
      if (state.doc.line(n).text.includes('|')) {
        affected = true
        break
      }
    }
  })
  return affected
}

const toggleTableSource = StateEffect.define<number>()

type TableFieldValue = {
  decorations: DecorationSet
  revision: number
  sourcePositions: ReadonlySet<number>
}

const tableField = StateField.define<TableFieldValue>({
  create: (state) => ({
    decorations: buildTableWidgets(state, 0, new Set()),
    revision: 0,
    sourcePositions: new Set()
  }),
  update(value, tr) {
    const sourcePositions = new Set<number>()
    for (const position of value.sourcePositions) {
      sourcePositions.add(tr.changes.mapPos(position, 1))
    }
    for (const effect of tr.effects) {
      if (!effect.is(toggleTableSource)) continue
      if (sourcePositions.has(effect.value)) sourcePositions.delete(effect.value)
      else sourcePositions.add(effect.value)
      return {
        ...value,
        sourcePositions,
        decorations: buildTableWidgets(tr.state, value.revision, sourcePositions)
      }
    }
    // Tree-growth effect: lezer's background parser caught up to a
    // region that wasn't parsed when we last built. Rebuild so any
    // newly-visible Table nodes get their widget.
    for (const effect of tr.effects) {
      if (effect.is(treeGrowthEffect)) {
        return {
          ...value,
          sourcePositions,
          decorations: buildTableWidgets(tr.state, value.revision, sourcePositions)
        }
      }
    }
    // Reading-mode toggle: rebuild so cells re-render editable / inert.
    if (tr.startState.facet(readOnlyFacet) !== tr.state.facet(readOnlyFacet)) {
      return {
        ...value,
        sourcePositions,
        decorations: buildTableWidgets(tr.state, value.revision, sourcePositions)
      }
    }
    if (!tr.docChanged) return value
    const mapped = value.decorations.map(tr.changes)
    if (!changeAffectsTables(tr, value.decorations)) {
      return { ...value, sourcePositions, decorations: mapped }
    }
    // Cell typing already updated its live DOM. Other table edits (including
    // reorders and undo) must replace same-size widgets with fresh content.
    const revision =
      tr.annotation(Transaction.userEvent) === 'input.type' ? value.revision : value.revision + 1
    return {
      decorations: buildTableWidgets(tr.state, revision, sourcePositions),
      revision,
      sourcePositions
    }
  },
  provide: (f) => EditorView.decorations.from(f, (value) => value.decorations)
})

export interface TablesConfig {
  /**
   * Called when the user clicks the external-link icon on a link
   * rendered inside a table cell. Defaults to `window.open(url,
   * '_blank', 'noopener,noreferrer')`.
   */
  onLinkClick?: (url: string) => void
  presentation?: TablePresentation
}

type TablePresentation = 'live' | 'source'

const tablePresentationFacet = Facet.define<TablePresentation, TablePresentation>({
  combine: (values) => values[0] ?? 'live'
})

const defaultLinkOpener = (url: string): void => {
  try {
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch {
    // window.open can throw in sandboxed iframes etc.
  }
}

// Per-view facet so `makeCell`'s pointerdown handler can look up the
// current link-click callback. Avoids threading the config through the
// widget constructor and toDOM args.
export const tableLinkClickFacet = Facet.define<(url: string) => void, (url: string) => void>({
  combine: (values) => values[0] ?? defaultLinkOpener
})

export function tables(config: TablesConfig = {}): Extension {
  return [
    tablePresentationFacet.of(config.presentation ?? 'live'),
    tableField,
    treeProgressPlugin,
    ...(config.onLinkClick ? [tableLinkClickFacet.of(config.onLinkClick)] : []),
    // Vim's view-plugin keydown handler runs before CodeMirror's keymap.
    // A high-precedence DOM handler is needed to enter the widget before
    // Vim jumps over the replaced Markdown range.
    Prec.highest(
      EditorView.domEventHandlers({
        keydown(event, view) {
          if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false
          const direction: CaretDirection | null =
            event.key === 'ArrowLeft' || (vimIsNormal(view) && event.key === 'h')
              ? 'left'
              : event.key === 'ArrowRight' || (vimIsNormal(view) && event.key === 'l')
                ? 'right'
                : event.key === 'ArrowUp' || (vimIsNormal(view) && event.key === 'k')
                  ? 'up'
                  : event.key === 'ArrowDown' || (vimIsNormal(view) && event.key === 'j')
                    ? 'down'
                    : null
          return direction ? enterTableCaret(view, direction) : false
        }
      })
    ),
    // Prec.high so we run before the default Backspace binding.
    Prec.high(keymap.of([{ key: 'Backspace', run: backspaceAtTableBoundary }]))
  ]
}
