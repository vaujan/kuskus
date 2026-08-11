import {
  javascriptLanguage,
  jsxLanguage,
  tsxLanguage,
  typescriptLanguage
} from '@codemirror/lang-javascript'
import { type Language } from '@codemirror/language'
import { classHighlighter, highlightCode } from '@lezer/highlight'

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

export function renderHighlightedCode(element: HTMLElement, code: string, info: string): void {
  element.replaceChildren()
  const language = markdownCodeLanguage(info)
  if (!language) {
    element.textContent = code
    return
  }
  highlightCode(
    code,
    language.parser.parse(code),
    classHighlighter,
    (text, classes) => {
      const node = document.createElement('span')
      if (classes) node.className = classes
      node.textContent = text
      element.append(node)
    },
    () => element.append(document.createElement('br'))
  )
}

export async function copyMarkdownCode(code: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(code)
    return true
  } catch {
    return false
  }
}
