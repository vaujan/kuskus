export const NOTE_INLINE_TITLE_STORAGE_KEY = 'kuskus-note-inline-title'

export function parseNoteInlineTitle(value: string | null): boolean {
  return value !== 'false'
}
