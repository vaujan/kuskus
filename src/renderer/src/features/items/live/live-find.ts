import { StateField, StateEffect, type EditorState, type Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import { SearchCursor, getSearchQuery, search } from '@codemirror/search'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { getCM } from '@replit/codemirror-vim'

import type { NoteFindResult, NoteFindTarget } from '@/features/items/note-editor'

export interface LiveFindState {
  query: string
  matchCase: boolean
  matches: Array<{ from: number; to: number }>
  current: number
}

const EMPTY: LiveFindState = { query: '', matchCase: false, matches: [], current: 0 }

type FindMeta =
  { type: 'search'; query: string; matchCase: boolean } | { type: 'move'; delta: 1 | -1 }

const setFind = StateEffect.define<FindMeta>()

// CodeMirror decorations cannot paint inside a replacement widget. Table cells
// are editable DOM owned by the table widget, so use the CSS Highlight API to
// paint their text without changing that DOM or disturbing its selection.
const widgetHighlights = new Map<EditorView, { matches: Range[]; current: Range[] }>()
const MATCH_HIGHLIGHT = 'kuskus-live-find-widget-match'
const CURRENT_HIGHLIGHT = 'kuskus-live-find-widget-current'

function paintWidgetHighlights(): void {
  const matches = new Highlight()
  const current = new Highlight()
  for (const ranges of widgetHighlights.values()) {
    ranges.matches.forEach((range) => matches.add(range))
    ranges.current.forEach((range) => current.add(range))
  }
  CSS.highlights.set(MATCH_HIGHLIGHT, matches)
  CSS.highlights.set(CURRENT_HIGHLIGHT, current)
}

function collectQueryMatches(
  cursor: Iterator<{ from: number; to: number }>
): Array<{ from: number; to: number }> {
  const matches: Array<{ from: number; to: number }> = []
  for (let next = cursor.next(); !next.done; next = cursor.next()) matches.push(next.value)
  return matches
}

function syncWidgetHighlights(view: EditorView): void {
  const find = view.state.field(liveFindField)
  const ranges = { matches: [] as Range[], current: [] as Range[] }
  view.dom.removeAttribute('data-vim-widget-match')
  for (const cursor of view.dom.querySelectorAll<HTMLElement>('[data-vim-search-cursor]')) {
    cursor.hidden = true
    delete cursor.dataset.vimSearchCursor
  }
  const vimQuery = getSearchQuery(view.state) as ReturnType<typeof getSearchQuery> & {
    forVim?: boolean
  }
  const vimSearch = !find.query && vimQuery.forVim && vimQuery.valid
  const vim = getCM(view)?.state.vim
  const vimNormalMode = Boolean(vimSearch && vim && !vim.insertMode)
  if (find.query || vimSearch) {
    const query = find.matchCase ? find.query : find.query.toLocaleLowerCase()
    const matches: Array<{ from: number; to: number }> = vimSearch
      ? collectQueryMatches(vimQuery.getCursor(view.state))
      : find.matches
    const selected = vimSearch
      ? matches.find(
          (match) =>
            match.from === view.state.selection.main.head ||
            (match.from < view.state.selection.main.head &&
              match.to > view.state.selection.main.head)
        )
      : find.matches[find.current]
    const vimPattern = vimSearch
      ? new RegExp(vimQuery.search, vimQuery.caseSensitive ? 'gmu' : 'gmiu')
      : null
    for (const table of view.dom.querySelectorAll<HTMLElement>('.cm-atomic-table')) {
      const tableFrom = view.posAtDOM(table)
      let node: SyntaxNode | null = syntaxTree(view.state).resolveInner(tableFrom, 1)
      while (node && node.name !== 'Table') node = node.parent
      if (!node) continue
      const tableMatches = matches.filter((match) => match.from >= node.from && match.to <= node.to)
      const selectedIndex = selected ? tableMatches.indexOf(selected) : -1
      let visibleIndex = 0
      for (const source of table.querySelectorAll<HTMLElement>('.cm-atomic-table-cell-source')) {
        const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) =>
            (node.parentElement as HTMLElement | null)?.closest('.cm-atomic-mark')
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_ACCEPT
        })
        while (walker.nextNode()) {
          const node = walker.currentNode as Text
          const text = find.matchCase ? node.data : node.data.toLocaleLowerCase()
          let offset = 0
          while (true) {
            const vimMatch = vimPattern?.exec(node.data)
            offset = vimPattern ? (vimMatch?.index ?? -1) : text.indexOf(query, offset)
            if (offset < 0) break
            const length = vimMatch?.[0].length ?? query.length
            if (!length) {
              vimPattern!.lastIndex++
              continue
            }
            const range = document.createRange()
            range.setStart(node, offset)
            range.setEnd(node, offset + length)
            ranges.matches.push(range)
            if (visibleIndex === selectedIndex) {
              ranges.current.push(range)
              if (vimNormalMode) showWidgetVimCursor(view, range)
            }
            visibleIndex++
            offset += length
          }
          if (vimPattern) vimPattern.lastIndex = 0
        }
      }
    }
  }
  widgetHighlights.set(view, ranges)
  paintWidgetHighlights()
}

