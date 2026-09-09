import type { RefObject } from 'react'

import type { NoteVimMode } from '@/features/items/note-vim-mode'

/**
 * The mode-agnostic editing surface both note engines present. Consumers address one
 * active adapter selected by note mode and never need to know which engine backs it.
 * Cursor offsets are positions into the Markdown source string, in both directions.
 */
export interface NoteEditorHandle {
  focus: () => void
  getCursorOffset: () => number | null
  setCursorOffset: (offset: number | null) => void
}

/**
 * The single Vim contract the editor surface drives. The CodeMirror live and
 * source editors share one vim implementation (@replit/codemirror-vim), so
 * mode changes, :w/:q, and the command line behave identically across modes.
 * `commandLineHost` is the status-bar element where the engine mounts its '/'
 * and ':' command-line UI, so the prompt always renders on the vim status line
 * instead of riding inside the scrolled document.
 */
export interface NoteEditorVimContract {
  onModeChange: (mode: NoteVimMode | null) => void
  onWrite: () => void
  onQuit: () => void
  commandLineHost: RefObject<HTMLElement | null>
}

/**
 * Source-specific surface the source editor adds for Split mode and undo/redo,
 * which are inherently tied to the CodeMirror scroller and history. This stays
 * off the shared seam because the rich engine has no equivalent.
 */
export interface SourceNoteHandle extends NoteEditorHandle {
  getScroller: () => HTMLElement | null
  requestMeasure: () => void
  redo: () => boolean
  undo: () => boolean
}

export interface NoteEditorProps {
  value: string
  active: boolean
  vimEnabled: boolean
  vim: NoteEditorVimContract
  onChange: (value: string) => void
  className?: string
}

export interface NoteFindResult {
  current: number
  total: number
}

/**
 * Find backend for one note surface. The CM6 live editor implements it
 * with match decorations; static previews wrap text nodes directly.
 */
export interface NoteFindTarget {
  focus(): void
  search(query: string, matchCase: boolean): NoteFindResult
  next(): NoteFindResult
  prev(): NoteFindResult
  replaceCurrent?(replacement: string): NoteFindResult
  replaceAll?(replacement: string): NoteFindResult
}

export interface NoteFindTargetRef {
  current: NoteFindTarget | null
}

export type { NoteVimMode }
