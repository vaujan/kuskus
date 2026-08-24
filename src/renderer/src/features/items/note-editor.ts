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
 * The single Vim contract both engines drive into. Each adapter owns how its own
 * engine (CodeMirror vim or vim-prosemirror) produces these callbacks.
 */
export interface NoteEditorVimContract {
  onModeChange: (mode: NoteVimMode | null) => void
  onWrite: () => void
  onQuit: () => void
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

export type { NoteVimMode }
