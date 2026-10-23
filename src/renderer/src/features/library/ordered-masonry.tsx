import { useLayoutEffect, useRef, type ReactNode } from 'react'

const DEFAULT_GAP = 16
const DEFAULT_MIN_COLUMN_WIDTH = 256

function clearItemLayout(item: HTMLElement): void {
  item.style.removeProperty('position')
  item.style.removeProperty('width')
  item.style.removeProperty('left')
  item.style.removeProperty('top')
}

export function OrderedMasonry({
  children,
  gap = DEFAULT_GAP,
  minColumnWidth = DEFAULT_MIN_COLUMN_WIDTH
}: {
  children: ReactNode
  gap?: number
  minColumnWidth?: number
}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    let layoutFrame: number | null = null

    const layout = (): void => {
      layoutFrame = null
      const containerWidth = container.clientWidth
      if (containerWidth <= 0) return

      const items = Array.from(container.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement
      )
      const visibleItems = items.filter(
        (item) => !item.hidden && window.getComputedStyle(item).display !== 'none'
      )
      const visibleItemSet = new Set(visibleItems)

      for (const item of items) {
        if (!visibleItemSet.has(item)) clearItemLayout(item)
      }

      if (visibleItems.length === 0) {
        container.style.height = '0px'
        return
      }

      const columnCount = Math.max(1, Math.floor((containerWidth + gap) / (minColumnWidth + gap)))
      const columnWidth = (containerWidth - gap * (columnCount - 1)) / columnCount
      const columnHeights = Array<number>(columnCount).fill(0)

      for (const item of visibleItems) {
        item.style.position = 'absolute'
        item.style.width = `${columnWidth}px`
      }

      // Positions use layout pixels; bounding rectangles include CSS zoom and transforms.
      const itemHeights = visibleItems.map((item) => item.offsetHeight)
      for (const [index, item] of visibleItems.entries()) {
        const column = index % columnCount
        const top = columnHeights[column]
        item.style.left = `${column * (columnWidth + gap)}px`
        item.style.top = `${top}px`
        columnHeights[column] = top + itemHeights[index] + gap
      }

      container.style.height = `${Math.max(...columnHeights) - gap}px`
    }

    const scheduleLayout = (): void => {
      if (layoutFrame !== null) return
      layoutFrame = window.requestAnimationFrame(layout)
    }

    const resizeObserver = new ResizeObserver(scheduleLayout)
    resizeObserver.observe(container)
    for (const child of container.children) resizeObserver.observe(child)
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) resizeObserver.observe(node)
        }
        for (const node of mutation.removedNodes) {
          if (node instanceof HTMLElement) resizeObserver.unobserve(node)
        }
      }
      scheduleLayout()
    })
    mutationObserver.observe(container, { childList: true })
    layout()

    return () => {
      mutationObserver.disconnect()
      resizeObserver.disconnect()
      if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame)
    }
  }, [gap, minColumnWidth])

  return (
    <div ref={containerRef} className="relative w-full">
      {children}
    </div>
  )
}
