export type EditorCommandGroup = 'Text' | 'Lists' | 'Advanced'

export const EDITOR_COMMAND_GROUPS: readonly EditorCommandGroup[] = ['Text', 'Lists', 'Advanced']

export const EDITOR_COMMANDS = [
  { id: 'text', group: 'Text', label: 'Text', keywords: ['paragraph', 'body'], hint: 'Text' },
  { id: 'heading-1', group: 'Text', label: 'Heading 1', keywords: ['title', 'h1'], hint: '#' },
  { id: 'heading-2', group: 'Text', label: 'Heading 2', keywords: ['subtitle', 'h2'], hint: '##' },
  { id: 'heading-3', group: 'Text', label: 'Heading 3', keywords: ['h3'], hint: '###' },
  { id: 'heading-4', group: 'Text', label: 'Heading 4', keywords: ['h4'], hint: '####' },
  { id: 'heading-5', group: 'Text', label: 'Heading 5', keywords: ['h5'], hint: '#####' },
  { id: 'heading-6', group: 'Text', label: 'Heading 6', keywords: ['h6'], hint: '######' },
  { id: 'quote', group: 'Text', label: 'Quote', keywords: ['blockquote'], hint: '>' },
  { id: 'divider', group: 'Text', label: 'Divider', keywords: ['rule', 'separator'], hint: '---' },
  { id: 'bullet-list', group: 'Lists', label: 'Bullet list', keywords: ['unordered'], hint: '-' },
  {
    id: 'numbered-list',
    group: 'Lists',
    label: 'Numbered list',
    keywords: ['ordered'],
    hint: '1.'
  },
  {
    id: 'task-list',
    group: 'Lists',
    label: 'Task list',
    keywords: ['todo', 'checklist'],
    hint: '[ ]'
  },
  { id: 'code-block', group: 'Advanced', label: 'Code block', keywords: ['fence'], hint: '```' },
  { id: 'table', group: 'Advanced', label: 'Table', keywords: ['grid'], hint: '3 × 3' },
  {
    id: 'math-block',
    group: 'Advanced',
    label: 'Math block',
    keywords: ['latex', 'equation'],
    hint: '$$'
  }
] as const satisfies readonly {
  id: string
  group: EditorCommandGroup
  label: string
  keywords: readonly string[]
  hint: string
}[]

export type EditorCommandId = (typeof EDITOR_COMMANDS)[number]['id']
export type EditorCommand = (typeof EDITOR_COMMANDS)[number]

export interface EditorCommandSection {
  group: EditorCommandGroup
  commands: EditorCommand[]
}

export function filterEditorCommands(query: string): EditorCommandSection[] {
  const normalized = query.trim().toLocaleLowerCase()
  return EDITOR_COMMAND_GROUPS.map((group) => ({
    group,
    commands: EDITOR_COMMANDS.filter((command) => {
      if (command.group !== group) return false
      if (!normalized) return true
      return [command.label, command.id, ...command.keywords]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalized)
    })
  })).filter((section) => section.commands.length > 0)
}

export function flattenEditorCommandSections(
  sections: readonly EditorCommandSection[]
): EditorCommand[] {
  return sections.flatMap((section) => section.commands)
}

export function moveEditorCommandIndex(
  current: number,
  direction: 'first' | 'last' | 'next' | 'previous',
  count: number
): number {
  if (count <= 0) return -1
  if (direction === 'first') return 0
  if (direction === 'last') return count - 1
  if (direction === 'next') return Math.min(Math.max(current, 0) + 1, count - 1)
  return Math.max(current <= 0 ? 0 : current - 1, 0)
}
