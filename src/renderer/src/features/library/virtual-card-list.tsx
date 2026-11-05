import {
  memo,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'

import { layoutCards, cardsInViewport } from './virtual-card-layout'

const EMPTY_HEIGHTS = new Map<string, number>()

export interface VirtualCardListHandle {
  reveal: (id: string, focus?: boolean) => void
}

interface CardItem {
  id: string
}

// Extend the existing ordered layout rather than changing its round-robin reading order.
// Only measurements from mounted cards touch the DOM; layout for the rest uses cached heights.
function VirtualCardListImpl<T extends CardItem>({
  ref,
  items,
  renderItem,
  leading,
  leadingVisible = false,
  layout: layoutMode = 'masonry',
  gap = 16,
  estimatedHeight = 340
}: {
  ref?: React.Ref<VirtualCardListHandle>
  items: readonly T[]
  renderItem: (item: T) => ReactNode
  leading?: ReactNode
  leadingVisible?: boolean
  layout?: 'masonry' | 'grid' | 'list'
  gap?: number
  estimatedHeight?: number
}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [measurements, setMeasurements] = useState({ key: '', heights: EMPTY_HEIGHTS })
  const [viewport, setViewport] = useState({ width: 800, top: 0, height: 900 })
  const [revealId, setRevealId] = useState<{ id: string; focus: boolean } | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const columns =
    layoutMode === 'list' ? 1 : Math.max(1, Math.floor((viewport.width + gap) / (256 + gap)))
  const columnWidth = (viewport.width - gap * (columns - 1)) / columns
  // Width changes invalidate wrapped-text heights, but scrolling never clears measurements.
  const measurementKey = `${columnWidth}:${layoutMode}`
  const heights = measurements.key === measurementKey ? measurements.heights : EMPTY_HEIGHTS
  const layout = useMemo(
    () =>
      layoutCards(
        items,
        columns,
        heights,
        leadingVisible,
        layoutMode === 'grid',
        gap,
        estimatedHeight
      ),
    [items, columns, heights, leadingVisible, layoutMode, gap, estimatedHeight]
  )
  const layoutRef = useRef(layout)
  const itemIds = useMemo(() => new Set(items.map((item) => item.id)), [items])
  const measurementContext = useRef({ key: measurementKey, ids: itemIds })
  useLayoutEffect(() => {
    layoutRef.current = layout
    measurementContext.current = { key: measurementKey, ids: itemIds }
  }, [itemIds, layout, measurementKey])
  const rendered = cardsInViewport(layout.cards, viewport.top, viewport.height)
  for (const id of [focusedId, draggedId, revealId?.id ?? null]) {
    if (!id) continue
    const index = items.findIndex((item) => item.id === id)
    if (index < 0) continue
    // Keep focus and its neighbours mounted so native Tab can cross window boundaries.
    for (let next = Math.max(0, index - 1); next <= Math.min(items.length - 1, index + 1); next++) {
      rendered.add(next)
    }
  }

  useImperativeHandle(
    ref,
    () => ({ reveal: (id: string, focus = false) => setRevealId({ id, focus }) }),
    []
  )
  useLayoutEffect(() => {
    if (!revealId) return
    const element = containerRef.current?.querySelector<HTMLElement>(
      `[data-card-key="${CSS.escape(revealId.id)}"]`
    )
    if (revealId.focus)
      element
        ?.querySelector<HTMLElement>('[data-slot="item-card-primary-action"]')
        ?.focus({ preventScroll: true })
    element?.scrollIntoView({ block: 'nearest' })
  }, [revealId])

  useLayoutEffect(() => {
    const container = containerRef.current
    const scroller = container?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
    if (!container || !scroller) return
    let frame = 0
    const update = (): void => {
      frame = 0
      const zoom = container.getBoundingClientRect().width / container.clientWidth || 1
      const top =
        (scroller.getBoundingClientRect().top - container.getBoundingClientRect().top) / zoom
      const next = { width: container.clientWidth, top, height: scroller.clientHeight }
      const positions = layoutRef.current.cards
      const nextRange = cardsInViewport(positions, next.top, next.height)
      setViewport((current) =>
        current.width === next.width &&
        current.height === next.height &&
        (() => {
          const previousRange = cardsInViewport(positions, current.top, current.height)
          return (
            previousRange.size === nextRange.size &&
            [...nextRange].every((index) => previousRange.has(index))
          )
        })()
          ? current
          : next
      )
    }
    const schedule = (): void => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(container)
    observer.observe(scroller)
    scroller.addEventListener('scroll', schedule, { passive: true })
    update()
    return () => {
      observer.disconnect()
      scroller.removeEventListener('scroll', schedule)
      cancelAnimationFrame(frame)
    }
  }, [])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      const updated = entries.map((entry) => {
        const element = entry.target as HTMLElement
        return { id: element.dataset.cardKey, height: element.offsetHeight }
      })
      const { key, ids } = measurementContext.current
      setMeasurements((current) => {
        const previous = current.key === key ? current.heights : EMPTY_HEIGHTS
        if (!updated.some(({ id, height }) => id && height > 0 && previous.get(id) !== height))
          return current
        const next = new Map([...previous].filter(([id]) => id === '$leading' || ids.has(id)))
        for (const { id, height } of updated) {
          if (id && height > 0) next.set(id, height)
        }
        return { key, heights: next }
      })
    })
    for (const child of container.children) observer.observe(child)
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes)
          if (node instanceof HTMLElement) observer.unobserve(node)
        for (const node of record.addedNodes)
          if (node instanceof HTMLElement) observer.observe(node)
      }
    })
    mutations.observe(container, { childList: true })
    return () => {
      observer.disconnect()
      mutations.disconnect()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      data-virtual-list={layoutMode}
      data-item-count={items.length}
      style={{ height: layout.height }}
      onFocusCapture={(event) => {
        setFocusedId(event.target.closest<HTMLElement>('[data-card-key]')?.dataset.cardKey ?? null)
      }}
      onDragStartCapture={(event) => {
        setDraggedId(
          (event.target as HTMLElement).closest<HTMLElement>('[data-card-key]')?.dataset.cardKey ??
            null
        )
      }}
      onDragEndCapture={() => setDraggedId(null)}
    >
      <div
        data-card-key="$leading"
        style={{
          position: 'absolute',
          width: columnWidth,
          display: leadingVisible ? undefined : 'none'
        }}
      >
        {leading}
      </div>
      {[...rendered]
        .sort((a, b) => a - b)
        .map((index) => {
          const card = layout.cards[index]
          return (
            <div
              key={items[index].id}
              data-card-key={items[index].id}
              data-card-index={index}
              style={{
                position: 'absolute',
                width: columnWidth,
                left: card.column * (columnWidth + gap),
                top: card.top
              }}
            >
              {renderItem(items[index])}
            </div>
          )
        })}
    </div>
  )
}

export const VirtualCardList = memo(VirtualCardListImpl) as typeof VirtualCardListImpl
