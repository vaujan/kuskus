export function getPublishedMarkdownChange(docChanged: boolean, markdown: string): string | null {
  return docChanged ? markdown : null
}
