import type { ResolvedImage } from '@/features/items/note-image-resolution'

/**
 * Imperative DOM builder for the shared image visuals, usable from
 * non-React contexts (CodeMirror `WidgetType.toDOM()` and table-cell
 * previews). Mirrors the React `NoteImage` component in
 * `note-image.tsx` — same classes, same structure, same zoom lightbox.
 *
 * Kept in a `.ts` module (not `.tsx`) so the headless test harness —
 * which transpiles `.ts` but not `.tsx` — can load the live-preview
 * decorations without pulling in JSX.
 */

/** Build the shared image DOM. Returns the root element plus an
 *  optional pointerdown handler the widget wires for caret placement
 *  (stops CM6 from treating the press as editor input while letting
 *  the click handler run the zoom). */
export function buildNoteImageDom(
  resolved: ResolvedImage,
  options: { interactive?: boolean } = {}
): { dom: HTMLElement; onPointerDown?: (event: MouseEvent) => void } {
  const interactive = options.interactive ?? false

  if (resolved.kind !== 'image') {
    const chip = document.createElement('span')
    chip.className = 'kuskus-rich-image-state'
    chip.textContent =
      resolved.kind === 'loading'
        ? 'Loading image…'
        : resolved.kind === 'missing'
          ? `Image missing: ${resolved.label}`
          : resolved.label || 'Invalid image'
    return { dom: chip }
  }

  const { src, alt, caption, remote } = resolved
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'kuskus-markdown-image-button'
  button.setAttribute('data-not-typeset', '')
  button.setAttribute('aria-label', `Zoom image${alt ? `: ${alt}` : ''}`)
  button.disabled = !interactive
  if (interactive) button.style.cursor = 'zoom-in'

  const img = document.createElement('img')
  img.src = src
  img.alt = ''
  img.className = 'kuskus-markdown-image'
  if (resolved.width !== undefined) img.width = resolved.width
  if (resolved.height !== undefined) img.height = resolved.height
  if (remote) {
    img.loading = 'lazy'
    img.referrerPolicy = 'no-referrer'
  }
  button.appendChild(img)

  if (caption) {
    const captionEl = document.createElement('span')
    captionEl.className = 'kuskus-markdown-image-caption'
    captionEl.textContent = caption
    button.appendChild(captionEl)
  }

  if (interactive) {
    // Same-button zoom like the read-mode CSS: `data-zoomed="true"`
    // turns THIS button into the fixed full-screen overlay. Escape or
    // clicking again closes it. Mirrors the React `NoteImage` and the
    // original read-mode renderer.
    let zoomed = false
    const open = (): void => {
      zoomed = true
      button.setAttribute('data-zoomed', 'true')
      button.setAttribute('aria-label', 'Close image')
      button.style.cursor = 'zoom-out'
    }
    const close = (): void => {
      if (!zoomed) return
      zoomed = false
      button.removeAttribute('data-zoomed')
      button.setAttribute('aria-label', `Zoom image${alt ? `: ${alt}` : ''}`)
      button.style.cursor = 'zoom-in'
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      if (!zoomed) open()
      else close()
    })
    window.addEventListener('keydown', onKey)
    button.addEventListener(
      'remove',
      () => {
        close()
        window.removeEventListener('keydown', onKey)
      },
      { once: true }
    )
  }

  return {
    dom: button,
    onPointerDown: (event: MouseEvent) => {
      // Let the click handler (zoom) run; just stop CM6 from placing
      // a caret in the widget.
      event.preventDefault()
      event.stopPropagation()
    }
  }
}
