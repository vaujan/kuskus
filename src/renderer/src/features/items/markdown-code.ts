import {
  javascriptLanguage,
  jsxLanguage,
  tsxLanguage,
  typescriptLanguage
} from '@codemirror/lang-javascript'
import { type Language } from '@codemirror/language'
import { classHighlighter, highlightTree } from '@lezer/highlight'

const CODE_LANGUAGES: Record<string, Language> = {
  js: javascriptLanguage,
  javascript: javascriptLanguage,
  jsx: jsxLanguage,
  ts: typescriptLanguage,
  typescript: typescriptLanguage,
  tsx: tsxLanguage
}

export function markdownCodeLanguage(info: string): Language | null {
  return CODE_LANGUAGES[info.trim().toLowerCase()] ?? null
}

export function codeLanguageLabel(info: string): string {
  const language = info.trim().toLowerCase()
  if (!language) return 'Plain text'
  return { js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX' }[language] ?? language
}

export interface HighlightedCodeRange {
  from: number
  to: number
  classes: string
}

export function highlightedCodeRanges(code: string, info: string): HighlightedCodeRange[] {
  const language = markdownCodeLanguage(info)
  if (!language) return []
  const ranges: HighlightedCodeRange[] = []
  highlightTree(language.parser.parse(code), classHighlighter, (from, to, classes) => {
    ranges.push({ from, to, classes })
  })
  return ranges
}

export function renderHighlightedCode(element: HTMLElement, code: string, info: string): void {
  element.replaceChildren()
  let position = 0
  for (const range of highlightedCodeRanges(code, info)) {
    element.append(code.slice(position, range.from))
    const node = document.createElement('span')
    node.className = range.classes
    node.textContent = code.slice(range.from, range.to)
    element.append(node)
    position = range.to
  }
  element.append(code.slice(position))
}

export async function copyMarkdownCode(code: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(code)
    return true
  } catch {
    return false
  }
}
