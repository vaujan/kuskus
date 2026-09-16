import { useEffect, useState } from 'react'

import type { ResolvedImage } from '@/features/items/note-image-resolution'

/**
 * Shared image renderer.
 *
 * One implementation of the image visuals — the `<img>` plus optional
 * caption, the click-to-zoom lightbox overlay, and the
 * loading/missing/invalid state boxes — used by Read mode (React),
 * the CM6 live widgets (imperative DOM twin below), and table-cell
 * previews. The read and live surfaces therefore render images
 * identically, styled from the same tokens.
 */

interface NoteImageProps {
  resolved: ResolvedImage
  /** Enable the click-to-zoom lightbox. Off for card/compact. */
  interactive?: boolean
  /** Extra class on the root button/element. */
  className?: string
}

/** The lightbox overlay reuses the same button via `data-zoomed` — the
 *  read-mode CSS (`markdown.css`) turns the button into a fixed,
 *  screen-sized overlay when `data-zoomed="true"`. This is the exact
 *  pattern the old read-mode renderer used, so the live widgets (via
 *  `buildNoteImageDom`) and React share one zoom implementation. */
export function NoteImage({
  resolved,
  interactive = false,
  className
}: NoteImageProps): React.JSX.Element {
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    if (!zoomed) return
    const close = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setZoomed(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [zoomed])

  if (resolved.kind !== 'image') {
    const label =
      resolved.kind === 'loading'
        ? 'Loading image…'
        : resolved.kind === 'missing'
          ? `Image missing: ${resolved.label}`
          : resolved.label || 'Invalid image'
    return (
      <span className="not-typeset kuskus-rich-image-state" data-not-typeset>
        {label}
      </span>
    )
  }

  const { src, alt, caption, remote } = resolved
  return (
    <button
      type="button"
      className={
        className
          ? `not-typeset kuskus-markdown-image-button ${className}`
          : 'not-typeset kuskus-markdown-image-button'
      }
      data-not-typeset
      data-zoomed={zoomed}
      disabled={!interactive}
      aria-label={zoomed ? 'Close image' : `Zoom image${alt ? `: ${alt}` : ''}`}
      aria-pressed={interactive ? zoomed : undefined}
      onClick={(event) => {
        event.stopPropagation()
        if (interactive) setZoomed((current) => !current)
      }}
    >
      <img
        src={src}
        alt=""
        width={resolved.width}
        height={resolved.height}
        loading={remote ? 'lazy' : undefined}
        referrerPolicy={remote ? 'no-referrer' : undefined}
        className="kuskus-markdown-image"
      />
      {caption ? <span className="kuskus-markdown-image-caption">{caption}</span> : null}
    </button>
  )
}
