import { StateField, StateEffect, type EditorState, type Extension } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import { SearchCursor } from '@codemirror/search'

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
  return liveFindField
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
