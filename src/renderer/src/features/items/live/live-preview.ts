import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import katex from 'katex'
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
import {
  codeLanguageLabel,
  copyMarkdownCode,
  isMermaidLanguage,
  markdownCodeUrlRanges
} from '../markdown-code'
import { renderMermaid } from '../mermaid-renderer'

let liveMermaidSequence = 0

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
function createCodeBlockHeader(code: string, language: string): HTMLElement {
  const header = document.createElement('div')
  header.className = 'kuskus-code-block-header cm-kuskus-code-block-header'

  const label = document.createElement('span')
  label.className = 'cm-kuskus-code-block-label'
  label.textContent = codeLanguageLabel(language)

  const copy = document.createElement('button')
  copy.type = 'button'
  copy.className = 'kuskus-code-copy cm-kuskus-code-copy'
  copy.textContent = 'Copy'
  copy.setAttribute('aria-label', `Copy code${language ? `: ${language}` : ''}`)
  // Keep widget controls from moving the editor caret or stealing focus.
  copy.addEventListener('mousedown', (event) => {
    event.preventDefault()
    event.stopPropagation()
  })
  copy.addEventListener('click', async (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (await copyMarkdownCode(code)) {
      copy.textContent = 'Copied'
      window.setTimeout(() => {
        copy.textContent = 'Copy'
      }, 1500)
    }
  })

  header.append(label, copy)
  return header
}

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
    return createCodeBlockHeader(this.code, this.language)
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
    const remote = /^https?:\/\//i.test(this.target)
    const src = this.resolution?.src ?? (remote ? this.target : null)
    if (src) {
      const image = document.createElement('img')
      image.className = 'kuskus-markdown-image cm-kuskus-image'
      image.src = src
      image.alt = this.alt || this.resolution?.label || ''
      image.loading = 'lazy'
      if (remote) image.referrerPolicy = 'no-referrer'
      if (this.resolution) {
        image.width = this.resolution.width
        image.height = this.resolution.height
      }
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

class MermaidWidget extends WidgetType {
  private observer: MutationObserver | null = null
  private renderId = 0

  constructor(private readonly code: string) {
    super()
  }

  eq(other: MermaidWidget): boolean {
    return other.code === this.code
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'kuskus-code-block kuskus-mermaid not-typeset'
    wrapper.dataset.notTypeset = ''
    const body = document.createElement('div')
    body.className = 'kuskus-mermaid-loading'
    body.setAttribute('role', 'status')
    wrapper.append(createCodeBlockHeader(this.code, 'mermaid'), body)

    const render = (): void => {
      const renderId = ++this.renderId
      const dark = document.documentElement.classList.contains('dark')
      body.className = 'kuskus-mermaid-loading'
      body.textContent = 'Rendering diagram…'
      void renderMermaid(`kuskus-live-mermaid-${++liveMermaidSequence}`, this.code, dark).then(
        (svg) => {
          if (renderId !== this.renderId) return
          body.className = 'kuskus-mermaid-diagram'
          body.setAttribute('role', 'img')
          body.setAttribute('aria-label', 'Mermaid diagram')
          body.innerHTML = svg
        },
        () => {
          if (renderId !== this.renderId) return
          body.className = ''
          body.removeAttribute('role')
          body.removeAttribute('aria-label')
          body.replaceChildren(
            Object.assign(document.createElement('pre'), { textContent: this.code })
          )
        }
      )
    }
    render()
    this.observer = new MutationObserver(render)
    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    return wrapper
  }

  destroy(): void {
    this.renderId += 1
    this.observer?.disconnect()
    this.observer = null
  }

  ignoreEvent(event: Event): boolean {
    return event.type === 'mousedown' || event.type === 'click'
  }
}

class MathWidget extends WidgetType {
  constructor(
    private readonly tex: string,
    private readonly display: boolean
  ) {
    super()
  }

  eq(other: MathWidget): boolean {
    return other.tex === this.tex && other.display === this.display
  }

  toDOM(): HTMLElement {
    const element = document.createElement(this.display ? 'div' : 'span')
    element.className = this.display ? 'kuskus-code-block cm-kuskus-math-block' : 'kuskus-math'
    const content = this.display ? document.createElement('div') : element
    if (this.display) content.className = 'kuskus-math-block-body'
    try {
      content.innerHTML = katex.renderToString(this.tex, {
        displayMode: this.display,
        throwOnError: false
      })
    } catch {
      content.textContent = this.tex
    }
    if (this.display) element.append(createCodeBlockHeader(this.tex, 'math'), content)
    return element
  }

  ignoreEvent(event: Event): boolean {
    return this.display && (event.type === 'mousedown' || event.type === 'click')
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
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number
    const last = state.doc.lineAt(Math.max(range.from, range.to)).number
    for (let line = first; line <= last; line += 1) result.add(line)
  }
  return result
}

class KuskusLiveDecorationBuilder {
  private readonly replaces: ReplaceEntry[] = []
  private readonly marks: MarkEntry[] = []
  private readonly lines: LineEntry[] = []
  private readonly consumedLines = new Set<number>()

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
    this.scanBlockMath()
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
      if (this.consumedLines.has(line)) continue
      const from = doc.line(line).from
      if (isCodePosition(this.state, from)) continue
      this.addLine(from, Decoration.line({ class: 'cm-kuskus-blank' }))
    }
  }

  private handleNode(node: MarkdownSyntaxNode): void {
    // Frontmatter uses the exact same card lines and header widget as a
    // fenced YAML code block. Clicking any line reveals the raw source.
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

      // Replace only the opener text, not its newline. Consuming the line
      // break pulls the first YAML row into the widget line and leaves it
      // outside the card background.
      const openerEnd = firstLine.to + 1
      const closerStart = lastLine.from
      const yaml = this.state.doc.sliceString(openerEnd, closerStart)
      for (const link of markdownCodeUrlRanges(yaml)) {
        this.addMark(
          openerEnd + link.from,
          openerEnd + link.to,
          Decoration.mark({
            class: 'cm-kuskus-yaml-link',
            attributes: { 'data-url': link.url }
          })
        )
      }
      this.addReplace(closerStart, node.to, Decoration.replace({}))
      this.addLine(
        firstLine.from,
        Decoration.line({ class: 'cm-atomic-fenced-code cm-kuskus-code-first' })
      )
      this.addLine(lastLine.from, Decoration.line({ class: 'cm-kuskus-code-closer' }))
      const bodyStart = firstLine.number + 1
      const bodyEnd = lastLine.number - 1
      for (let n = bodyStart; n <= bodyEnd; n += 1) {
        this.addLine(
          this.state.doc.line(n).from,
          Decoration.line({ class: 'cm-atomic-fenced-code' })
        )
      }
      if (bodyStart <= bodyEnd) {
        this.addLine(
          this.state.doc.line(bodyEnd).from,
          Decoration.line({ class: 'cm-kuskus-code-last' })
        )
      } else {
        this.addLine(firstLine.from, Decoration.line({ class: 'cm-kuskus-code-last' }))
      }
      this.addReplace(
        firstLine.from,
        firstLine.to,
        Decoration.replace({
          widget: new CodeBlockHeaderWidget(yaml, 'yaml'),
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
        this.addLine(openLine.from, Decoration.line({ class: 'cm-kuskus-code-first' }))
        if (anyLineActive) {
          if (closeLine.number !== openLine.number) {
            this.addLine(closeLine.from, Decoration.line({ class: 'cm-kuskus-code-last' }))
          }
        } else if (closeLine.number === openLine.number + 1) {
          // Empty fences have no content line, so their header owns both
          // rounded ends while the hidden closer collapses.
          this.addLine(openLine.from, Decoration.line({ class: 'cm-kuskus-code-last' }))
          this.addLine(closeLine.from, Decoration.line({ class: 'cm-kuskus-code-closer' }))
        } else {
          // Atomic hides the inactive closing fence text, but CM6 still
          // reserves the line box. Put the card bottom on the final code
          // line and collapse only that hidden closing-fence line.
          const lastCodeLine = this.state.doc.line(closeLine.number - 1)
          this.addLine(lastCodeLine.from, Decoration.line({ class: 'cm-kuskus-code-last' }))
          this.addLine(closeLine.from, Decoration.line({ class: 'cm-kuskus-code-closer' }))
        }
        if (!anyLineActive) {
          const info = node.getChildren('CodeInfo')[0]
          const language = info ? this.state.doc.sliceString(info.from, info.to).trim() : ''
          const code = this.state.doc
            .sliceString(openLine.to + 1, closeLine.from)
            .replace(/\n$/, '')
          if (isMermaidLanguage(language)) {
            this.addReplace(
              node.from,
              node.to,
              Decoration.replace({ widget: new MermaidWidget(code), block: true })
            )
            return
          }
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
      if (this.consumedLines.has(line)) continue
      if (this.isLineActive(line)) continue
      this.scanInlineMath(lineFrom, text)
      this.scanWikilinks(lineFrom, text)
    }
  }

  private scanBlockMath(): void {
    const doc = this.state.doc
    for (let line = 1; line <= doc.lines; line += 1) {
      if (this.consumedLines.has(line)) continue
      const { from, to, text } = doc.line(line)
      const opening = /^ {0,3}\$\$(.*)$/.exec(text)
      if (!opening || isCodePosition(this.state, from)) continue

      const sameLine = opening[1].trimEnd()
      if (sameLine.endsWith('$$') && sameLine.length > 2) {
        if (!this.isLineActive(line)) {
          const tex = sameLine.slice(0, -2).trim()
          if (tex) {
            this.addReplace(
              from,
              to,
              Decoration.replace({ widget: new MathWidget(tex, true), block: true })
            )
            this.consumedLines.add(line)
          }
        }
        continue
      }

      let closeLine = -1
      for (let candidate = line + 1; candidate <= doc.lines; candidate += 1) {
        if (/^ {0,3}\$\$\s*$/.test(doc.line(candidate).text)) {
          closeLine = candidate
          break
        }
      }
      if (closeLine < 0) continue

      let active = false
      for (let covered = line; covered <= closeLine; covered += 1) {
        if (this.isLineActive(covered)) active = true
      }
      if (!active) {
        const close = doc.line(closeLine)
        const tex = doc.sliceString(to + 1, close.from).replace(/\n$/, '')
        if (
          this.addReplace(
            from,
            close.to,
            Decoration.replace({ widget: new MathWidget(tex, true), block: true })
          )
        ) {
          for (let covered = line; covered <= closeLine; covered += 1) {
            this.consumedLines.add(covered)
          }
        }
      }
      line = closeLine
    }
  }

  private scanInlineMath(lineFrom: number, text: string): void {
    const pattern = /\$([^$\s][^$\n]*?[^$\s]|[^$\s])\$/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const start = lineFrom + match.index
      const end = start + match[0].length
      if (text.charAt(match.index - 1) === '$' || text.charAt(end - lineFrom) === '$') continue
      if (isCodePosition(this.state, start) || this.overlapsReplace(start, end)) continue
      this.addReplace(start, end, Decoration.replace({ widget: new MathWidget(match[1], false) }))
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
    wikilinkInteraction(getOptions),
    yamlLinkInteraction(getOptions)
  ]
}

function yamlLinkInteraction(getOptions: () => LiveEditorOptions): Extension {
  return EditorView.domEventHandlers({
    click: (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return false
      }
      const link = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        '.cm-kuskus-yaml-link'
      )
      const url = link?.dataset.url
      if (!url) return false
      event.preventDefault()
      event.stopPropagation()
      getOptions().onOpenLink?.(url)
      return true
    }
  })
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
