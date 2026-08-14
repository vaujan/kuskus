export function findRichMarkdownSlashQuery(text: string): string | null {
  return text.match(/(?:^|\s)\/([^\s/]*)$/)?.[1] ?? null
}