function showWidgetVimCursor(view: EditorView, range: Range): void {
  const cell = range.startContainer.parentElement?.closest<HTMLElement>('th, td')
  const cursor = cell?.querySelector<HTMLElement>('.cm-atomic-table-vim-cursor')
  if (!cell || !cursor) return
  const node = range.startContainer as Text
  const letter = String.fromCodePoint(node.data.codePointAt(range.startOffset) ?? 32)
  const character = document.createRange()
  character.setStart(node, range.startOffset)
  character.setEnd(node, range.startOffset + letter.length)
  const rect = character.getBoundingClientRect()
  const cellRect = cell.getBoundingClientRect()
  const style = getComputedStyle(range.startContainer.parentElement ?? cell)
  cursor.textContent = letter
  cursor.style.left = `${rect.left - cellRect.left}px`
  cursor.style.top = `${rect.top - cellRect.top}px`
  cursor.style.width = `${rect.width}px`
  cursor.style.height = `${rect.height}px`
  cursor.style.lineHeight = `${rect.height}px`
  cursor.style.fontFamily = style.fontFamily
  cursor.style.fontSize = style.fontSize
  cursor.style.fontWeight = style.fontWeight
  cursor.style.fontStyle = style.fontStyle
  cursor.style.letterSpacing = style.letterSpacing
  cursor.dataset.vimSearchCursor = 'true'
  cursor.hidden = false
  view.dom.setAttribute('data-vim-widget-match', '')
}

const widgetFindHighlights = ViewPlugin.fromClass(
  class {
    constructor(readonly view: EditorView) {
      syncWidgetHighlights(view)
    }

    update(update: ViewUpdate): void {
      if (update.transactions.length || update.viewportChanged) {
        syncWidgetHighlights(update.view)
      }
    }

    destroy(): void {
      widgetHighlights.delete(this.view)
      paintWidgetHighlights()
    }
  }
)

export function collectMatches(
  state: EditorState,
  query: string,
  matchCase: boolean
): Array<{ from: number; to: number }> {
  if (!query) return []
  const cursor = new SearchCursor(
    state.doc,
    query,
    0,
    state.doc.length,
    matchCase ? undefined : (text) => text.toLowerCase()
  )
  const matches: Array<{ from: number; to: number }> = []
  while (!cursor.next().done) {
    matches.push({ from: cursor.value.from, to: cursor.value.to })
  }
  return matches
}

function findDecorations(find: LiveFindState): DecorationSet {
  if (!find.matches.length) return Decoration.none
  const visibleMatches = find.matches.slice(0, 1000)
  if (find.current >= visibleMatches.length) visibleMatches.push(find.matches[find.current])
  return Decoration.set(
    visibleMatches.map((match) =>
      Decoration.mark({
        class:
          match === find.matches[find.current] ? 'cm-kuskus-find-current' : 'cm-kuskus-find-match'
      }).range(match.from, match.to)
    ),
    true
  )
}

export const liveFindField = StateField.define<LiveFindState>({
  create: () => EMPTY,
  update: (value, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setFind)) {
        const meta = effect.value
        if (meta.type === 'search') {
          const query = meta.query
          return {
            query,
            matchCase: meta.matchCase,
            matches: collectMatches(transaction.state, query, meta.matchCase),
            current: 0
          }
        }
        if (value.matches.length) {
          return {
            ...value,
            current: (value.current + meta.delta + value.matches.length) % value.matches.length
          }
        }
      }
    }
    if (transaction.docChanged && value.query) {
      const matches = collectMatches(transaction.state, value.query, value.matchCase)
      return {
        ...value,
        matches,
        current: Math.min(value.current, Math.max(0, matches.length - 1))
      }
    }
    return value
  },
  provide: (field) => EditorView.decorations.from(field, (find) => findDecorations(find))
})

function createActions(view: EditorView): NoteFindTarget {
  const report = (): NoteFindResult => {
    const find = view.state.field(liveFindField)
    return { current: find.matches.length ? find.current + 1 : 0, total: find.matches.length }
  }
  const selectCurrent = (): void => {
    const find = view.state.field(liveFindField)
    const match = find.matches[find.current]
    if (match) {
      view.dispatch({
        selection: { anchor: match.from, head: match.to },
        effects: EditorView.scrollIntoView(match.from, { y: 'center' }),
        userEvent: 'select.search'
      })
      widgetHighlights.get(view)?.current[0]?.startContainer.parentElement?.scrollIntoView({
        block: 'center',
        inline: 'nearest'
      })
    }
  }
  const step = (delta: 1 | -1): void => {
    view.dispatch({ effects: setFind.of({ type: 'move', delta }) })
    selectCurrent()
  }
  return {
    focus() {
      view.focus()
    },
    search(query, matchCase) {
      view.dispatch({ effects: setFind.of({ type: 'search', query, matchCase }) })
      selectCurrent()
      return report()
    },
    next() {
      step(1)
      return report()
    },
    prev() {
      step(-1)
      return report()
    },
    replaceCurrent(replacement) {
      const find = view.state.field(liveFindField)
      const match = find.matches[find.current]
      if (!match) return report()
      view.dispatch({
        changes: { from: match.from, to: match.to, insert: replacement },
        selection: { anchor: match.from + replacement.length },
        userEvent: 'input.replace'
      })
      return report()
    },
    replaceAll(replacement) {
      const find = view.state.field(liveFindField)
      if (!find.matches.length) return report()
      view.dispatch({
        changes: find.matches.map((match) => ({
          from: match.from,
          to: match.to,
          insert: replacement
        })),
        userEvent: 'input.replace.all'
      })
      return report()
    }
  }
}

export function liveFindExtensions(): Extension {
  // Vim's / search dispatches setSearchQuery. The search state must be
  // installed for getSearchQuery to expose that query to table widgets.
  return [search(), liveFindField, widgetFindHighlights]
}

export function wireLiveFind(
  view: EditorView,
  targetRef: { current: NoteFindTarget | null }
): void {
  targetRef.current = createActions(view)
}

export function unwireLiveFind(targetRef: { current: NoteFindTarget | null }): void {
  targetRef.current = null
}
