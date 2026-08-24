import type { RefObject } from 'react'

import type { NoteFindResult, NoteFindTarget } from '@/features/items/note-editor'

const MARK_ATTRIBUTE = 'data-kuskus-find-result'

function unwrapMarks(scope: HTMLElement): void {
  scope.querySelectorAll(`[${MARK_ATTRIBUTE}]`).forEach((node) => {
    const parent = node.parentNode
    if (!parent) return
    while (node.firstChild) parent.insertBefore(node.firstChild, node)
    parent.removeChild(node)
    parent.normalize()
  })
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
        if (!parent || parent.closest(`[${MARK_ATTRIBUTE}]`)) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
    })
    const textNodes: Text[] = []
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

    let index = 0
    for (const textNode of textNodes) {
      const value = textNode.nodeValue ?? ''
      let rest = value
      let searchable = matchCase ? rest : rest.toLocaleLowerCase()
      let found = searchable.indexOf(normalized)
      while (found !== -1) {
        const before = rest.slice(0, found)
        if (before) textNode.parentNode?.insertBefore(document.createTextNode(before), textNode)
        const mark = document.createElement('mark')
        mark.setAttribute(MARK_ATTRIBUTE, '')
        if (index === current) mark.dataset.current = 'true'
        mark.textContent = rest.slice(found, found + normalized.length)
        textNode.parentNode?.insertBefore(mark, textNode)
        rest = rest.slice(found + normalized.length)
        searchable = matchCase ? rest : rest.toLocaleLowerCase()
        found = searchable.indexOf(normalized)
        index += 1
      }
      if (rest) textNode.parentNode?.insertBefore(document.createTextNode(rest), textNode)
      textNode.parentNode?.removeChild(textNode)
    }
    current = Math.min(current, Math.max(0, index - 1))
    total = index
    if (index > 0) {
      scope.querySelector(`[${MARK_ATTRIBUTE}][data-current]`)?.scrollIntoView({ block: 'center' })
    }
    return { current: index ? current + 1 : 0, total: index }
  }

  return {
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
