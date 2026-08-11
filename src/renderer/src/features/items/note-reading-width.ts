export type NoteReadingWidth = 'comfortable' | 'wide'

export const NOTE_READING_WIDTH_STORAGE_KEY = 'kuskus-note-reading-width'

export function parseNoteReadingWidth(value: string | null): NoteReadingWidth {
  return value === 'wide' ? 'wide' : 'comfortable'
}

export function toggleNoteReadingWidth(width: NoteReadingWidth): NoteReadingWidth {
  return width === 'comfortable' ? 'wide' : 'comfortable'
}
