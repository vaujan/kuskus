import { StateField, StateEffect, type EditorState, type Extension } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import { SearchCursor, search } from '@codemirror/search'

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
  while (cursor.next()) {
    matches.push({ from: cursor.value.from, to: cursor.value.to })
  }
  return matches
}

function findDecorations(find: LiveFindState): DecorationSet {
  if (!find.matches.length) return Decoration.none
  return Decoration.set(
    find.matches.map((match, index) =>
      Decoration.mark({
        class: index === find.current ? 'cm-kuskus-find-current' : 'cm-kuskus-find-match'
      }).range(match.from, match.to)
    )
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
  const step = (delta: 1 | -1): void => {
    view.dispatch({ effects: setFind.of({ type: 'move', delta }) })
  }
  return {
    search(query, matchCase) {
      view.dispatch({ effects: setFind.of({ type: 'search', query, matchCase }) })
      return report()
    },
    next() {
      step(1)
      return report()
    },
    prev() {
      step(-1)
      return report()
    }
  }
}

export function liveFindExtensions(): Extension {
  return [liveFindField, search()]
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
