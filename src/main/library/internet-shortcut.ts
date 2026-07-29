import { validateWebUrl } from './items/url-item'

const SECTION = /^\s*\[InternetShortcut\]\s*$/i
const URL_LINE = /^\s*URL\s*=\s*(.+?)\s*$/i

export function createInternetShortcut(url: string, newline = '\r\n'): string {
  const validated = validateWebUrl(url)
  return `[InternetShortcut]${newline}URL=${validated.toString()}${newline}`
}

export function parseInternetShortcut(source: string): string {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/)
  const sectionIndex = lines.findIndex((line) => SECTION.test(line))
  if (sectionIndex < 0) throw new Error('The Internet Shortcut section is missing.')
  for (const line of lines.slice(sectionIndex + 1)) {
    if (/^\s*\[/.test(line)) break
    const match = line.match(URL_LINE)
    if (match) return validateWebUrl(match[1]).toString()
  }
  throw new Error('The Internet Shortcut URL is missing or invalid.')
}
