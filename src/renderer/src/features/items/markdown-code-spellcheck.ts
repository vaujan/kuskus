import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate
} from '@codemirror/view'

// Chromium resolves spellchecking from the nearest element with an explicit
// spellcheck attribute, so a mark decoration over code turns the checker
// (and with it the typo squiggles misreading code syntax) off for the block
// while the prose around it stays checked.
const noSpellcheck = Decoration.mark({
  attributes: {
    spellcheck: 'false',
    autocorrect: 'off',
    autocapitalize: 'off'
  }
})

// Every code surface the markdown parser can emit: fenced blocks, indented
// code blocks, inline backtick spans, and the YAML frontmatter block (which
// parses as its own node, not a fence).
const CODE_NODE_NAMES = new Set([
  'FencedCode',
  'CodeBlock',
  'CodeText',
  'InlineCode',
  'Frontmatter'
])

function codeRanges(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (!CODE_NODE_NAMES.has(node.name)) return true
      if (node.to > node.from) builder.add(node.from, node.to, noSpellcheck)
      return false
    }
  })
  return builder.finish()
}

export const markdownCodeSpellcheck = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    private tree: ReturnType<typeof syntaxTree>
    constructor(view: EditorView) {
      this.tree = syntaxTree(view.state)
      this.decorations = codeRanges(view)
    }
    update(update: ViewUpdate): void {
      // The Lezer parse advances asynchronously, so refresh with the tree
      // like the task marker plugin does.
      const tree = syntaxTree(update.state)
      if (update.docChanged || update.viewportChanged || tree !== this.tree) {
        this.tree = tree
        this.decorations = codeRanges(update.view)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations }
)
