import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconChevronDown,
  IconChevronUp,
  IconLetterCase,
  IconSearch,
  IconX
} from '@tabler/icons-react'

import type { NoteFindTargetRef } from '@/features/items/note-editor'

export function NoteFind({
  enabled,
  target: targetRef,
  onOpenChange
}: {
  enabled: boolean
  target: NoteFindTargetRef
  onOpenChange?: (open: boolean) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [result, setResult] = useState({ current: 0, total: 0 })
  const inputRef = useRef<HTMLInputElement>(null)

  const changeOpen = useCallback(
    (next: boolean): void => {
      setOpen(next)
      if (!next) {
        targetRef.current?.search('', false)
        setResult({ current: 0, total: 0 })
      }
      onOpenChange?.(next)
    },
    [onOpenChange, targetRef]
  )

  const active = enabled && open

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

  const goTo = useCallback(
    (delta: 1 | -1): void => {
      const target = targetRef.current
      if (!target) return
      if (delta === 1) setResult(target.next())
      else setResult(target.prev())
    },
    [targetRef]
  )

  const iconButton =
    'relative z-1 grid size-8 cursor-pointer place-items-center rounded-[calc(var(--radius-3xl)-6px)] text-muted-foreground transition-[background-color,scale] hover:bg-foreground/10 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40'

  return (
    <div
      className={`absolute top-2 right-2 z-40 flex origin-top-right items-center gap-0.5 rounded-[var(--radius-3xl)] bg-popover/70 p-1.5 shadow-lg ring-1 ring-foreground/5 focus-within:ring-ring/40 before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:backdrop-blur-2xl before:backdrop-saturate-150 duration-100 animate-in fade-in-0 zoom-in-95 ${active ? '' : 'hidden'}`}
      role="group"
      aria-label="Find in note"
    >
      <IconSearch
        aria-hidden="true"
        className="relative z-1 ml-1.5 size-4 shrink-0 text-muted-foreground"
      />
      <input
        ref={inputRef}
        data-kuskus-find-input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          const target = targetRef.current
          if (target && active)
            setResult(target.search(event.target.value, matchCase))
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            goTo(event.shiftKey ? -1 : 1)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            changeOpen(false)
          }
        }}
        placeholder="Find"
        aria-label="Find in note"
        className="relative z-1 h-8 w-36 min-w-0 rounded-full bg-transparent px-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
      />
      <span
        aria-live="polite"
        className={`relative z-1 min-w-9 px-1 text-center text-xs tabular-nums ${query && result.total === 0 ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        {`${result.total === 0 ? 0 : result.current}/${result.total}`}
      </span>
      <button
        type="button"
        className={iconButton}
        data-active={matchCase}
        aria-label="Match case"
        aria-pressed={matchCase}
        title="Match case"
        onClick={() => {
          const next = !matchCase
          setMatchCase(next)
          const target = targetRef.current
          if (target && active && query) setResult(target.search(query, next))
        }}
      >
        <IconLetterCase aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        className={iconButton}
        aria-label="Previous match"
        title="Previous match (Shift+Enter)"
        disabled={result.total === 0}
        onClick={() => goTo(-1)}
      >
        <IconChevronUp aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        className={iconButton}
        aria-label="Next match"
        title="Next match (Enter)"
        disabled={result.total === 0}
        onClick={() => goTo(1)}
      >
        <IconChevronDown aria-hidden="true" className="size-4" />
      </button>
      <div className="relative z-1 mx-0.5 h-5 w-px bg-border/50" aria-hidden="true" />
      <button
        type="button"
        className={iconButton}
        aria-label="Close find"
        title="Close (Escape)"
        onClick={() => changeOpen(false)}
      >
        <IconX aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
