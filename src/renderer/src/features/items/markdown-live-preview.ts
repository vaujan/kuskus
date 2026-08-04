import { StateEffect, type EditorState, type Extension, type Transaction } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import katex from 'katex'

export interface LivePreviewImage {
  src: string | null
  missing: boolean
  label: string
}

export interface LivePreviewOptions {
  resolveImage?: (target: string) => LivePreviewImage | null
  onOpenLink?: (url: string) => void
  onOpenVaultLink?: (target: string) => void
}

export type MarkdownTypesetPresentation = 'card' | 'detail'

export const livePreviewInvalidation = StateEffect.define<null>()

type MarkdownSyntaxNode = ReturnType<ReturnType<typeof syntaxTree>['resolveInner']>

function hasInvalidation(transaction: Transaction): boolean {
  return transaction.effects.some((effect) => effect.is(livePreviewInvalidation))
}

function activeLineNumbers(state: EditorState): Set<number> {
  const lines = new Set<number>()
  for (const range of state.selection.ranges) {
    const from = state.doc.lineAt(range.from).number
    const to = state.doc.lineAt(range.to).number
    for (let line = from; line <= to; line += 1) lines.add(line)
  }
  return lines
}

function activeLineKey(state: EditorState): string {
  return Array.from(activeLineNumbers(state)).join(',')
}

class CheckboxWidget extends WidgetType {
  constructor(
    private readonly checked: boolean,
    private readonly position: number,
    private readonly toggle: (position: number) => void
  ) {
    super()
  }

  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.position === this.position
  }

  toDOM(): HTMLElement {
    const element = document.createElement('span')
    element.className = this.checked ? 'cm-kuskus-checkbox is-checked' : 'cm-kuskus-checkbox'
    element.setAttribute('role', 'checkbox')
    element.setAttribute('aria-checked', String(this.checked))
    element.setAttribute('aria-label', this.checked ? 'Completed task' : 'Open task')
    element.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      this.toggle(this.position)
    })
    return element
  }
}

class BulletWidget extends WidgetType {
  constructor(private readonly label: string) {
    super()
  }

  eq(other: BulletWidget): boolean {
    return other.label === this.label
  }

  toDOM(): HTMLElement {
    const element = document.createElement('span')
    element.className = 'cm-kuskus-bullet'
    element.setAttribute('aria-hidden', 'true')
    element.textContent = this.label
    return element
  }
}

class HorizontalRuleWidget extends WidgetType {
  eq(): boolean {
    return true
  }

  toDOM(): HTMLElement {
    const element = document.createElement('div')
    element.className = 'cm-kuskus-hr'
    element.setAttribute('aria-hidden', 'true')
    return element
  }
}

class CodeFenceWidget extends WidgetType {
  constructor(private readonly language: string) {
    super()
  }

  eq(other: CodeFenceWidget): boolean {
    return other.language === this.language
  }

  toDOM(): HTMLElement {
    const element = document.createElement('div')
    element.className = 'cm-kuskus-code-open'
    element.setAttribute('aria-hidden', 'true')
    element.textContent = this.language
    return element
  }
}

class ImageWidget extends WidgetType {
  constructor(
    private readonly target: string,
    private readonly alt: string,
    private readonly resolution: LivePreviewImage | null
  ) {
    super()
  }

