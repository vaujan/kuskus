import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import {
  Facet,
  StateField,
  type EditorState,
  type Extension,
  type Range,
  type Transaction
} from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'

import { inlinePreview } from './atomic/inline-preview'
import { tables } from './atomic/table-widget'
import { readOnlyFacet } from './atomic/read-only'
import { treeGrowthEffect } from './atomic/tree-progress'
import { autoCloseCodeFence } from './atomic/edit-helpers'

export interface LivePreviewImage {
  src: string | null
  missing: boolean
  label: string
  width: number
  height: number
}

export interface LiveEditorOptions {
  resolveImage?: (target: string) => LivePreviewImage | null
  onOpenLink?: (url: string) => void
  onOpenVaultLink?: (target: string) => void
  onPasteImage?: (file: File, insertAtSelection: (src: string) => void) => void
}

function isCodePosition(state: EditorState, position: number): boolean {
  let node = syntaxTree(state).resolveInner(position, 1)
  for (;;) {
    if (
      node.name === 'InlineCode' ||
      node.name === 'FencedCode' ||
      node.name === 'CodeBlock' ||
      node.name === 'CodeText'
    ) {
      return true
    }
    const parent = node.parent
    if (!parent) return false
    node = parent
  }
}

class WikilinkImageWidget extends WidgetType {
  constructor(
    private readonly target: string,
    private readonly alt: string,
    private readonly resolution: LivePreviewImage | null
  ) {
    super()
  }

  eq(other: WikilinkImageWidget): boolean {
    return (
      other.target === this.target &&
      other.alt === this.alt &&
      other.resolution?.src === this.resolution?.src &&
      other.resolution?.missing === this.resolution?.missing &&
      other.resolution?.label === this.resolution?.label
    )
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('span')
    wrapper.className = 'kuskus-markdown-image-wrap cm-kuskus-image-wrap'
    if (this.resolution?.src) {
      const image = document.createElement('img')
      image.className = 'kuskus-markdown-image cm-kuskus-image'
      image.src = this.resolution.src
      image.alt = this.alt || this.resolution.label
      image.loading = 'lazy'
      image.width = this.resolution.width
      image.height = this.resolution.height
      wrapper.appendChild(image)
      return wrapper
    }
    const chip = document.createElement('span')
    chip.className = 'kuskus-rich-image-state cm-kuskus-chip'
    if (this.resolution?.missing) {
      chip.textContent = `Image missing: ${this.alt || this.resolution.label}`
    } else if (this.resolution) {
      chip.textContent = 'Loading image…'
    } else {
      chip.textContent = this.alt || this.target || 'Invalid image'
    }
    wrapper.appendChild(chip)
    return wrapper
  }
}

/** Block-level widget for standard markdown images `![alt](src)`.
 * Renders below the source line (side: 1) so the inline-preview hide
 * decoration can keep the raw source hidden on inactive lines without
 * any range conflict — we never replace the `Image` node range. */
class MarkdownImageBlockWidget extends WidgetType {
  constructor(
    private readonly target: string,
    private readonly alt: string,
    private readonly resolution: LivePreviewImage | null
  ) {
    super()
  }

  eq(other: MarkdownImageBlockWidget): boolean {
    return (
      other.target === this.target &&
      other.alt === this.alt &&
      other.resolution?.src === this.resolution?.src &&
      other.resolution?.missing === this.resolution?.missing &&
      other.resolution?.label === this.resolution?.label
    )
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-kuskus-image-block'
    if (this.resolution?.src) {
      const image = document.createElement('img')
      image.className = 'kuskus-markdown-image cm-kuskus-image'
      image.src = this.resolution.src
      image.alt = this.alt || this.resolution.label
      image.loading = 'lazy'
      image.width = this.resolution.width
      image.height = this.resolution.height
      wrapper.appendChild(image)
      return wrapper
    }
    const chip = document.createElement('span')
    chip.className = 'kuskus-rich-image-state cm-kuskus-chip'
    if (this.resolution?.missing) {
      chip.textContent = `Image missing: ${this.alt || this.resolution.label}`
    } else if (/^https?:\/\//i.test(this.target)) {
      chip.textContent = this.alt ? `Remote image: ${this.alt}` : 'Remote image'
    } else {
      chip.textContent = this.alt || this.target || 'Invalid image'
    }
    wrapper.appendChild(chip)
    return wrapper
  }
}

interface ReplaceEntry {
  from: number
  to: number
  decoration: Decoration
}

interface MarkEntry {
  from: number
  to: number
  decoration: Decoration
}

interface LineEntry {
  position: number
  decoration: Decoration
}

type MarkdownSyntaxNode = ReturnType<ReturnType<typeof syntaxTree>['resolveInner']>

