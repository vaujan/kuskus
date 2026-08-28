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
import { codeLanguageLabel, copyMarkdownCode } from '../markdown-code'
import { noteFrontmatterSource } from '../../../../../shared/note-frontmatter'

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
/** Header widget for inactive fenced-code blocks: language label + copy
 * button, mirroring read mode's .kuskus-code-block-header. The fence's
 * first line is decorated with an empty replace carrying this widget so
 * the source ```` ```lang ```` is hidden and the header occupies that
 * line's box. Skipped entirely on active lines (cursor inside the block)
 * so the user can edit the fence marks. */
class CodeBlockHeaderWidget extends WidgetType {
  constructor(
    private readonly code: string,
    private readonly language: string
  ) {
    super()
  }

  eq(other: CodeBlockHeaderWidget): boolean {
    return other.code === this.code && other.language === this.language
  }

  toDOM(): HTMLElement {
    const header = document.createElement('div')
    header.className = 'cm-kuskus-code-block-header'

    const label = document.createElement('span')
    label.className = 'cm-kuskus-code-block-label'
    label.textContent = codeLanguageLabel(this.language)

    const copy = document.createElement('button')
    copy.type = 'button'
    copy.className = 'cm-kuskus-code-copy'
    copy.textContent = 'Copy'
    copy.setAttribute('aria-label', `Copy code${this.language ? `: ${this.language}` : ''}`)
    // Mirror TaskCheckboxWidget: stop CM6 from treating the press as
    // editor input (which would place the caret in the code block and
    // focus the editor) and stop the browser default (which would focus
    // the button). The click handler below still fires because
    // ignoreEvent only opts the event out of CM6's own handling.
    copy.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    copy.addEventListener('click', async (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (await copyMarkdownCode(this.code)) {
        copy.textContent = 'Copied'
        window.setTimeout(() => {
          copy.textContent = 'Copy'
        }, 1500)
      }
    })

    header.append(label, copy)
    return header
  }

  ignoreEvent(event: Event): boolean {
    return event.type === 'mousedown' || event.type === 'click'
  }
}

/** Header widget for an inactive frontmatter block: a "YAML" label with
 *  the property count plus a Copy button, mirroring the fenced-code
 *  header. The opener `---` line is replaced by this header; when the
 *  cursor enters the frontmatter the raw source (delimiters included)
 *  reveals for direct editing, exactly like an active fence. */
class FrontmatterHeaderWidget extends WidgetType {
  constructor(
    private readonly yaml: string,
    private readonly count: number
  ) {
    super()
  }

  eq(other: FrontmatterHeaderWidget): boolean {
    return other.yaml === this.yaml && other.count === this.count
  }

  toDOM(): HTMLElement {
    const header = document.createElement('div')
    header.className = 'cm-kuskus-code-block-header cm-kuskus-frontmatter-header'

    const label = document.createElement('span')
    label.className = 'cm-kuskus-code-block-label'
    label.textContent =
      this.count === 0
        ? 'YAML'
        : `YAML · ${this.count} ${this.count === 1 ? 'property' : 'properties'}`

    const copy = document.createElement('button')
    copy.type = 'button'
    copy.className = 'cm-kuskus-code-copy'
    copy.textContent = 'Copy'
    copy.setAttribute('aria-label', 'Copy YAML frontmatter')
    copy.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    copy.addEventListener('click', async (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (await copyMarkdownCode(this.yaml)) {
        copy.textContent = 'Copied'
        window.setTimeout(() => {
          copy.textContent = 'Copy'
        }, 1500)
      }
    })

    header.append(label, copy)
    return header
  }

