import {
  codeFolding,
  ensureSyntaxTree,
  foldEffect,
  foldedRanges,
  syntaxTree,
  unfoldEffect
} from '@codemirror/language'
import type { EditorState, Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import { headingFoldTargets, type HeadingFoldTarget } from '@/features/items/heading-folding'

interface ListFoldTarget {
  line: number
  from: number
  to: number
  depth: number
  task: boolean
}

function listFoldTargets(state: EditorState): ListFoldTarget[] {
  const targets: ListFoldTarget[] = []
  const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state)
  tree.iterate({
    enter(node) {
      if (node.name !== 'ListItem') return
      let child = node.node.firstChild
      let task = false
      while (child && child.name !== 'BulletList' && child.name !== 'OrderedList') {
        if (child.name === 'Task') task = true
        child = child.nextSibling
      }
      if (!child) return
      const line = state.doc.lineAt(node.from)
      const firstChildLine = state.doc.lineAt(child.from)
      if (firstChildLine.number <= line.number) return
      let precedingLine = state.doc.line(firstChildLine.number - 1)
      while (precedingLine.number > line.number && precedingLine.text.trim() === '') {
        precedingLine = state.doc.line(precedingLine.number - 1)
      }
      let depth = 0
      for (let parent = node.node.parent; parent; parent = parent.parent) {
        if (parent.name === 'ListItem') depth += 1
      }
      targets.push({ line: line.number, from: precedingLine.to, to: node.to, depth, task })
    }
  })
  return targets
}

function isFolded(state: EditorState, target: { from: number; to: number }): boolean {
  let folded = false
  foldedRanges(state).between(target.from, target.to, (from, to) => {
    if (from === target.from && to === target.to) folded = true
  })
  return folded
}

function setFoldButtonState(button: HTMLElement, folded: boolean, subject: string): void {
  const action = folded ? 'Expand' : 'Collapse'
  button.setAttribute('aria-label', `${action} ${subject}`)
  button.setAttribute('aria-expanded', String(!folded))
  button.title = `${action} ${subject}`
}

function headingTargets(state: EditorState): HeadingFoldTarget[] {
  const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state)
  return headingFoldTargets(tree, (position) => state.doc.lineAt(position), state.doc.length)
}

class HeadingFoldButton extends WidgetType {
  constructor(
    private readonly target: HeadingFoldTarget,
    private readonly folded: boolean
  ) {
    super()
  }

  eq(other: HeadingFoldButton): boolean {
    return other.target.line === this.target.line && other.folded === this.folded
  }

  toDOM(view: EditorView): HTMLElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'kuskus-list-fold-button cm-kuskus-heading-fold-button'
    button.dataset.headingFoldLine = String(this.target.line)
    setFoldButtonState(button, this.folded, 'heading section')
    button.innerHTML =
      '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>'
    button.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const target = headingTargets(view.state).find((entry) => entry.line === this.target.line)
      if (!target) return
      view.dispatch({
        effects: (isFolded(view.state, target) ? unfoldEffect : foldEffect).of({
          from: target.from,
          to: target.to
        })
      })
    })
    return button
  }

  updateDOM(dom: HTMLElement): boolean {
    if (dom.dataset.headingFoldLine !== String(this.target.line)) return false
    setFoldButtonState(dom, this.folded, 'heading section')
    return true
  }

  ignoreEvent(): boolean {
    return true
  }
}

class HeadingFoldControls {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.build(view.state)
  }

  update(update: ViewUpdate): void {
    if (
      update.docChanged ||
      update.transactions.some((transaction) =>
        transaction.effects.some((effect) => effect.is(foldEffect) || effect.is(unfoldEffect))
      )
    ) {
      this.decorations = this.build(update.state)
    }
  }

  private build(state: EditorState): DecorationSet {
    return Decoration.set(
      headingTargets(state).flatMap((target) => {
        const line = state.doc.line(target.line)
        let hidden = false
        foldedRanges(state).between(line.from, line.to, (from, to) => {
          if (from < line.from && to >= line.to) hidden = true
        })
        return hidden
          ? []
          : [
              Decoration.widget({
                widget: new HeadingFoldButton(target, isFolded(state, target)),
                side: -1
              }).range(line.to)
            ]
      }),
      true
    )
  }
}

class ListFoldButton extends WidgetType {
  constructor(
    private readonly target: ListFoldTarget,
    private readonly folded: boolean
  ) {
    super()
  }

  eq(other: ListFoldButton): boolean {
    return (
      other.target.line === this.target.line &&
      other.target.task === this.target.task &&
      other.folded === this.folded
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `kuskus-list-fold-button cm-kuskus-list-fold-button${this.target.task ? ' cm-kuskus-list-fold-button--task' : ''}`
    button.style.insetInlineStart = `calc(${this.target.task ? '-1.05em' : '-0.55em'}${' + var(--typeset-list-nesting)'.repeat(this.target.depth)})`
    button.dataset.listFoldLine = String(this.target.line)
    setFoldButtonState(button, this.folded, 'nested list')
    button.innerHTML =
      '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>'
    button.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const target = listFoldTargets(view.state).find((entry) => entry.line === this.target.line)
      if (!target) return
      view.dispatch({
        effects: (isFolded(view.state, target) ? unfoldEffect : foldEffect).of({
          from: target.from,
          to: target.to
        })
      })
    })
    return button
  }

  updateDOM(dom: HTMLElement): boolean {
    if (dom.dataset.listFoldLine !== String(this.target.line)) return false
    dom.style.insetInlineStart = `calc(${this.target.task ? '-1.05em' : '-0.55em'}${' + var(--typeset-list-nesting)'.repeat(this.target.depth)})`
    dom.classList.toggle('cm-kuskus-list-fold-button--task', this.target.task)
    setFoldButtonState(dom, this.folded, 'nested list')
    return true
  }

  ignoreEvent(): boolean {
    return true
  }
}

class ListFoldControls {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.build(view.state)
  }

  update(update: ViewUpdate): void {
    if (
      update.docChanged ||
      update.transactions.some((transaction) =>
        transaction.effects.some((effect) => effect.is(foldEffect) || effect.is(unfoldEffect))
      )
    ) {
      this.decorations = this.build(update.state)
    }
  }

  private build(state: EditorState): DecorationSet {
    return Decoration.set(
      listFoldTargets(state).flatMap((target) => {
        const line = state.doc.line(target.line)
        let hidden = false
        foldedRanges(state).between(line.from, line.to, (from, to) => {
          if (from < line.from && to >= line.to) hidden = true
        })
        return hidden
          ? []
          : [
              Decoration.widget({
                widget: new ListFoldButton(target, isFolded(state, target)),
                side: -1
              }).range(line.to)
            ]
      }),
      true
    )
  }
}

export function contentFolding(): Extension {
  return [
    codeFolding({
      placeholderDOM: () => {
        const placeholder = document.createElement('span')
        placeholder.className = 'cm-kuskus-list-fold-placeholder'
        return placeholder
      }
    }),
    ViewPlugin.fromClass(ListFoldControls, {
      decorations: (plugin) => plugin.decorations
    }),
    ViewPlugin.fromClass(HeadingFoldControls, {
      decorations: (plugin) => plugin.decorations
    })
  ]
}
