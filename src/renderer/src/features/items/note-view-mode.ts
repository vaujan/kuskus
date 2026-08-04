export type NoteMode = 'read' | 'live' | 'markdown' | 'split'
export type SinglePaneNoteMode = Exclude<NoteMode, 'split'>

export function toggleReadLive(mode: NoteMode): SinglePaneNoteMode {
  return mode === 'live' ? 'read' : 'live'
}

export function toggleSourceMode(mode: NoteMode): SinglePaneNoteMode {
  return mode === 'markdown' ? 'live' : 'markdown'
}

export function getSplitToggleMode(
  mode: NoteMode,
  previousSingleMode: SinglePaneNoteMode
): NoteMode {
  return mode === 'split' ? previousSingleMode : 'split'
}