  eq(other: ImageWidget): boolean {
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
    wrapper.className = 'cm-kuskus-image-wrap'
    if (this.resolution?.src) {
      const image = document.createElement('img')
      image.className = 'cm-kuskus-image'
      image.src = this.resolution.src
      image.alt = this.alt || this.resolution.label
      wrapper.appendChild(image)
      return wrapper
    }
    const chip = document.createElement('span')
    chip.className = 'cm-kuskus-chip'
    if (this.resolution?.missing) {
      chip.textContent = `Image missing: ${this.alt || this.resolution.label}`
    } else if (this.resolution) {
      chip.textContent = 'Loading image…'
    } else if (/^https?:\/\//i.test(this.target)) {
      chip.textContent = this.alt ? `Remote image: ${this.alt}` : 'Remote image'
    } else {
      chip.textContent = this.alt || this.target || 'Invalid image'
    }
    wrapper.appendChild(chip)
    return wrapper
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
    element.className = this.display ? 'cm-kuskus-math is-block' : 'cm-kuskus-math'
    try {
      element.innerHTML = katex.renderToString(this.tex, {
        displayMode: this.display,
        throwOnError: false
      })
    } catch {
      element.textContent = this.tex
    }
    return element
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

class LiveDecorationBuilder {
  private readonly replaces: ReplaceEntry[] = []
  private readonly marks: MarkEntry[] = []
  private readonly lines: LineEntry[] = []
  private readonly consumedLines = new Set<number>()

  constructor(
    private readonly state: EditorState,
    private readonly options: LivePreviewOptions,
    private readonly activeLines: Set<number>,
    private readonly toggleTask: (position: number) => void
  ) {}

  isActiveLine(position: number): boolean {
    return this.activeLines.has(this.state.doc.lineAt(position).number)
  }

  isLineActive(line: number): boolean {
    return this.activeLines.has(line)
  }

  private overlapsReplace(from: number, to: number): boolean {
    return this.replaces.some((entry) => from < entry.to && to > entry.from)
  }

  addReplace(from: number, to: number, decoration: Decoration): boolean {
    if (from >= to || this.overlapsReplace(from, to)) return false
    this.replaces.push({ from, to, decoration })
    return true
  }

  addMark(from: number, to: number, decoration: Decoration): void {
    if (from >= to) return
    this.marks.push({ from, to, decoration })
  }

  addLine(position: number, decoration: Decoration): void {
    this.lines.push({ position, decoration })
  }

  buildRange(from: number, to: number): void {
    syntaxTree(this.state).iterate({
      from,
      to,
      enter: (node) => {
        this.handleNode(node.node)
      }
    })
    this.scanBlockMath(from, to)
    this.scanInlineSegments(from, to)
  }

  private handleNode(node: MarkdownSyntaxNode): void {
    switch (node.name) {
      case 'ATXHeading1':
      case 'ATXHeading2':
      case 'ATXHeading3':
      case 'ATXHeading4':
      case 'ATXHeading5':
      case 'ATXHeading6':
        this.handleHeading(node)
        return
      case 'Blockquote':
        this.handleBlockquote(node)
        return
      case 'FencedCode':
        this.handleFencedCode(node)
        return
      case 'HorizontalRule':
        this.handleHorizontalRule(node.from)
        return
      case 'ListMark':
        this.handleListMark(node)
        return
      case 'ListItem':
        this.handleListItem(node)
        return
      case 'TaskMarker':
        this.handleTaskMarker(node.from, node.to)
        return
      case 'Emphasis':
      case 'StrongEmphasis':
        this.handleMarkerChildren(node, 'EmphasisMark')
        return
      case 'Strikethrough':
        this.handleMarkerChildren(node, 'StrikethroughMark')
        return
      case 'InlineCode':
        this.handleMarkerChildren(node, 'CodeMark')
        return
      case 'Link':
        this.handleLink(node)
        return
      case 'Image':
        this.handleImage(node)
        return
      default:
        return
    }
  }

  private handleHeading(node: MarkdownSyntaxNode): void {
    const level = node.name.slice(-1)
    this.addLine(
      this.state.doc.lineAt(node.from).from,
      Decoration.line({ class: `cm-kuskus-heading cm-kuskus-h${level}` })
    )
    if (this.isActiveLine(node.from)) return
    const mark = node.getChild('HeaderMark')
    if (!mark) return
    let end = mark.to
    if (this.state.sliceDoc(end, end + 1) === ' ') end += 1
    this.addReplace(mark.from, end, Decoration.replace({}))
  }

  private handleBlockquote(node: MarkdownSyntaxNode): void {
    let depth = 0
    for (let cursor: MarkdownSyntaxNode | null = node; cursor; cursor = cursor.parent) {
      if (cursor.name === 'Blockquote') depth += 1
    }
    const lineClass = depth > 1 ? 'cm-kuskus-quote cm-kuskus-quote-nested' : 'cm-kuskus-quote'
    const startLine = this.state.doc.lineAt(node.from).number
    const endLine = this.state.doc.lineAt(Math.min(node.to, this.state.doc.length)).number
    for (let line = startLine; line <= endLine; line += 1) {
      this.addLine(this.state.doc.line(line).from, Decoration.line({ class: lineClass }))
    }
    for (const mark of node.getChildren('QuoteMark')) {
      if (this.isActiveLine(mark.from)) continue
      let end = mark.to
      if (this.state.sliceDoc(end, end + 1) === ' ') end += 1
      this.addReplace(mark.from, end, Decoration.replace({}))
    }
  }

  private handleFencedCode(node: MarkdownSyntaxNode): void {
    const marks = node.getChildren('CodeMark')
    if (marks.length === 0) return
    const openMark = marks[0]
    const closeMark = marks.length > 1 ? marks[marks.length - 1] : null
    const infoNode = node.getChild('CodeInfo')
    const language = infoNode ? this.state.sliceDoc(infoNode.from, infoNode.to).trim() : ''
    const openLine = this.state.doc.lineAt(openMark.from)

    const firstContentLine = openLine.number + 1
    if (!this.isActiveLine(openMark.from)) {
      if (language) {
        this.addReplace(
          openLine.from,
          openLine.to,
          Decoration.replace({ widget: new CodeFenceWidget(language), block: true })
        )
      } else {
        const end = Math.min(openLine.to + 1, this.state.doc.length)
        this.addReplace(openLine.from, end, Decoration.replace({}))
      }
    }

    let lastContentLine = this.state.doc.lineAt(node.to).number
    if (closeMark) {
      const closeLine = this.state.doc.lineAt(closeMark.from)
      lastContentLine = closeLine.number - 1
      if (!this.isActiveLine(closeMark.from)) {
        const end = Math.min(closeLine.to + 1, this.state.doc.length)
        this.addReplace(closeLine.from, end, Decoration.replace({}))
      }
    }

    const docLines = this.state.doc.lines
    for (let line = firstContentLine; line <= Math.min(lastContentLine, docLines); line += 1) {
      let className = 'cm-kuskus-codeblock'
      if (line === firstContentLine && !language) className += ' cm-kuskus-codeblock-first'
      if (line === lastContentLine) className += ' cm-kuskus-codeblock-last'
      this.addLine(this.state.doc.line(line).from, Decoration.line({ class: className }))
    }
  }

  private handleHorizontalRule(from: number): void {
    if (this.isActiveLine(from)) return
    const line = this.state.doc.lineAt(from)
    this.addReplace(
      line.from,
      line.to,
      Decoration.replace({ widget: new HorizontalRuleWidget(), block: true })
    )
  }

  private handleListMark(node: MarkdownSyntaxNode): void {
    let ordered = false
    for (let cursor = node.parent; cursor; cursor = cursor.parent) {
      if (cursor.name === 'OrderedList') {
        ordered = true
        break
      }
      if (cursor.name === 'BulletList') break
    }
    const label = ordered ? this.state.sliceDoc(node.from, node.to) : '•'
    let end = node.to
    if (this.state.sliceDoc(end, end + 1) === ' ') end += 1
    this.addMark(node.from, end, Decoration.mark({ class: 'cm-kuskus-list-marker' }))
    if (this.isActiveLine(node.from)) return
    this.addReplace(node.from, end, Decoration.replace({ widget: new BulletWidget(label) }))
  }

  private handleListItem(node: MarkdownSyntaxNode): void {
    let depth = 0
    for (let cursor: MarkdownSyntaxNode | null = node; cursor; cursor = cursor.parent) {
      if (cursor.name === 'ListItem') depth += 1
    }
    const listNode = node.parent
    const parentItems = listNode?.getChildren('ListItem') ?? []
    const isFirst = parentItems[0]?.from === node.from
    const isTopLevel = listNode?.parent?.name === 'Document'
    const hasEarlierTopLevelContent =
      isTopLevel && this.state.sliceDoc(0, listNode?.from ?? node.from).trim().length > 0
    const startLine = this.state.doc.lineAt(node.from).number
    const endLine = this.state.doc.lineAt(Math.max(node.from, node.to - 1)).number
    for (let line = startLine; line <= endLine; line += 1) {
      const classes = [`cm-kuskus-list-item`, `cm-kuskus-list-depth-${Math.min(depth, 4)}`]
      if (line === startLine && !isFirst) classes.push('cm-kuskus-list-item-start')
      if (line === startLine && isFirst && hasEarlierTopLevelContent) {
        classes.push('cm-kuskus-list-first')
      }
      if (line === startLine && isFirst && !isTopLevel) {
        classes.push('cm-kuskus-list-nested-first')
      }
      this.addLine(this.state.doc.line(line).from, Decoration.line({ class: classes.join(' ') }))
    }
  }

  private handleTaskMarker(from: number, to: number): void {
    if (this.isActiveLine(from)) return
    const text = this.state.sliceDoc(from, to)
    const checked = /x/i.test(text.charAt(1))
    this.addReplace(
      from,
      to,
      Decoration.replace({ widget: new CheckboxWidget(checked, from, this.toggleTask) })
    )
  }

  private handleMarkerChildren(node: MarkdownSyntaxNode, markerName: string): void {
    const marks = node.getChildren(markerName)
    if (marks.length >= 2) {
      const contentClass =
        markerName === 'CodeMark'
          ? 'cm-kuskus-inline-code'
          : node.name === 'StrongEmphasis'
            ? 'cm-kuskus-strong'
            : node.name === 'Strikethrough'
              ? 'cm-kuskus-strikethrough'
              : null
      if (contentClass) {
        this.addMark(
          marks[0].to,
          marks[marks.length - 1].from,
          Decoration.mark({ class: contentClass })
        )
      }
    }
    for (const mark of marks) {
      if (this.isActiveLine(mark.from)) continue
      this.addReplace(mark.from, mark.to, Decoration.replace({}))
    }
  }

  private handleLink(node: MarkdownSyntaxNode): void {
    if (this.isActiveLine(node.from)) return
    const marks = node.getChildren('LinkMark')
    if (marks.length < 4) return
    const [open, close] = marks
    this.addReplace(open.from, open.to, Decoration.replace({}))
    this.addReplace(close.from, node.to, Decoration.replace({}))
    this.addMark(open.to, close.from, Decoration.mark({ class: 'cm-kuskus-link' }))
  }

  private handleImage(node: MarkdownSyntaxNode): void {
    if (this.isActiveLine(node.from)) return
    const urlNode = node.getChild('URL')
    if (!urlNode) return
    const target = this.state.sliceDoc(urlNode.from, urlNode.to)
    const marks = node.getChildren('LinkMark')
    const alt = marks.length >= 2 ? this.state.sliceDoc(marks[0].to, marks[1].from) : ''
    const resolution = this.options.resolveImage?.(target) ?? null
    this.addReplace(
      node.from,
      node.to,
      Decoration.replace({ widget: new ImageWidget(target, alt, resolution) })
    )
  }

  private isCodePosition(position: number): boolean {
    let node = syntaxTree(this.state).resolveInner(position, 1)
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

  private scanBlockMath(from: number, to: number): void {
    const startLine = this.state.doc.lineAt(from).number
    const endLine = this.state.doc.lineAt(to).number
    for (let line = startLine; line <= endLine; line += 1) {
      if (this.consumedLines.has(line)) continue
      const { from: lineFrom, text } = this.state.doc.line(line)
      const opening = /^ {0,3}\$\$(.*)$/.exec(text)
      if (!opening) continue
      if (this.isCodePosition(lineFrom)) continue

      const inlineClose = opening[1].trimEnd()
      if (inlineClose.endsWith('$$') && inlineClose.length > 2) {
        const tex = inlineClose.slice(0, -2).trim()
        if (tex && !this.isLineActive(line)) {
          this.addReplace(
            lineFrom,
            lineFrom + text.length,
            Decoration.replace({ widget: new MathWidget(tex, true), block: true })
          )
          this.consumedLines.add(line)
        }
        continue
      }

      let closeLine = -1
      for (let candidate = line + 1; candidate <= endLine; candidate += 1) {
        if (/^ {0,3}\$\$/.test(this.state.doc.line(candidate).text)) {
          closeLine = candidate
          break
        }
      }
      if (closeLine < 0) continue

      let active = false
      for (let covered = line; covered <= closeLine; covered += 1) {
        if (this.isLineActive(covered)) {
          active = true
          break
        }
      }
      const blockFrom = lineFrom
      const blockTo = this.state.doc.line(closeLine).to
      if (!active && !this.overlapsReplace(blockFrom, blockTo)) {
        const tex = this.state
          .sliceDoc(lineFrom + text.length, this.state.doc.line(closeLine).from)
          .replace(/^\n/, '')
          .replace(/\n$/, '')
        if (
          this.addReplace(
            blockFrom,
            blockTo,
            Decoration.replace({ widget: new MathWidget(tex, true), block: true })
          )
        ) {
          for (let consumed = line; consumed <= closeLine; consumed += 1) {
            this.consumedLines.add(consumed)
          }
        }
      }
      line = closeLine
    }
  }

  private scanInlineSegments(from: number, to: number): void {
    const startLine = this.state.doc.lineAt(from).number
    const endLine = this.state.doc.lineAt(to).number
    for (let line = startLine; line <= endLine; line += 1) {
      if (this.consumedLines.has(line)) continue
      const { from: lineFrom, text } = this.state.doc.line(line)
      if (this.isLineActive(line)) continue
      this.scanInlineMath(lineFrom, text)
      this.scanWikilinks(lineFrom, text)
    }
  }

  private scanInlineMath(lineFrom: number, text: string): void {
    const pattern = /\$([^$\s][^$\n]*?[^$\s]|[^$\s])\$/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const start = lineFrom + match.index
      const end = start + match[0].length
      if (text.charAt(match.index - 1) === '$' || text.charAt(end - lineFrom) === '$') continue
      if (this.isCodePosition(start)) continue
      this.addReplace(start, end, Decoration.replace({ widget: new MathWidget(match[1], false) }))
    }
  }

  private scanWikilinks(lineFrom: number, text: string): void {
    const pattern = /(!?)\[\[([^\]|#\n]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const start = lineFrom + match.index
      const end = start + match[0].length
      if (this.isCodePosition(start) || this.overlapsReplace(start, end)) continue
      const embed = match[1] === '!'
      const target = match[2].trim()
      const aliasRaw = match[3]
      const alias = aliasRaw?.trim()

      if (embed && this.options.resolveImage?.(target)) {
        const resolution = this.options.resolveImage(target)
        this.addReplace(
          start,
          end,
          Decoration.replace({ widget: new ImageWidget(target, alias ?? '', resolution) })
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

  finish(): DecorationSet {
    const entries = [
      ...this.replaces.map((entry) => entry.decoration.range(entry.from, entry.to)),
      ...this.marks.map((entry) => entry.decoration.range(entry.from, entry.to)),
      ...this.lines.map((entry) => entry.decoration.range(entry.position))
    ]
    return Decoration.set(entries, true)
  }
}

function buildDecorations(view: EditorView, options: LivePreviewOptions): DecorationSet {
  const activeLines = activeLineNumbers(view.state)
  const toggleTask = (position: number): void => {
    const current = view.state.sliceDoc(position + 1, position + 2)
    view.dispatch({
      changes: { from: position + 1, to: position + 2, insert: current === ' ' ? 'x' : ' ' },
      userEvent: 'input'
    })
  }
  const builder = new LiveDecorationBuilder(view.state, options, activeLines, toggleTask)
  for (const range of view.visibleRanges) {
    builder.buildRange(range.from, range.to)
  }
  return builder.finish()
}

const livePreviewTheme = EditorView.theme({
  '&.cm-kuskus-live': {
    color: 'var(--typeset-body-color)',
    fontFamily: 'var(--typeset-font-body)',
    fontSize: 'var(--typeset-size)',
    lineHeight: 'var(--typeset-leading)'
  },
  '&.cm-kuskus-live .cm-scroller': {
    fontFamily: 'var(--typeset-font-body)',
    fontSize: 'var(--typeset-size)',
    lineHeight: 'var(--typeset-leading)'
  },
  '.cm-kuskus-heading': {
    color: 'var(--foreground)',
    fontFamily: 'var(--typeset-font-heading)',
    fontWeight: '400',
    textWrap: 'balance'
  },
  '.cm-kuskus-h1': { fontSize: '1.75em', lineHeight: '1.3' },
  '.cm-kuskus-h2': { fontSize: '1.25em', lineHeight: '1.4' },
  '.cm-kuskus-h3': { fontSize: '1.125em', lineHeight: '1.45' },
  '.cm-kuskus-h4': { fontSize: '1em', lineHeight: '1.5' },
  '.cm-kuskus-h5': {
    color: 'var(--typeset-muted)',
    fontSize: '0.875em',
    fontWeight: '500',
    lineHeight: '1.5'
  },
  '.cm-kuskus-h6': {
    color: 'var(--typeset-muted)',
    fontSize: '0.8125em',
    fontWeight: '500',
    letterSpacing: '0.08em',
    lineHeight: '1.5',
    textTransform: 'uppercase'
  },
  '.cm-kuskus-link, .cm-kuskus-wikilink': {
    color: 'inherit',
    fontWeight: '500',
    textDecoration: 'underline',
    textDecorationColor: 'color-mix(in oklab, currentColor 30%, transparent)',
    textUnderlineOffset: '0.1875rem'
  },
  '.cm-kuskus-inline-code': {
    backgroundColor: 'var(--typeset-code-background)',
    borderRadius: 'min(calc(var(--radius) * 0.6), 0.35em)',
    fontFamily: 'var(--typeset-font-mono)',
    fontSize: '0.85em',
    lineHeight: 'inherit',
    padding: '0.125em 0.3em'
  },
  '.cm-kuskus-heading .cm-kuskus-inline-code': { fontSize: '0.9em' },
  '.cm-kuskus-strong': { color: 'var(--foreground)', fontWeight: '600' },
  '.cm-kuskus-heading .cm-kuskus-strong': { fontWeight: '700' },
  '.cm-kuskus-strikethrough': {
    color: 'var(--typeset-muted)',
    textDecoration: 'line-through'
  },
  '.cm-kuskus-quote': {
    borderLeft: '2px solid var(--typeset-rule)',
    paddingLeft: '1em'
  },
  '.cm-kuskus-quote-nested': {
    paddingLeft: '1.75rem'
  },
  '.cm-kuskus-codeblock': {
    backgroundColor: 'var(--typeset-code-background)',
    fontFamily: 'var(--typeset-font-mono)',
    fontSize: '0.875em',
    lineHeight: '1.5',
    padding: '0 1em'
  },
  '.cm-kuskus-codeblock-first': {
    borderRadius: 'var(--radius) var(--radius) 0 0',
    paddingTop: '0.75em'
  },
  '.cm-kuskus-codeblock-last': {
    borderRadius: '0 0 var(--radius) var(--radius)',
    paddingBottom: '0.75em'
  },
  '.cm-kuskus-codeblock-first.cm-kuskus-codeblock-last': {
    borderRadius: 'var(--radius)'
  },
  '.cm-kuskus-code-open': {
    backgroundColor: 'var(--typeset-code-background)',
    borderRadius: 'var(--radius) var(--radius) 0 0',
    color: 'var(--muted-foreground)',
    fontFamily: 'var(--typeset-font-mono)',
    fontSize: '0.75em',
    lineHeight: '1.5',
    padding: '0.5em 1em 0'
  },
  '.cm-kuskus-hr': {
    borderTop: '1px solid var(--typeset-rule)',
    margin: 'calc(var(--typeset-flow) * 2.4) 0 0',
    width: '100%'
  },
  '.cm-kuskus-bullet': {
    color: 'var(--typeset-muted)',
    display: 'inline-block',
    minWidth: '1.75em'
  },
  '.cm-kuskus-list-marker': {
    color: 'var(--typeset-muted)',
    display: 'inline-block',
    minWidth: '1.75em'
  },
  '.cm-kuskus-list-item': {
    paddingInlineStart: '0.5em'
  },
  '.cm-kuskus-list-depth-2': {
    paddingInlineStart: '2em'
  },
  '.cm-kuskus-list-depth-3': {
    paddingInlineStart: '3.5em'
  },
  '.cm-kuskus-list-depth-4': {
    paddingInlineStart: '5em'
  },
  '.cm-kuskus-list-item-start': {
    paddingTop: '0.5em'
  },
  '.cm-kuskus-list-first': {
    paddingTop: 'calc(var(--typeset-flow) + 0.5em)'
  },
  '.cm-kuskus-list-nested-first': {
    paddingTop: '1em'
  },
  '.cm-kuskus-checkbox': {
    alignItems: 'center',
    border: '1px solid color-mix(in oklab, var(--foreground) 45%, transparent)',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    display: 'inline-flex',
    height: '0.9375rem',
    justifyContent: 'center',
    marginRight: '0.4375rem',
    verticalAlign: '-0.125em',
    width: '0.9375rem'
  },
  '.cm-kuskus-checkbox.is-checked': {
    backgroundColor: 'var(--foreground)',
    borderColor: 'var(--foreground)'
  },
  '.cm-kuskus-checkbox.is-checked::after': {
    color: 'var(--background)',
    content: "'✓'",
    fontSize: '0.625rem',
    fontWeight: '700',
    lineHeight: '1'
  },
  '.cm-kuskus-image-wrap': {
    display: 'block'
  },
  '.cm-kuskus-image': {
    borderRadius: 'var(--radius-lg)',
    display: 'block',
    margin: 'var(--typeset-flow) 0 0',
    maxHeight: '32rem',
    maxWidth: '100%',
    outline: '1px solid var(--typeset-image-outline)',
    outlineOffset: '-1px'
  },
  '.cm-kuskus-chip': {
    alignItems: 'center',
    backgroundColor: 'var(--muted)',
    borderRadius: '0.5rem',
    color: 'var(--muted-foreground)',
    display: 'inline-flex',
    fontSize: '0.75rem',
    lineHeight: '1rem',
    margin: '0.375rem 0',
    maxWidth: '100%',
    padding: '0.5rem 0.75rem'
  },
  '.cm-kuskus-math.is-block': {
    display: 'block',
    overflowX: 'auto',
    padding: '0.375rem 0'
  }
})

function followClickHandler(getOptions: () => LivePreviewOptions): Extension {
  return EditorView.domEventHandlers({
    click(event, view) {
      if (!(event.ctrlKey || event.metaKey)) return false
      const target = event.target as HTMLElement | null
      const wiki = target?.closest('.cm-kuskus-wikilink')
      if (wiki) {
        const destination = wiki.getAttribute('data-target')
        if (destination) {
          getOptions().onOpenVaultLink?.(destination)
          event.preventDefault()
          return true
        }
      }
      const position = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (position === null) return false
      let node = syntaxTree(view.state).resolveInner(position, 1)
      for (;;) {
        if (node.name === 'Link') {
          const urlNode = node.getChild('URL')
          const url = urlNode ? view.state.sliceDoc(urlNode.from, urlNode.to) : ''
          if (/^https?:\/\//i.test(url)) {
            getOptions().onOpenLink?.(url)
            event.preventDefault()
            return true
          }
          return false
        }
        const parent = node.parent
        if (!parent) return false
        node = parent
      }
    }
  })
}

export function liveMarkdownPreview(
  getOptions: () => LivePreviewOptions,
  presentation: MarkdownTypesetPresentation
): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      private activeKey: string

      constructor(view: EditorView) {
        this.activeKey = activeLineKey(view.state)
        this.decorations = buildDecorations(view, getOptions())
      }

      update(update: ViewUpdate): void {
        const invalidated = update.transactions.some(hasInvalidation)
        const nextKey = activeLineKey(update.state)
        if (
          update.docChanged ||
          update.viewportChanged ||
          invalidated ||
          nextKey !== this.activeKey
        ) {
          this.activeKey = nextKey
          this.decorations = buildDecorations(update.view, getOptions())
        }
      }
    },
    { decorations: (value) => value.decorations }
  )
  return [
    EditorView.editorAttributes.of({
      class: 'cm-kuskus-live',
      'data-typeset-presentation': presentation
    }),
    plugin,
    livePreviewTheme,
    followClickHandler(getOptions)
  ]
}
