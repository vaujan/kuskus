import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state'
import type { Node as ProseNode } from '@milkdown/prose/model'
import { Decoration, DecorationSet, type EditorView } from '@milkdown/prose/view'
import { $prose } from '@milkdown/utils'

import type {
  NoteFindResult,
  NoteFindTarget,
  NoteFindTargetRef
} from '@/features/items/note-editor'

interface FindState {
  query: string
  matchCase: boolean
  matches: { from: number; to: number }[]
  current: number
}

const EMPTY_FIND: FindState = { query: '', matchCase: false, matches: [], current: 0 }

type FindMeta =
  | { type: 'search'; query: string; matchCase: boolean }
  | { type: 'move'; delta: 1 | -1 }

function collectMatches(
  doc: ProseNode,
  query: string,
  matchCase: boolean
): { from: number; to: number }[] {
  const needle = matchCase ? query : query.toLowerCase()
  if (!needle) return []
  const matches: { from: number; to: number }[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const haystack = matchCase ? node.text : node.text.toLowerCase()
    let index = haystack.indexOf(needle)
    while (index !== -1) {
      matches.push({ from: pos + index, to: pos + index + needle.length })
      index = haystack.indexOf(needle, index + needle.length)
    }
  })
  return matches
}

const richMarkdownFindKey = new PluginKey<FindState>('rich-markdown-find')

function findDecorations(state: { doc: ProseNode }, find: FindState): DecorationSet {
  if (!find.matches.length) return DecorationSet.empty
  return DecorationSet.create(
    state.doc,
    find.matches.map((match, index) =>
      Decoration.inline(match.from, match.to, {
        class:
          index === find.current
            ? 'rich-find-match rich-find-match-current'
            : 'rich-find-match'
      })
    )
  )
}

export function createRichMarkdownFind(view: EditorView): NoteFindTarget {
  const report = (): NoteFindResult => {
    const find = richMarkdownFindKey.getState(view.state) ?? EMPTY_FIND
    return { current: find.matches.length ? find.current + 1 : 0, total: find.matches.length }
  }

  const step = (delta: 1 | -1): void => {
    const find = richMarkdownFindKey.getState(view.state)
    if (!find?.matches.length) return
    view.dispatch(view.state.tr.setMeta(richMarkdownFindKey, { type: 'move', delta }))
    const next = richMarkdownFindKey.getState(view.state)
    const match = next?.matches[next.current]
    if (!match) return
    view.dispatch(
      view.state.tr
        .setSelection(TextSelection.create(view.state.doc, match.from, match.to))
        .scrollIntoView()
    )
  }

  return {
    search(query, matchCase) {
      view.dispatch(
        view.state.tr.setMeta(richMarkdownFindKey, {
          type: 'search',
          query,
          matchCase
        })
      )
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

export function richMarkdownFind(target: NoteFindTargetRef): ReturnType<typeof $prose> {
  return $prose(() => {
    let actions: NoteFindTarget | null = null
    return new Plugin<FindState>({
      key: richMarkdownFindKey,
      state: {
        init: () => EMPTY_FIND,
        apply(tr, value) {
          const meta = tr.getMeta(richMarkdownFindKey) as FindMeta | undefined
          if (meta?.type === 'search') {
            return {
              query: meta.query,
              matchCase: meta.matchCase,
              matches: collectMatches(tr.doc, meta.query, meta.matchCase),
              current: 0
            }
          }
          if (meta?.type === 'move' && value.matches.length) {
            return {
              ...value,
              current:
                (value.current + meta.delta + value.matches.length) % value.matches.length
            }
          }
          if (tr.docChanged && value.query) {
            // ponytail: rescan whole document per keystroke; revisit if notes grow large
            const matches = collectMatches(tr.doc, value.query, value.matchCase)
            return {
              ...value,
              matches,
              current: Math.min(value.current, Math.max(0, matches.length - 1))
            }
          }
          return value
        }
      },
      props: {
        decorations: (state) => {
          const find = richMarkdownFindKey.getState(state)
          return find ? findDecorations(state, find) : DecorationSet.empty
        }
      },
      view: (view) => {
        actions = createRichMarkdownFind(view)
        target.current = actions
        return {
          destroy: () => {
            if (target.current === actions) target.current = null
          }
        }
      }
    })
  })
}
