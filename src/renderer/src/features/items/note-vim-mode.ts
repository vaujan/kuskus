export type NoteVimMode = 'normal' | 'insert' | 'replace' | 'visual' | 'visual-line'

export const NOTE_VIM_MODE_STORAGE_KEY = 'kuskus-note-vim'

export function parseNoteVimEnabled(value: string | null): boolean {
  return value === 'true'
}

export function parseNoteVimMode(mode: string, subMode?: string): NoteVimMode | null {
  if (mode === 'visual' && subMode === 'linewise') return 'visual-line'
  if (mode === 'normal' || mode === 'insert' || mode === 'replace' || mode === 'visual') {
    return mode
  }
  return null
}
