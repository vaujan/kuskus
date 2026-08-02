export const KUSKUS_ITEM_DRAG_TYPE = 'application/x-kuskus-item-ids'

const DRAG_PREVIEW_MAX_WIDTH = 304
const DRAG_PREVIEW_MAX_HEIGHT = 360
const DRAG_PREVIEW_INSET = 24

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function setKuskusItemDragPreview({
  dataTransfer,
  source,
  clientX,
  clientY,
  itemCount
}: {
  dataTransfer: DataTransfer
  source: HTMLElement
  clientX: number
  clientY: number
  itemCount: number
}): void {
  const sourceBounds = source.getBoundingClientRect()
  if (sourceBounds.width <= 0 || sourceBounds.height <= 0) return

  const previewWidth = Math.min(sourceBounds.width, DRAG_PREVIEW_MAX_WIDTH)
  const widthScale = previewWidth / sourceBounds.width
  const previewHeight = Math.min(sourceBounds.height * widthScale, DRAG_PREVIEW_MAX_HEIGHT)
  const preview = document.createElement('div')
  const content = document.createElement('div')
  const clone = source.cloneNode(true) as HTMLElement
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  preview.setAttribute('aria-hidden', 'true')
  Object.assign(preview.style, {
    position: 'fixed',
    top: '-10000px',
    left: '-10000px',
    width: `${previewWidth + DRAG_PREVIEW_INSET * 2}px`,
    height: `${previewHeight + DRAG_PREVIEW_INSET * 2}px`,
    pointerEvents: 'none',
    zIndex: '2147483647'
  })

  for (const offset of itemCount > 1 ? [8, 4] : []) {
    const backing = document.createElement('div')
    Object.assign(backing.style, {
      position: 'absolute',
      inset: `${DRAG_PREVIEW_INSET + offset}px ${DRAG_PREVIEW_INSET - offset}px ${DRAG_PREVIEW_INSET - offset}px ${DRAG_PREVIEW_INSET + offset}px`,
      borderRadius: 'var(--radius-sm)',
      background: 'var(--card)',
      boxShadow:
        '0 0 0 1px color-mix(in oklch, var(--foreground) 8%, transparent), 0 10px 24px -14px color-mix(in oklch, var(--foreground) 28%, transparent)'
    })
    preview.append(backing)
  }

  Object.assign(content.style, {
    position: 'absolute',
    top: `${DRAG_PREVIEW_INSET}px`,
    left: `${DRAG_PREVIEW_INSET}px`,
    width: `${previewWidth}px`,
    height: `${previewHeight}px`,
    overflow: 'hidden',
    borderRadius: 'var(--radius-sm)',
    opacity: '0.96',
    transform: reduceMotion ? 'none' : 'rotate(2deg) scale(0.96)',
    transformOrigin: 'top left',
    background: 'var(--card)',
    boxShadow:
      '0 0 0 1px color-mix(in oklch, var(--foreground) 10%, transparent), 0 18px 46px -16px color-mix(in oklch, var(--foreground) 48%, transparent), 0 8px 18px -10px color-mix(in oklch, var(--foreground) 32%, transparent)'
  })
  const cloneSurface =
    source instanceof HTMLTableRowElement
      ? (() => {
          const table = document.createElement('table')
          const body = document.createElement('tbody')
          table.style.tableLayout = 'fixed'
          table.style.borderCollapse = 'collapse'
          body.append(clone)
          table.append(body)
          return table
        })()
      : clone
  Object.assign(cloneSurface.style, {
    width: `${sourceBounds.width}px`,
    height: `${sourceBounds.height}px`,
    transform: `scale(${widthScale})`,
    transformOrigin: 'top left',
    pointerEvents: 'none'
  })
  clone.removeAttribute('draggable')
  clone.querySelectorAll<HTMLElement>('[data-drag-preview-hidden]').forEach((element) => {
    element.style.display = 'none'
  })
  content.append(cloneSurface)
  preview.append(content)

  if (itemCount > 1) {
    const count = document.createElement('span')
    count.textContent = String(itemCount)
    Object.assign(count.style, {
      position: 'absolute',
      top: '2px',
      right: '2px',
      display: 'flex',
      minWidth: '24px',
      height: '24px',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 7px',
      borderRadius: '999px',
      background: 'var(--primary)',
      color: 'var(--primary-foreground)',
      fontSize: '12px',
      fontWeight: '600',
      fontVariantNumeric: 'tabular-nums',
      boxShadow: '0 4px 12px color-mix(in oklch, var(--foreground) 24%, transparent)'
    })
    preview.append(count)
  }

  document.body.append(preview)
  const offsetX = clamp(
    (clientX - sourceBounds.left) * widthScale + DRAG_PREVIEW_INSET,
    DRAG_PREVIEW_INSET,
    previewWidth + DRAG_PREVIEW_INSET
  )
  const offsetY = clamp(
    (clientY - sourceBounds.top) * widthScale + DRAG_PREVIEW_INSET,
    DRAG_PREVIEW_INSET,
    previewHeight + DRAG_PREVIEW_INSET
  )
  dataTransfer.setDragImage(preview, offsetX, offsetY)
  window.requestAnimationFrame(() => preview.remove())
}

export function hasKuskusItemDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(KUSKUS_ITEM_DRAG_TYPE)
}

export function readKuskusItemDrag(dataTransfer: DataTransfer): string[] {
  if (!hasKuskusItemDrag(dataTransfer)) return []
  try {
    const value: unknown = JSON.parse(dataTransfer.getData(KUSKUS_ITEM_DRAG_TYPE))
    return Array.isArray(value) && value.every((itemId) => typeof itemId === 'string')
      ? [...new Set(value)]
      : []
  } catch {
    return []
  }
}
