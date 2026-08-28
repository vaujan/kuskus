import { StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import type { ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

export interface MarkdownEditorBlocksOptions {
  content?: ReactNode
}

const reactBlockRoots = new WeakMap<HTMLElement, Root>()

class ReactBlockWidget extends WidgetType {
  constructor(private readonly content: ReactNode) {
    super()
  }

  eq(other: ReactBlockWidget): boolean {
    return other.content === this.content
  }

  toDOM(): HTMLElement {
    const host = document.createElement('div')
    host.className = 'cm-kuskus-document-blocks'
    const root = createRoot(host)
    reactBlockRoots.set(host, root)
    root.render(this.content)
    return host
  }

  updateDOM(host: HTMLElement): boolean {
    const root = reactBlockRoots.get(host)
    if (!root) return false
    root.render(this.content)
    return true
  }

  destroy(host: HTMLElement): void {
    reactBlockRoots.get(host)?.unmount()
    reactBlockRoots.delete(host)
  }

  ignoreEvent(): boolean {
    return true
  }
}

function buildDecorations(options: MarkdownEditorBlocksOptions): DecorationSet {
  if (!options.content) return Decoration.none
  return Decoration.set([
    Decoration.widget({
      block: true,
      side: -1,
      widget: new ReactBlockWidget(options.content)
    }).range(0)
  ])
}

export function markdownEditorBlocks(getOptions: () => MarkdownEditorBlocksOptions): Extension {
  const blocks = StateField.define<DecorationSet>({
    create: () => buildDecorations(getOptions()),
    update: (decorations, transaction) =>
      transaction.docChanged ? decorations.map(transaction.changes) : decorations,
    provide: (field) => EditorView.decorations.from(field)
  })
  return blocks
}
