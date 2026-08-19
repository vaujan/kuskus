import { ViewPlugin, type EditorView, type PluginValue, type ViewUpdate } from '@codemirror/view'

import { findMarkdownTableRange, insideMarkdownFence } from '@/features/items/markdown-table'

const PIPE = /(?<!\\)\|/g

class MarkdownTableGuides implements PluginValue {
  private readonly overlay = document.createElement('div')
  private readonly view: EditorView
  private pending = false

  constructor(view: EditorView) {
    this.view = view
    this.overlay.className = 'cm-kuskus-table-guides'
    document.body.appendChild(this.overlay)
    window.addEventListener('scroll', this.scheduleRender, true)
    this.scheduleRender()
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.selectionSet || update.geometryChanged) {
      this.scheduleRender()
    }
  }

  destroy(): void {
    window.removeEventListener('scroll', this.scheduleRender, true)
    this.overlay.remove()
  }

  // Layout reads (coordsAtPos / lineBlockAt) are only allowed outside of an
  // update cycle, so never render synchronously from update().
  private readonly scheduleRender = (): void => {
    if (this.pending) return
    this.pending = true
    requestAnimationFrame(() => {
      this.pending = false
      this.render()
    })
  }

  private readonly render = (): void => {
    const state = this.view.state
    const head = state.selection.main.head
    const range = findMarkdownTableRange(state.doc, head)
    if (!range || insideMarkdownFence(state, head)) {
      this.overlay.style.display = 'none'
      return
    }
    this.overlay.style.display = ''
    const fragment = document.createDocumentFragment()
    const lastLine = state.doc.lineAt(range.to).number
    for (
      let lineNumber = state.doc.lineAt(range.from).number;
      lineNumber <= lastLine;
      lineNumber += 1
    ) {
      const line = state.doc.line(lineNumber)
      const top = this.view.coordsAtPos(line.from)
      if (!top) continue
      const block = this.view.lineBlockAt(line.from)
      const lineTop = top.top
      const lineBottom = lineTop + block.height
      if (lineBottom < 0 || lineTop > window.innerHeight) continue
      for (const match of line.text.matchAll(PIPE)) {
        if (match.index === 0 || match.index === line.text.length - 1) continue
        const coords = this.view.coordsAtPos(line.from + match.index + 1)
        if (!coords) continue
        const guide = document.createElement('div')
        guide.className = 'cm-kuskus-table-guide'
        guide.style.left = `${coords.left}px`
        guide.style.top = `${lineTop}px`
        guide.style.height = `${Math.max(0, lineBottom - lineTop)}px`
        fragment.appendChild(guide)
      }
    }
    this.overlay.replaceChildren(fragment)
  }
}

export const markdownTableGuides = ViewPlugin.fromClass(MarkdownTableGuides)