  ignoreEvent(event: Event): boolean {
    return event.type === 'mousedown' || event.type === 'click'
  }
}

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
    // Frontmatter: the leading YAML block reads as a rounded code card
    // (header + muted YAML body) when the cursor is NOT inside it — the
    // same reveal pattern atomic uses for fenced code. Clicking any line
    // of the frontmatter activates the whole block so the raw `---`
    // delimiters and exact source are editable.
    if (node.name === 'Frontmatter') {
      const firstLine = this.state.doc.lineAt(node.from)
      const lastLine = this.state.doc.lineAt(node.to)
      let anyLineActive = false
      for (let n = firstLine.number; n <= lastLine.number; n += 1) {
        if (this.isLineActive(n)) {
          anyLineActive = true
          break
        }
      }
      if (anyLineActive) {
        for (let n = firstLine.number; n <= lastLine.number; n += 1) {
          this.activeLines.add(n)
        }
        return
      }

      // Inactive: hide the `---` delimiters, give the body lines the
      // code-card treatment, and replace the opener with the header.
      const openerEnd = firstLine.to + 1
      const closerStart = lastLine.from
      const yaml = this.state.doc.sliceString(openerEnd, closerStart)
      this.addReplace(closerStart, node.to, Decoration.replace({}))
      const bodyStart = firstLine.number + 1
      const bodyEnd = lastLine.number - 1
      for (let n = bodyStart; n <= bodyEnd; n += 1) {
        this.addLine(
          this.state.doc.line(n).from,
          Decoration.line({ class: 'cm-kuskus-frontmatter-line' })
        )
      }
      if (bodyStart <= bodyEnd) {
        this.addLine(
          this.state.doc.line(bodyEnd).from,
          Decoration.line({ class: 'cm-kuskus-frontmatter-last' })
        )
      }
      if (bodyStart > bodyEnd) {
        this.addLine(firstLine.from, Decoration.line({ class: 'cm-kuskus-frontmatter-empty' }))
      }
      const source = noteFrontmatterSource(this.state.doc.sliceString(0, node.to))
      const count = source
        ? source.yaml.split(/\r?\n/).filter((line) => /^\S.*:/.test(line)).length
        : 0
      this.addReplace(
        firstLine.from,
        openerEnd,
        Decoration.replace({
          widget: new FrontmatterHeaderWidget(yaml, count),
          block: true
        })
      )
      return
    }

    // Atomic owns headings, lists, links, emphasis, inline code,
    // fenced code, tasks, horizontal rules, and tables. This layer
    // only extends it: first/last fenced-code lines get corner classes
    // so the block reads as one rounded container like read mode's
    // .kuskus-code-block (per-line radius made it look like stacked
    // pills).
    if (node.name === 'FencedCode') {
      const marks = node.getChildren('CodeMark')
      if (marks.length >= 2) {
        const openLine = this.state.doc.lineAt(marks[0].from)
        const closeLine = this.state.doc.lineAt(marks[marks.length - 1].from)
        this.addLine(openLine.from, Decoration.line({ class: 'cm-kuskus-code-first' }))
        if (closeLine.number !== openLine.number) {
          this.addLine(closeLine.from, Decoration.line({ class: 'cm-kuskus-code-last' }))
        }

        // Inactive-block header: the first fence line is fully replaced
        // by the header widget (language + copy button) so the block
        // reads like read mode's rounded code card. The header is skipped
        // when ANY line of the block is active — clicking anywhere in a
        // fence activates the whole block (mirrors atomic's expansion),
        // and the raw fence must stay visible for editing.
        const firstActive = this.isLineActive(openLine.number)
        let anyLineActive = firstActive
        if (!anyLineActive && closeLine.number !== openLine.number) {
          for (let n = openLine.number + 1; n <= closeLine.number; n += 1) {
            if (this.isLineActive(n)) {
              anyLineActive = true
              break
            }
          }
        }
        if (!anyLineActive) {
          const info = node.getChildren('CodeInfo')[0]
          const language = info ? this.state.doc.sliceString(info.from, info.to).trim() : ''
          const code = this.state.doc.sliceString(marks[0].to, marks[marks.length - 1].from)
          this.addReplace(
            openLine.from,
            openLine.to,
            Decoration.replace({
              widget: new CodeBlockHeaderWidget(code, language),
              block: true
            })
          )
        }
      }
    }
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
