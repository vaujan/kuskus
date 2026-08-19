import { tags } from '@lezer/highlight'
import type { BlockContext, MarkdownExtension } from '@lezer/markdown'

// `BlockContext` doesn't expose its input in the public type, but the field is
// present at runtime and lets us scan for the closing marker before committing.
interface BlockContextWithInput extends BlockContext {
  input: { read(from: number, to: number): string; length: number }
}

// Parse leading YAML frontmatter as a single opaque block instead of letting
// the markdown parser read its lines as headings, setext headings and links.
// The block is tagged `meta` so the highlight style can render it muted.
export const markdownFrontmatter: MarkdownExtension = {
  defineNodes: [{ name: 'Frontmatter', block: true, style: { Frontmatter: tags.meta } }],
  parseBlock: [
    {
      name: 'Frontmatter',
      before: 'HorizontalRule',
      parse(cx, line) {
        if (cx.lineStart !== 0 || line.text !== '---') return false
        const input = (cx as BlockContextWithInput).input
        if (!input) return false
        const start = cx.lineStart
        const rest = input.read(start + line.text.length + 1, input.length)
        if (!/(?:^|\n)---(?:\n|$)/.test(rest)) return false
        let end = -1
        while (cx.nextLine()) {
          if (line.text === '---') {
            end = cx.lineStart + line.text.length
            cx.nextLine()
            break
          }
        }
        if (end === -1) return false
        cx.addElement(cx.elt('Frontmatter', start, end))
        return true
      }
    }
  ]
}