function activeLineNumbers(state: EditorState): Set<number> {
  const result = new Set<number>()
  if (state.selection.main.empty) {
    for (const range of state.selection.ranges) {
      const first = state.doc.lineAt(range.from).number
      const last = state.doc.lineAt(Math.max(range.from, range.to)).number
      for (let line = first; line <= last; line += 1) result.add(line)
    }
  }
  return result
}

class KuskusLiveDecorationBuilder {
  private readonly replaces: ReplaceEntry[] = []
  private readonly marks: MarkEntry[] = []
  private readonly lines: LineEntry[] = []

  constructor(
    private readonly state: EditorState,
    private readonly options: LiveEditorOptions,
    private readonly activeLines: Set<number>
  ) {}

  private isLineActive(line: number): boolean {
    return this.activeLines.has(line)
  }

  private overlapsReplace(from: number, to: number): boolean {
    return this.replaces.some((entry) => from < entry.to && to > entry.from)
  }

  private addReplace(from: number, to: number, decoration: Decoration): boolean {
    if (from >= to || this.overlapsReplace(from, to)) return false
    this.replaces.push({ from, to, decoration })
    return true
  }

  private addMark(from: number, to: number, decoration: Decoration): void {
    if (from >= to) return
    this.marks.push({ from, to, decoration })
  }

  private addLine(position: number, decoration: Decoration): void {
    this.lines.push({ position, decoration })
  }

  build(): DecorationSet {
    syntaxTree(this.state).iterate({
      enter: (node) => {
        this.handleNode(node.node)
      }
    })
    this.scanInlineSegments()
    this.scanBlankLines()
    return Decoration.set(
      [
        ...this.replaces.map((entry) => entry.decoration.range(entry.from, entry.to)),
        ...this.marks.map((entry) => entry.decoration.range(entry.from, entry.to)),
        ...this.lines.map((entry) => entry.decoration.range(entry.position))
      ],
      true
    )
  }

  /** Empty lines become the read renderer's inter-block rhythm: in Read
   * mode a blank markdown line produces no element and blocks carry
   * `margin-block-start: var(--typeset-flow)`; in live mode the blank
   * line itself renders, so it takes exactly that height. */
  private scanBlankLines(): void {
    const doc = this.state.doc
    for (let line = 1; line <= doc.lines; line += 1) {
      if (doc.line(line).text.trim() !== '') continue
      const from = doc.line(line).from
      if (isCodePosition(this.state, from)) continue
      this.addLine(from, Decoration.line({ class: 'cm-kuskus-blank' }))
    }
  }

  private handleNode(node: MarkdownSyntaxNode): void {
    // Only Kuskus-specific constructs beyond atomic's inline preview.
    // Atomic owns headings, lists, links, emphasis, inline code,
    // fenced code, tasks, horizontal rules, and tables. The build()
    // walk still visits nodes so wikilink/blank-line scans can see them.
    void node
  }

  private scanInlineSegments(): void {
    const lineCount = this.state.doc.lines
    for (let line = 1; line <= lineCount; line += 1) {
      const { from: lineFrom, text } = this.state.doc.line(line)
      if (this.isLineActive(line)) continue
      this.scanWikilinks(lineFrom, text)
    }
  }

  private scanWikilinks(lineFrom: number, text: string): void {
    const pattern = /(!?)\[\[([^\]|#\n]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const start = lineFrom + match.index
      const end = start + match[0].length
      if (isCodePosition(this.state, start) || this.overlapsReplace(start, end)) continue
      const embed = match[1] === '!'
      const target = match[2].trim()
      const aliasRaw = match[3]
      const alias = aliasRaw?.trim()

      if (embed && this.options.resolveImage?.(target)) {
        const resolution = this.options.resolveImage(target)
        this.addReplace(
          start,
          end,
          Decoration.replace({ widget: new WikilinkImageWidget(target, alias ?? '', resolution) })
        )
        continue
      }

      const linkMark = Decoration.mark({
        class: 'cm-kuskus-wikilink',
        attributes: { 'data-target': target }
      })
      if (aliasRaw !== undefined) {
        const aliasStart = end - 2 - aliasRaw.length
        this.addReplace(start, aliasStart, Decoration.replace({}))
        this.addReplace(end - 2, end, Decoration.replace({}))
        this.addMark(aliasStart, end - 2, linkMark)
      } else {
        const prefixLength = embed ? 3 : 2
        this.addReplace(start, start + prefixLength, Decoration.replace({}))
        this.addReplace(end - 2, end, Decoration.replace({}))
        this.addMark(start + prefixLength, end - 2, linkMark)
      }
    }
  }
}

/** Facet carrying the live options so state fields can read the latest
 * resolution config without threading getOptions through builders. */
export const liveOptionsFacet = Facet.define<LiveEditorOptions, LiveEditorOptions>({
  combine: (values) => values[0] ?? {}
})

/** Pure builder exported for headless tests (mirrors the legacy test seam). */
export function buildKuskusLiveDecorations(
  state: EditorState,
  options: LiveEditorOptions
): DecorationSet {
  return new KuskusLiveDecorationBuilder(state, options, activeLineNumbers(state)).build()
}

function treeGrew(transaction: Transaction): boolean {
  return transaction.effects.some((effect) => effect.is(treeGrowthEffect))
}

const kuskusLiveField = StateField.define<DecorationSet>({
  create: (state) => buildKuskusLiveDecorations(state, state.facet(liveOptionsFacet)),
  update: (value, transaction) => {
    if (
      transaction.docChanged ||
      !transaction.startState.selection.eq(transaction.state.selection) ||
      treeGrew(transaction) ||
      transaction.reconfigured
    ) {
      return buildKuskusLiveDecorations(
        transaction.state,
        transaction.state.facet(liveOptionsFacet)
      )
    }
    return value
  },
  provide: (field) => EditorView.decorations.from(field)
})

function isInsideTable(node: MarkdownSyntaxNode): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.name === 'Table') return true
  }
  return false
}

