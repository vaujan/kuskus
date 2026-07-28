const RAW_HTML_PATTERN =
  /<!--|<\?|<\/?(?!(?:https?:\/\/|mailto:))[A-Za-z][A-Za-z0-9-]*(?:\s[^<>\r\n]*?)?\s*\/?>/i
const MILKDOWN_EMPTY_LINE_PATTERN = /^[ \t]*<br(?: ?\/?)?>[ \t]*\r?$/gm

export function normalizeRichEditorMarkdown(markdown: string): string {
  return markdown.replace(MILKDOWN_EMPTY_LINE_PATTERN, '')
}

export function getUnsupportedMarkdownReason(markdown: string): string | null {
  if (RAW_HTML_PATTERN.test(normalizeRichEditorMarkdown(markdown))) {
    return 'This note contains raw HTML, which Kuskus does not load into the rich editor for safety.'
  }
  return null
}
