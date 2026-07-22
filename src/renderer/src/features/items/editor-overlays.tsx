/* eslint-disable react-refresh/only-export-components -- These components are mounted into Milkdown-owned plugin roots. */
import { useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import {
  IconBold,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconH4,
  IconH5,
  IconH6,
  IconItalic,
  IconLink,
  IconList,
  IconListCheck,
  IconListNumbers,
  IconMath,
  IconQuote,
  IconSeparator,
  IconStrikethrough,
  IconTable,
  IconTypography,
  type TablerIcon
} from '@tabler/icons-react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  filterEditorCommands,
  flattenEditorCommandSections,
  moveEditorCommandIndex,
  type EditorCommandId
} from '@/features/items/editor-command-model'
import type { Ctx } from '@milkdown/kit/ctx'
import { commandsCtx, editorViewCtx, type Editor } from '@milkdown/kit/core'
import { slashFactory } from '@milkdown/kit/plugin/slash'
import {
  TooltipProvider as MilkdownTooltipProvider,
  tooltipFactory
} from '@milkdown/kit/plugin/tooltip'
import {
  addBlockTypeCommand,
  blockquoteSchema,
  bulletListSchema,
  clearTextInCurrentBlockCommand,
  codeBlockSchema,
  emphasisSchema,
  headingSchema,
  hrSchema,
  inlineCodeSchema,
  linkSchema,
  listItemSchema,
  orderedListSchema,
  paragraphSchema,
  selectTextNearPosCommand,
  setBlockTypeCommand,
  strongSchema,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  wrapInBlockTypeCommand
} from '@milkdown/kit/preset/commonmark'
import {
  createTable,
  strikethroughSchema,
  toggleStrikethroughCommand
} from '@milkdown/kit/preset/gfm'
import {
  NodeSelection,
  TextSelection,
  type EditorState,
  type PluginView
} from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { toggleLinkCommand } from '@milkdown/kit/component/link-tooltip'

const selectionToolbarPlugin = tooltipFactory('KUSKUS_SELECTION_TOOLBAR')
const slashMenuPlugin = slashFactory('KUSKUS_SLASH_MENU')
const MATH_INLINE_NODE = 'math_inline'

type ToolbarActionId = 'bold' | 'italic' | 'strike' | 'code' | 'math' | 'link'

interface ToolbarAction {
  id: ToolbarActionId
  label: string
  icon: TablerIcon
  shortcut?: string
}

const TOOLBAR_ACTIONS: readonly ToolbarAction[] = [
  { id: 'bold', label: 'Bold', icon: IconBold, shortcut: 'Ctrl+B' },
  { id: 'italic', label: 'Italic', icon: IconItalic, shortcut: 'Ctrl+I' },
  { id: 'strike', label: 'Strikethrough', icon: IconStrikethrough },
  { id: 'code', label: 'Inline code', icon: IconCode },
  { id: 'math', label: 'Inline math', icon: IconMath },
  { id: 'link', label: 'Link', icon: IconLink }
]

const HEADING_RESTRICTED_ACTIONS = new Set<ToolbarActionId>(['bold', 'italic', 'strike', 'code'])

const COMMAND_ICONS: Record<EditorCommandId, TablerIcon> = {
  text: IconTypography,
  'heading-1': IconH1,
  'heading-2': IconH2,
  'heading-3': IconH3,
  'heading-4': IconH4,
  'heading-5': IconH5,
  'heading-6': IconH6,
  quote: IconQuote,
  divider: IconSeparator,
  'bullet-list': IconList,
  'numbered-list': IconListNumbers,
  'task-list': IconListCheck,
  'code-block': IconCode,
  table: IconTable,
  'math-block': IconMath
}

function hasSelectedInlineMath(state: EditorState): boolean {
  return (
    state.selection instanceof NodeSelection && state.selection.node.type.name === MATH_INLINE_NODE
  )
}

