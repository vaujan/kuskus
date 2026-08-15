import { useCallback, useEffect, useRef, useState } from 'react'
import { IconChevronDown, IconChevronUp, IconSearch, IconX } from '@tabler/icons-react'

const FIND_RESULT_ATTRIBUTE = 'data-kuskus-find-result'

function unwrapFindMarks(scope: HTMLElement): void {
  scope.querySelectorAll(`[${FIND_RESULT_ATTRIBUTE}]`).forEach((node) => {
    const parent = node.parentNode
    if (!parent) return
    while (node.firstChild) parent.insertBefore(node.firstChild, node)
    parent.removeChild(node)
    parent.normalize()
  })
}

export function NoteFind({
  enabled,
  scopeRef,
  onOpenChange
}: {
  enabled: boolean
  scopeRef: React.RefObject<HTMLDivElement | null>
  onOpenChange?: (open: boolean) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryRef = useRef('')
  const currentRef = useRef(0)
  const navigateRef = useRef(false)
  const observerRef = useRef<MutationObserver | null>(null)
  const debounceRef = useRef<number | null>(null)

  const changeOpen = useCallback(
    (next: boolean): void => {
      setOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange]
  )

  const applyHighlights = useCallback((): void => {
    const scope = scopeRef.current
    if (!scope) return
    const normalized = queryRef.current.toLocaleLowerCase()
    observerRef.current?.disconnect()

    unwrapFindMarks(scope)
    if (!normalized) {
      setTotal(0)
      setCurrent(0)
      currentRef.current = 0
      return
    }

    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT
        const parent = node.parentNode as HTMLElement | null
        if (!parent || parent.closest(`[${FIND_RESULT_ATTRIBUTE}]`)) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
    })
    const textNodes: Text[] = []
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

    let index = 0
    let currentMark: HTMLElement | null = null
    for (const textNode of textNodes) {
      const value = textNode.nodeValue ?? ''
      let rest = value
      let found = rest.toLocaleLowerCase().indexOf(normalized)
      while (found !== -1) {
        const before = rest.slice(0, found)
        if (before) textNode.parentNode?.insertBefore(document.createTextNode(before), textNode)
        const mark = document.createElement('mark')
        mark.setAttribute(FIND_RESULT_ATTRIBUTE, '')
        if (index === currentRef.current) {
          mark.dataset.current = 'true'
          currentMark = mark
        }
        mark.textContent = rest.slice(found, found + normalized.length)
        textNode.parentNode?.insertBefore(mark, textNode)
        rest = rest.slice(found + normalized.length)
        found = rest.toLocaleLowerCase().indexOf(normalized)
        index += 1
      }
      if (rest) textNode.parentNode?.insertBefore(document.createTextNode(rest), textNode)
      textNode.parentNode?.removeChild(textNode)
    }

    const clamped = Math.min(currentRef.current, Math.max(0, index - 1))
    if (clamped !== currentRef.current) {
      currentRef.current = clamped
      setCurrent(clamped)
    }
    setTotal(index)
    if (navigateRef.current && currentMark) {
      navigateRef.current = false
      requestAnimationFrame(() => currentMark?.scrollIntoView({ block: 'center' }))
    }
  }, [scopeRef])

  const requestApply = useCallback((): void => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(applyHighlights, 120)
  }, [applyHighlights])

  const active = enabled && open

  useEffect(() => {
    queryRef.current = query
    if (!active) return
    if (query) requestApply()
    else applyHighlights()
  }, [active, applyHighlights, query, requestApply])

  useEffect(() => {
    if (!enabled) return
    const handleFindShortcut = (event: KeyboardEvent): void => {
      const key = event.key.toLocaleLowerCase()
      if (!(event.ctrlKey || event.metaKey) || key !== 'f') return
      const target = event.target as Node | null
      if (
        target instanceof Element &&
        target.closest('input:not([data-kuskus-find-input]), textarea')
      ) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      changeOpen(true)
    }
    window.addEventListener('keydown', handleFindShortcut, true)
    return () => window.removeEventListener('keydown', handleFindShortcut, true)
  }, [changeOpen, enabled])

  useEffect(() => {
    if (!active) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [active])

  useEffect(() => {
    if (!active) return
    const scope = scopeRef.current
    if (!scope) return
    const observer = new MutationObserver(requestApply)
    observerRef.current = observer
    observer.observe(scope, { subtree: true, childList: true, characterData: true })
    return () => {
      observer.disconnect()
      observerRef.current = null
    }
  }, [active, requestApply, scopeRef])

  useEffect(() => {
    if (active) return
    queryRef.current = ''
    currentRef.current = 0
    observerRef.current?.disconnect()
    const scope = scopeRef.current
    if (scope) unwrapFindMarks(scope)
  }, [active, scopeRef])

  const goTo = useCallback(
    (next: number): void => {
      if (total === 0) return
      currentRef.current = ((next % total) + total) % total
      setCurrent(currentRef.current)
      navigateRef.current = true
      applyHighlights()
    },
    [applyHighlights, total]
  )

  if (!active) return <span hidden />

  return (
    <div
      className="absolute top-2 right-2 z-40 flex items-center gap-1 rounded-lg border border-border/70 bg-popover/95 p-1 shadow-[0_4px_16px_rgb(0_0_0/0.12)] backdrop-blur-sm"
      role="group"
      aria-label="Find in note"
    >
      <IconSearch aria-hidden="true" className="ml-1.5 size-4 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        data-kuskus-find-input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            goTo(event.shiftKey ? current - 1 : current + 1)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            changeOpen(false)
          }
        }}
        placeholder="Find"
        aria-label="Find in note"
        className="h-7 w-40 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
      />
      <span
        aria-live="polite"
        className="min-w-9 text-center text-xs tabular-nums text-muted-foreground"
      >
        {total === 0 ? '0/0' : `${current + 1}/${total}`}
      </span>
      <button
        type="button"
        className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Previous match"
        disabled={total === 0}
        onClick={() => goTo(current - 1)}
      >
        <IconChevronUp aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Next match"
        disabled={total === 0}
        onClick={() => goTo(current + 1)}
      >
        <IconChevronDown aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Close find"
        onClick={() => changeOpen(false)}
      >
        <IconX aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
