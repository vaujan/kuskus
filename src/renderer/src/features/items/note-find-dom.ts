import type { RefObject } from 'react'

import type { NoteFindResult, NoteFindTarget } from '@/features/items/note-editor'

const MARK_ATTRIBUTE = 'data-kuskus-find-result'

function unwrapMarks(scope: HTMLElement): void {
  const parents = new Set<Node>()
  scope.querySelectorAll(`[${MARK_ATTRIBUTE}]`).forEach((node) => {
    const parent = node.parentNode
    if (!parent) return
    while (node.firstChild) parent.insertBefore(node.firstChild, node)
    parent.removeChild(node)
    parents.add(parent)
  })
  parents.forEach((parent) => parent.normalize())
}

/**
 * Find target for static rendered HTML (read-mode preview). Highlights are plain
 * <mark> elements — safe here because nothing owns this DOM.
 */
export function createDomFindTarget(scopeRef: RefObject<HTMLElement | null>): NoteFindTarget {
  let current = 0
  let total = 0
  let query = ''
  let matchCase = false

  const highlight = (query: string, matchCase: boolean): NoteFindResult => {
    const scope = scopeRef.current
    if (!scope) return { current: 0, total: 0 }
    unwrapMarks(scope)
    const normalized = matchCase ? query : query.toLocaleLowerCase()
    if (!normalized) return { current: 0, total: 0 }

    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT
        const parent = node.parentNode as HTMLElement | null
        if (
          !parent ||
          parent.closest(`[${MARK_ATTRIBUTE}], script, style, textarea, [contenteditable="true"]`)
        ) {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      }
    })
    const textNodes: Text[] = []
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

    const marks: HTMLElement[] = []
    for (const textNode of textNodes) {
      const value = textNode.nodeValue ?? ''
      let rest = value
      let searchable = matchCase ? rest : rest.toLocaleLowerCase()
      let found = searchable.indexOf(normalized)
      if (found === -1) continue
      const fragment = document.createDocumentFragment()
      while (found !== -1) {
        const before = rest.slice(0, found)
        if (before) fragment.append(document.createTextNode(before))
        const mark = document.createElement('mark')
        mark.setAttribute(MARK_ATTRIBUTE, '')
        mark.textContent = rest.slice(found, found + normalized.length)
        marks.push(mark)
        fragment.append(mark)
        rest = rest.slice(found + normalized.length)
        searchable = matchCase ? rest : rest.toLocaleLowerCase()
        found = searchable.indexOf(normalized)
      }
      if (rest) fragment.append(document.createTextNode(rest))
      textNode.replaceWith(fragment)
    }
    current = Math.min(current, Math.max(0, marks.length - 1))
    total = marks.length
    if (marks.length > 0) {
      marks[current].dataset.current = 'true'
      marks[current].scrollIntoView({ block: 'center' })
    }
    return { current: marks.length ? current + 1 : 0, total: marks.length }
  }

  return {
    focus() {
      scopeRef.current?.focus({ preventScroll: true })
    },
    search(newQuery, newMatchCase) {
      query = newQuery
      matchCase = newMatchCase
      current = 0
      return highlight(query, matchCase)
    },
    next() {
      if (total) current = (current + 1) % total
      return highlight(query, matchCase)
    },
    prev() {
      if (total) current = (current - 1 + total) % total
      return highlight(query, matchCase)
    }
  }
}