function toggleInlineMath(view: EditorView): boolean {
  const { state } = view
  const nodeType = state.schema.nodes[MATH_INLINE_NODE]
  if (!nodeType) return false

  const { from, to } = state.selection
  if (
    state.selection instanceof NodeSelection &&
    state.selection.node.type.name === MATH_INLINE_NODE
  ) {
    const value = String(state.selection.node.attrs.value ?? '')
    const transaction = state.tr.replaceWith(from, to, state.schema.text(value))
    transaction.setSelection(TextSelection.create(transaction.doc, from, from + value.length))
    view.dispatch(transaction)
    return true
  }

  const value = state.doc.textBetween(from, to)
  const transaction = state.tr.replaceSelectionWith(nodeType.create({ value }))
  transaction.setSelection(NodeSelection.create(transaction.doc, from))
  view.dispatch(transaction)
  return true
}

function toolbarActionActive(ctx: Ctx, view: EditorView, action: ToolbarActionId): boolean {
  // Plugin views are constructed before Milkdown replaces editorViewCtx's placeholder.
  // Always inspect the concrete ProseMirror view passed to the plugin at this stage.
  const { state } = view
  if (action === 'math') return hasSelectedInlineMath(state)

  const mark = {
    bold: strongSchema,
    italic: emphasisSchema,
    strike: strikethroughSchema,
    code: inlineCodeSchema,
    link: linkSchema
  }[action]

  return state.doc.rangeHasMark(state.selection.from, state.selection.to, mark.type(ctx))
}

function selectionIntersectsHeading(ctx: Ctx, state: EditorState): boolean {
  const headingType = headingSchema.type(ctx)
  let intersectsHeading = false
  state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
    if (node.type !== headingType) return !intersectsHeading
    intersectsHeading = true
    return false
  })
  return intersectsHeading
}

function runToolbarAction(ctx: Ctx, action: ToolbarActionId): void {
  const commands = ctx.get(commandsCtx)
  if (action === 'bold') commands.call(toggleStrongCommand.key)
  else if (action === 'italic') commands.call(toggleEmphasisCommand.key)
  else if (action === 'strike') commands.call(toggleStrikethroughCommand.key)
  else if (action === 'code') commands.call(toggleInlineCodeCommand.key)
  else if (action === 'link') commands.call(toggleLinkCommand.key)
  else toggleInlineMath(ctx.get(editorViewCtx))
}

interface SelectionToolbarProps {
  actions: readonly ToolbarAction[]
  activeActions: ReadonlySet<ToolbarActionId>
  onEscape: () => void
  onRun: (action: ToolbarActionId) => void
}

function SelectionToolbar({
  actions,
  activeActions,
  onEscape,
  onRun
}: SelectionToolbarProps): React.JSX.Element {
  const toolbarRef = useRef<HTMLDivElement>(null)

  const moveFocus = (event: ReactKeyboardEvent<HTMLDivElement>, nextIndex: number): void => {
    const controls = toolbarRef.current?.querySelectorAll<HTMLButtonElement>(
      'button[data-editor-action]'
    )
    if (!controls?.length) return
    event.preventDefault()
    controls[(nextIndex + controls.length) % controls.length]?.focus()
  }

  return (
    <TooltipProvider delay={350}>
      <ToggleGroup
        ref={toolbarRef}
        className="kuskus-editor-toolbar-surface rounded-3xl p-1"
        multiple
        spacing={1}
        value={[...activeActions]}
        role="toolbar"
        aria-label="Text formatting"
        aria-orientation="horizontal"
        onValueChange={(nextActions) => {
          const changedAction = actions.find(
            ({ id }) => activeActions.has(id) !== nextActions.includes(id)
          )
          if (changedAction) onRun(changedAction.id)
        }}
        onPointerDownCapture={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          const controls = [
            ...(toolbarRef.current?.querySelectorAll<HTMLButtonElement>(
              'button[data-editor-action]'
            ) ?? [])
          ]
          const current = controls.indexOf(document.activeElement as HTMLButtonElement)
          if (event.key === 'ArrowRight') moveFocus(event, current + 1)
          else if (event.key === 'ArrowLeft') moveFocus(event, current - 1)
          else if (event.key === 'Home') moveFocus(event, 0)
          else if (event.key === 'End') moveFocus(event, controls.length - 1)
          else if (event.key === 'Escape') {
            event.preventDefault()
            onEscape()
          }
        }}
      >
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <div key={action.id} className="contents">
              {action.id === 'code' || action.id === 'link' ? (
                <Separator orientation="vertical" className="mx-0.5 h-6" />
              ) : null}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <ToggleGroupItem
                      data-editor-action={action.id}
                      className="size-10 shrink-0 p-0"
                      value={action.id}
                      aria-label={action.label}
                    />
                  }
                >
                  <Icon aria-hidden="true" stroke={activeActions.has(action.id) ? 2.6 : 1.8} />
                </TooltipTrigger>
                <TooltipContent>
                  <span>{action.label}</span>
                  {action.shortcut ? <Kbd>{action.shortcut}</Kbd> : null}
                </TooltipContent>
              </Tooltip>
            </div>
          )
        })}
      </ToggleGroup>
    </TooltipProvider>
  )
}

