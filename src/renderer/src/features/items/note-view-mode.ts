export type NoteMode = 'read' | 'markdown' | 'split'
export type SinglePaneNoteMode = Exclude<NoteMode, 'split'>

export function toggleReadMarkdown(mode: NoteMode): SinglePaneNoteMode {
  return mode === 'read' ? 'markdown' : 'read'
}

export function getSplitToggleMode(
  mode: NoteMode,
  previousSingleMode: SinglePaneNoteMode
): NoteMode {
  return mode === 'split' ? previousSingleMode : 'split'
}
