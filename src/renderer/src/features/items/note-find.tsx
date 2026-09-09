import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconLetterCase,
  IconReplace,
  IconSearch,
  IconX
} from '@tabler/icons-react'

import type { NoteFindTargetRef } from '@/features/items/note-editor'
import { cn } from '@/lib/utils'

const EMPTY_RESULT = { current: 0, total: 0 }

export function NoteFind({
  enabled,
  replaceEnabled,
  target: targetRef,
  onOpenChange
}: {
  enabled: boolean
  replaceEnabled: boolean
  target: NoteFindTargetRef
  onOpenChange?: (open: boolean) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [result, setResult] = useState(EMPTY_RESULT)
  const inputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  const focusFind = useCallback((select = false): void => {
    inputRef.current?.focus()
    if (select) inputRef.current?.select()
  }, [])

  const changeOpen = useCallback(
    (next: boolean, showReplace = false): void => {
      setOpen(next)
      if (next) {
        if (showReplace && replaceEnabled) setReplaceOpen(true)
        focusFind(true)
      } else {
        targetRef.current?.search('', false)
        setResult(EMPTY_RESULT)
        setReplaceOpen(false)
        targetRef.current?.focus()
      }
      onOpenChange?.(next)
    },
    [focusFind, onOpenChange, replaceEnabled, targetRef]
  )

  const active = enabled && open

  useEffect(() => {
    if (!enabled) return
    const handleFindShortcut = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey) return
      const key = event.key.toLocaleLowerCase()
      const findShortcut = key === 'f' && !event.altKey
      const replaceShortcut = replaceEnabled && (key === 'h' || (key === 'f' && event.altKey))
      if (!findShortcut && !replaceShortcut) return
      const eventTarget = event.target as Node | null
      if (
        eventTarget instanceof Element &&
        eventTarget.closest('input:not([data-kuskus-find-input]), textarea, select')
      ) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      changeOpen(true, replaceShortcut)
    }
    window.addEventListener('keydown', handleFindShortcut, true)
    return () => window.removeEventListener('keydown', handleFindShortcut, true)
  }, [changeOpen, enabled, replaceEnabled])

  useEffect(() => {
    if (!active) return
    focusFind(true)
  }, [active, focusFind])

  useEffect(
    () => () => {
      targetRef.current?.search('', false)
    },
    [targetRef]
  )

  const runSearch = useCallback(
    (nextQuery: string, nextMatchCase = matchCase): void => {
      const target = targetRef.current
      setResult(target && active ? target.search(nextQuery, nextMatchCase) : EMPTY_RESULT)
    },
    [active, matchCase, targetRef]
  )

  const goTo = useCallback(
    (delta: 1 | -1): void => {
      const target = targetRef.current
      if (!target) return
      setResult(delta === 1 ? target.next() : target.prev())
      focusFind()
    },
    [focusFind, targetRef]
  )

  const replaceCurrent = useCallback((): void => {
    const target = targetRef.current
    if (!target?.replaceCurrent || !query) return
    setResult(target.replaceCurrent(replacement))
    replaceInputRef.current?.focus()
  }, [query, replacement, targetRef])

  const replaceAll = useCallback((): void => {
    const target = targetRef.current
    if (!target?.replaceAll || !query) return
    setResult(target.replaceAll(replacement))
    replaceInputRef.current?.focus()
  }, [query, replacement, targetRef])

  const iconButton =
    'relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-[background-color,color,scale] duration-100 hover:bg-foreground/8 hover:text-foreground active:scale-[0.96] disabled:pointer-events-none disabled:opacity-35'

  return (
    <section
      className={cn(
        'absolute top-3 right-3 z-40 w-[min(34rem,calc(100%-1.5rem))] origin-top-right rounded-xl bg-popover/92 p-1 shadow-[0_12px_35px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.08)] ring-1 ring-foreground/8 backdrop-blur-xl transition-[opacity,scale] duration-100 motion-reduce:transition-none',
        active ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
      )}
      aria-label="Find in note"
      aria-hidden={!active}
      hidden={!active}
    >
      <div className="flex min-w-0 items-center">
        {replaceEnabled ? (
          <button
            type="button"
            className={iconButton}
            aria-label={replaceOpen ? 'Hide replace' : 'Show replace'}
            aria-expanded={replaceOpen}
            title={replaceOpen ? 'Hide replace' : 'Show replace'}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setReplaceOpen((value) => !value)}
          >
            <IconChevronRight
              aria-hidden="true"
              className={cn('size-4 transition-transform duration-100', replaceOpen && 'rotate-90')}
            />
          </button>
        ) : (
          <span className="grid size-10 shrink-0 place-items-center text-muted-foreground">
            <IconSearch aria-hidden="true" className="size-4" />
          </span>
        )}
        <input
          ref={inputRef}
          data-kuskus-find-input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            runSearch(event.target.value)
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
          placeholder="Find in note"
          aria-label="Find in note"
          className="h-10 min-w-24 flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/65 [&::-webkit-search-cancel-button]:hidden"
        />
        <output
          aria-live="polite"
          className={cn(
            'min-w-14 px-2 text-center text-xs tabular-nums',
            query && result.total === 0 ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {query ? `${result.total === 0 ? 0 : result.current} of ${result.total}` : '0 of 0'}
        </output>
        <button
          type="button"
          className={cn(iconButton, matchCase && 'bg-primary/12 text-primary')}
          aria-label="Match case"
          aria-pressed={matchCase}
          title="Match case"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const next = !matchCase
            setMatchCase(next)
            runSearch(query, next)
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
          onMouseDown={(event) => event.preventDefault()}
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
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => goTo(1)}
        >
          <IconChevronDown aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          className={iconButton}
          aria-label="Close find"
          title="Close (Escape)"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => changeOpen(false)}
        >
          <IconX aria-hidden="true" className="size-4" />
        </button>
      </div>
      {replaceEnabled && replaceOpen ? (
        <div className="flex min-w-0 items-center border-t border-foreground/6">
          <span className="grid size-10 shrink-0 place-items-center text-muted-foreground">
            <IconReplace aria-hidden="true" className="size-4" />
          </span>
          <input
            ref={replaceInputRef}
            data-kuskus-find-input
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                replaceCurrent()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                changeOpen(false)
              }
            }}
            placeholder="Replace with"
            aria-label="Replace with"
            className="h-10 min-w-24 flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/65"
          />
          <button
            type="button"
            className="h-10 shrink-0 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-[background-color,color,scale] duration-100 hover:bg-foreground/8 hover:text-foreground active:scale-[0.96] disabled:pointer-events-none disabled:opacity-35"
            disabled={result.total === 0}
            onClick={replaceCurrent}
          >
            Replace
          </button>
          <button
            type="button"
            className="mr-1 h-10 shrink-0 rounded-lg bg-primary/12 px-3 text-xs font-medium text-primary transition-[background-color,scale] duration-100 hover:bg-primary/18 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-35"
            disabled={result.total === 0}
            onClick={replaceAll}
          >
            Replace all
          </button>
        </div>
      ) : null}
    </section>
  )
}