class SelectionToolbarView implements PluginView {
  readonly #content: HTMLDivElement
  readonly #ctx: Ctx
  readonly #provider: MilkdownTooltipProvider
  readonly #root: Root
  #shown = false
  #view: EditorView

  constructor(ctx: Ctx, view: EditorView) {
    this.#ctx = ctx
    this.#view = view
    this.#content = document.createElement('div')
    this.#content.className = 'kuskus-editor-selection-overlay not-typeset'
    this.#content.dataset.notTypeset = ''
    this.#root = createRoot(this.#content)
    flushSync(() => this.#render())

    this.#provider = new MilkdownTooltipProvider({
      content: this.#content,
      debounce: 20,
      offset: 10,
      shift: { padding: 8 },
      root: document.body,
      floatingUIOptions: { strategy: 'fixed' },
      shouldShow: (currentView) => {
        const { selection } = currentView.state
        const activeElement = (currentView.dom.getRootNode() as Document | ShadowRoot).activeElement
        const toolbarHasFocus =
          activeElement instanceof Node && this.#content.contains(activeElement)
        return (
          currentView.editable && !selection.empty && (currentView.hasFocus() || toolbarHasFocus)
        )
      }
    })
    this.#provider.onShow = () => {
      this.#shown = true
      this.#render()
    }
    this.#provider.onHide = () => {
      this.#shown = false
    }
    this.update(view)
  }

  update = (view: EditorView, previousState?: EditorState): void => {
    this.#view = view
    this.#provider.update(view, previousState)
    if (this.#shown) this.#render()
  }

  handleKeyDown = (event: KeyboardEvent): boolean => {
    if (event.key !== 'F10' || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return false
    if (!this.#shown || this.#view.state.selection.empty) return false
    event.preventDefault()
    this.#content.querySelector<HTMLButtonElement>('button[data-editor-action]')?.focus()
    return true
  }

  destroy = (): void => {
    this.#provider.destroy()
    this.#root.unmount()
    this.#content.remove()
  }

  #render = (): void => {
    const actions = selectionIntersectsHeading(this.#ctx, this.#view.state)
      ? TOOLBAR_ACTIONS.filter((action) => !HEADING_RESTRICTED_ACTIONS.has(action.id))
      : TOOLBAR_ACTIONS
    const activeActions = new Set(
      actions
        .filter((action) => toolbarActionActive(this.#ctx, this.#view, action.id))
        .map((action) => action.id)
    )
    this.#root.render(
      <SelectionToolbar
        actions={actions}
        activeActions={activeActions}
        onEscape={() => {
          this.#provider.hide()
          this.#view.focus()
        }}
        onRun={(action) => {
          if (action === 'link') {
            this.#provider.hide()
            runToolbarAction(this.#ctx, action)
            return
          }
          runToolbarAction(this.#ctx, action)
          this.#view.focus()
          this.#render()
        }}
      />
    )
  }
}

function runSlashCommand(ctx: Ctx, command: EditorCommandId): void {
  const commands = ctx.get(commandsCtx)
  const clear = (): void => {
    commands.call(clearTextInCurrentBlockCommand.key)
  }

  if (command === 'text') {
    clear()
    commands.call(setBlockTypeCommand.key, { nodeType: paragraphSchema.type(ctx) })
  } else if (command.startsWith('heading-')) {
    clear()
    commands.call(setBlockTypeCommand.key, {
      nodeType: headingSchema.type(ctx),
      attrs: { level: Number(command.at(-1)) }
    })
  } else if (command === 'quote') {
    clear()
    commands.call(wrapInBlockTypeCommand.key, { nodeType: blockquoteSchema.type(ctx) })
  } else if (command === 'divider') {
    clear()
    commands.call(addBlockTypeCommand.key, { nodeType: hrSchema.type(ctx) })
  } else if (command === 'bullet-list') {
    clear()
    commands.call(wrapInBlockTypeCommand.key, { nodeType: bulletListSchema.type(ctx) })
  } else if (command === 'numbered-list') {
    clear()
    commands.call(wrapInBlockTypeCommand.key, { nodeType: orderedListSchema.type(ctx) })
  } else if (command === 'task-list') {
    clear()
    commands.call(wrapInBlockTypeCommand.key, {
      nodeType: listItemSchema.type(ctx),
      attrs: { checked: false }
    })
  } else if (command === 'code-block') {
    clear()
    commands.call(setBlockTypeCommand.key, { nodeType: codeBlockSchema.type(ctx) })
  } else if (command === 'table') {
    clear()
    const view = ctx.get(editorViewCtx)
    const { from } = view.state.selection
    commands.call(addBlockTypeCommand.key, { nodeType: createTable(ctx, 3, 3) })
    commands.call(selectTextNearPosCommand.key, { pos: from })
  } else if (command === 'math-block') {
    clear()
    commands.call(addBlockTypeCommand.key, {
      nodeType: codeBlockSchema.type(ctx),
      attrs: { language: 'LaTeX' }
    })
  }
}

function selectionAllowsSlashMenu(view: EditorView): boolean {
  const { selection } = view.state
  if (!(selection instanceof TextSelection) || !selection.empty) return false
  if (selection.$head.parentOffset !== selection.$head.parent.content.size) return false

  for (let depth = selection.$from.depth; depth >= 0; depth -= 1) {
    const name = selection.$from.node(depth).type.name
    if (
      name === 'code_block' ||
      name === 'list_item' ||
      name === 'bullet_list' ||
      name === 'ordered_list'
    )
      return false
  }
  return true
}

interface SlashCommandMenuProps {
  activeIndex: number
  menuId: string
  query: string
  onActiveIndexChange: (index: number) => void
  onRun: (command: EditorCommandId) => void
}

function SlashCommandMenu({
  activeIndex,
  menuId,
  query,
  onActiveIndexChange,
  onRun
}: SlashCommandMenuProps): React.JSX.Element {
  const sections = filterEditorCommands(query)
  const commands = flattenEditorCommandSections(sections)
  const activeCommand = commands[activeIndex]

  return (
    <Command
      className="kuskus-editor-command-surface h-auto w-84 max-w-[calc(100vw-1rem)]"
      shouldFilter={false}
      value={activeCommand?.id ?? ''}
      onValueChange={(value) => {
        const index = commands.findIndex((command) => command.id === value)
        if (index >= 0) onActiveIndexChange(index)
      }}
      label="Insert Markdown block"
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <span className="text-sm font-medium">Insert block</span>
        <Kbd>{query ? `/${query}` : '/'}</Kbd>
      </div>
      <CommandSeparator />
      <CommandList className="max-h-64" id={menuId} aria-label="Markdown block commands">
        {commands.length === 0 ? <CommandEmpty>No matching commands</CommandEmpty> : null}
        {sections.map((section) => (
          <CommandGroup key={section.group} heading={section.group}>
            {section.commands.map((command) => {
              const Icon = COMMAND_ICONS[command.id]
              const index = commands.indexOf(command)
              return (
                <CommandItem
                  id={`${menuId}-${command.id}`}
                  key={command.id}
                  value={command.id}
                  className="min-h-10"
                  onPointerMove={() => onActiveIndexChange(index)}
                  onSelect={() => onRun(command.id)}
                >
                  <Icon aria-hidden="true" />
                  <span>{command.label}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
      <span className="sr-only" aria-live="polite" role="status">
        {commands.length} {commands.length === 1 ? 'command' : 'commands'} available
      </span>
    </Command>
  )
}

let slashMenuSequence = 0

class SlashMenuView implements PluginView {
  readonly #content: HTMLDivElement
  readonly #ctx: Ctx
  readonly #menuId: string
  readonly #provider: MilkdownTooltipProvider
  readonly #root: Root
  #activeIndex = 0
  #programmaticBlockStart: number | null = null
  #query = ''
  #shown = false
  #view: EditorView

  constructor(ctx: Ctx, view: EditorView) {
    this.#ctx = ctx
    this.#view = view
    this.#menuId = `kuskus-slash-menu-${++slashMenuSequence}`
    this.#content = document.createElement('div')
    this.#content.className = 'kuskus-editor-slash-overlay not-typeset'
    this.#content.dataset.notTypeset = ''
    this.#content.addEventListener('pointerdown', this.#keepEditorFocus)
    view.dom.parentElement?.addEventListener('pointerup', this.#handleBlockAdd, true)
    this.#root = createRoot(this.#content)
    flushSync(() => this.#render())

    this.#provider = new MilkdownTooltipProvider({
      content: this.#content,
      debounce: 20,
      offset: 10,
      shift: { padding: 8 },
      root: document.body,
      floatingUIOptions: { placement: 'bottom-start', strategy: 'fixed' },
      shouldShow: (currentView) => {
        if (!currentView.editable || !selectionAllowsSlashMenu(currentView)) return false
        const { $from } = currentView.state.selection
        const currentText = $from.parent.textBetween(
          Math.max(0, $from.parentOffset - 500),
          $from.parentOffset,
          undefined,
          '\uFFFC'
        )
        if (this.#programmaticBlockStart !== null) {
          if ($from.start() !== this.#programmaticBlockStart) {
            this.#programmaticBlockStart = null
            return false
          }
          this.#setQuery(currentText.startsWith('/') ? currentText.slice(1) : currentText)
          return true
        }
        if (!currentText?.startsWith('/')) return false
        this.#setQuery(currentText.slice(1))
        return true
      }
    })
    this.#provider.onShow = () => {
      this.#shown = true
      this.#syncEditorAria()
      this.#render()
    }
    this.#provider.onHide = () => {
      this.#shown = false
      this.#syncEditorAria()
    }
    this.update(view)
  }

  update = (view: EditorView, previousState?: EditorState): void => {
    this.#view = view
    this.#provider.update(view, previousState)
    this.#syncEditorAria()
  }

  handleKeyDown = (event: KeyboardEvent): boolean => {
    if (!this.#shown || event.isComposing || event.altKey || event.ctrlKey || event.metaKey)
      return false
    const commands = flattenEditorCommandSections(filterEditorCommands(this.#query))
    let direction: 'first' | 'last' | 'next' | 'previous' | null = null
    if (event.key === 'ArrowDown') direction = 'next'
    else if (event.key === 'ArrowUp') direction = 'previous'
    else if (event.key === 'Home') direction = 'first'
    else if (event.key === 'End') direction = 'last'

    if (direction) {
      event.preventDefault()
      this.#activeIndex = moveEditorCommandIndex(this.#activeIndex, direction, commands.length)
      flushSync(() => this.#render())
      this.#syncEditorAria()
      this.#content
        .querySelector<HTMLElement>(`#${this.#menuId}-${commands[this.#activeIndex]?.id}`)
        ?.scrollIntoView({ block: 'nearest' })
      return true
    }
    if (event.key === 'Enter' && commands[this.#activeIndex]) {
      event.preventDefault()
      this.#run(commands[this.#activeIndex].id)
      return true
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      this.#programmaticBlockStart = null
      this.#provider.hide()
      this.#view.focus()
      return true
    }
    return false
  }

  destroy = (): void => {
    this.#provider.destroy()
    this.#content.removeEventListener('pointerdown', this.#keepEditorFocus)
    this.#view.dom.parentElement?.removeEventListener('pointerup', this.#handleBlockAdd, true)
    this.#root.unmount()
    this.#content.remove()
    this.#clearEditorAria()
  }

  #keepEditorFocus = (event: PointerEvent): void => {
    event.preventDefault()
  }

  #handleBlockAdd = (event: PointerEvent): void => {
    const target = event.target as HTMLElement | null
    const operation = target?.closest<HTMLElement>('.milkdown-block-handle .operation-item')
    if (!operation || operation.parentElement?.firstElementChild !== operation) return
    queueMicrotask(() => {
      if (!this.#view.editable) return
      this.#programmaticBlockStart = this.#view.state.selection.$from.start()
      this.#query = ''
      this.#activeIndex = 0
      this.#provider.update(this.#view)
    })
  }

  #setQuery(query: string): void {
    if (query === this.#query) return
    this.#query = query
    this.#activeIndex = 0
    this.#render()
  }

  #run(command: EditorCommandId): void {
    this.#programmaticBlockStart = null
    runSlashCommand(this.#ctx, command)
    this.#provider.hide()
    this.#view.focus()
  }

  #render(): void {
    this.#root.render(
      <SlashCommandMenu
        activeIndex={this.#activeIndex}
        menuId={this.#menuId}
        query={this.#query}
        onActiveIndexChange={(index) => {
          this.#activeIndex = index
          this.#render()
          this.#syncEditorAria()
        }}
        onRun={(command) => this.#run(command)}
      />
    )
  }

  #syncEditorAria(): void {
    if (!this.#shown) {
      this.#clearEditorAria()
      return
    }
    const commands = flattenEditorCommandSections(filterEditorCommands(this.#query))
    const active = commands[this.#activeIndex]
    this.#view.dom.setAttribute('aria-haspopup', 'listbox')
    this.#view.dom.setAttribute('aria-expanded', 'true')
    this.#view.dom.setAttribute('aria-controls', this.#menuId)
    if (active) this.#view.dom.setAttribute('aria-activedescendant', `${this.#menuId}-${active.id}`)
    else this.#view.dom.removeAttribute('aria-activedescendant')
  }

  #clearEditorAria(): void {
    this.#view.dom.removeAttribute('aria-haspopup')
    this.#view.dom.removeAttribute('aria-expanded')
    this.#view.dom.removeAttribute('aria-controls')
    this.#view.dom.removeAttribute('aria-activedescendant')
  }
}

export function configureKuskusEditorOverlays(editor: Editor): void {
  let toolbarView: SelectionToolbarView | null = null
  editor
    .config((ctx) => {
      ctx.set(selectionToolbarPlugin.key, {
        view: (view) => {
          toolbarView = new SelectionToolbarView(ctx, view)
          return toolbarView
        },
        props: {
          handleKeyDown: (_view, event) => toolbarView?.handleKeyDown(event) ?? false
        }
      })
    })
    .use(selectionToolbarPlugin)

  let slashView: SlashMenuView | null = null
  editor
    .config((ctx) => {
      ctx.set(slashMenuPlugin.key, {
        view: (view) => {
          slashView = new SlashMenuView(ctx, view)
          return slashView
        },
        props: {
          handleKeyDown: (_view, event) => slashView?.handleKeyDown(event) ?? false
        }
      })
    })
    .use(slashMenuPlugin)
}
