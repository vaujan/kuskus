export interface NoteTextMetrics {
  words: number
  characters: number
}

export function getNoteTextMetrics(markdown: string): NoteTextMetrics {
  return {
    words: markdown.match(/\S+/gu)?.length ?? 0,
    characters: markdown.length
  }
}