export function buildKuskusImageBlocks(
  state: EditorState,
  options: LiveEditorOptions
): DecorationSet {
  const ranges: Range<Decoration>[] = []
  const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state)
  tree.iterate({
    enter: (node) => {
      if (node.name !== 'Image') return
      // Tables render images inside cells through their own widget.
      if (isInsideTable(node.node)) return
      const raw = state.doc.sliceString(node.from, node.to)
      const match = raw.match(/^!\[([^\]]*)\]\(([^\s)"']+)(?:\s+["'][^)]*["'])?\)$/)
      if (!match) return
      const [, alt, src] = match
      if (!src) return
      const line = state.doc.lineAt(node.from)
      const resolution = options.resolveImage?.(src) ?? null
      ranges.push(
        Decoration.widget({
          widget: new MarkdownImageBlockWidget(src, alt, resolution),
          block: true,
          side: 1
        }).range(line.to)
      )
    }
  })
  return Decoration.set(ranges, true)
}

const kuskusImageBlockField = StateField.define<DecorationSet>({
  create: (state) => buildKuskusImageBlocks(state, state.facet(liveOptionsFacet)),
  update: (value, transaction) => {
    if (treeGrew(transaction) || transaction.reconfigured) {
      return buildKuskusImageBlocks(transaction.state, transaction.state.facet(liveOptionsFacet))
    }
    if (!transaction.docChanged) return value
    const mapped = value.map(transaction.changes)
    // Cheap signal: any touched line containing `![` may hold an image.
    let affected = false
    transaction.changes.iterChanges((_fromA, _toA, fromB, toB) => {
      if (affected) return
      const startLine = transaction.state.doc.lineAt(fromB)
      const endLine = toB > startLine.to ? transaction.state.doc.lineAt(toB) : startLine
      for (let n = startLine.number; n <= endLine.number; n++) {
        if (transaction.state.doc.line(n).text.includes('![')) {
          affected = true
          return
        }
      }
    })
    return affected
      ? buildKuskusImageBlocks(transaction.state, transaction.state.facet(liveOptionsFacet))
      : mapped
  },
  provide: (field) => EditorView.decorations.from(field)
})

/**
 * Kuskus-specific layers for the live surface. Atomic's inline preview
 * owns headings, lists, links, emphasis, inline code, fenced code,
 * tasks, horizontal rules, and WYSIWYG tables. This adds the syntax
 * atomic does not know: KaTeX math, `[[wikilinks]]`, and `![[embeds]]`
 * resolved through the library's attachment pipeline.
 *
 * The returned extensions expect `readOnlyFacet` to be supplied by the
 * editor surface (defaults to false in atomic's own composition).
 */
export function kuskusLiveExtensions(getOptions: () => LiveEditorOptions): Extension {
  return [
    liveOptionsFacet.of(getOptions()),
    inlinePreview({
      onLinkClick: (url) => getOptions().onOpenLink?.(url)
    }),
    tables({
      onLinkClick: (url) => getOptions().onOpenLink?.(url)
    }),
    autoCloseCodeFence,
    kuskusLiveField,
    kuskusImageBlockField,
    wikilinkInteraction(getOptions)
  ]
}

function wikilinkInteraction(getOptions: () => LiveEditorOptions): Extension {
  return EditorView.domEventHandlers({
    click: (event) => {
      if (!(event.ctrlKey || event.metaKey)) return false
      const target = event.target as HTMLElement | null
      const wiki = target?.closest<HTMLElement>('.cm-kuskus-wikilink')
      if (!wiki) return false
      const destination = wiki.getAttribute('data-target')
      if (!destination) return false
      event.preventDefault()
      event.stopPropagation()
      getOptions().onOpenVaultLink?.(destination)
      return true
    }
  })
}

export { readOnlyFacet }
export type { Range }
