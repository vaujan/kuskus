import {
  javascriptLanguage,
  jsxLanguage,
  tsxLanguage,
  typescriptLanguage
} from '@codemirror/lang-javascript'
import { LanguageDescription, type Language } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { classHighlighter, highlightTree } from '@lezer/highlight'

const CODE_LANGUAGES: Record<string, Language> = {
  js: javascriptLanguage,
  javascript: javascriptLanguage,
  jsx: jsxLanguage,
  ts: typescriptLanguage,
  typescript: typescriptLanguage,
  tsx: tsxLanguage
}

export function markdownCodeLanguage(info: string): Language | LanguageDescription | null {
  const direct = CODE_LANGUAGES[info.trim().toLowerCase()]
  if (direct) return direct
  // Fall back to the shared language registry (python, rust, sql, …), which
  // resolves aliases and lazy-loads a grammar the first time a fence needs it.
  return LanguageDescription.matchLanguageName(languages, info.trim(), true)
}

export function isMermaidLanguage(info: string): boolean {
  return info.trim().toLowerCase() === 'mermaid'
}

export function codeLanguageLabel(info: string): string {
  const language = info.trim().toLowerCase()
  if (!language) return 'Plain text'
  return (
    {
      js: 'JavaScript',
      jsx: 'JSX',
      math: 'Math',
      mermaid: 'Mermaid',
      ts: 'TypeScript',
      tsx: 'TSX',
      yaml: 'YAML'
    }[language] ?? language
  )
}

export interface HighlightedCodeRange {
  from: number
  to: number
  classes: string
}

export function highlightedCodeRanges(code: string, info: string): HighlightedCodeRange[] {
  const language = markdownCodeLanguage(info)
  if (!language) return []
  // Registry languages only expose their parser once loaded; the code block
  // re-renders when ensureCodeLanguageLoaded reports the grammar arrived.
  const resolved = language instanceof LanguageDescription ? language.support?.language : language
  if (!resolved) return []
  const ranges: HighlightedCodeRange[] = []
  highlightTree(resolved.parser.parse(code), classHighlighter, (from, to, classes) => {
    ranges.push({ from, to, classes })
  })
  return ranges
}

/** Starts loading a registry grammar for the fence, if one is needed. */
export function ensureCodeLanguageLoaded(info: string): Promise<unknown> | null {
  const language = markdownCodeLanguage(info)
  if (!(language instanceof LanguageDescription) || language.support) return null
  return language.load().catch(() => null)
}

export async function copyMarkdownCode(code: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(code)
    return true
  } catch {
    return false
  }
}
