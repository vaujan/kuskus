import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { NOTE_MARKDOWN } from '../note-story-fixtures'
import { LiveMarkdownEditor } from './live-markdown-editor'

function LiveNoteExample({
  initialMarkdown,
  editable = true,
  showFoldingToggle = false
}: {
  initialMarkdown: string
  editable?: boolean
  showFoldingToggle?: boolean
}): React.JSX.Element {
  const [value, setValue] = useState(initialMarkdown)
  const [foldingEnabled, setFoldingEnabled] = useState(true)

  return (
    <div>
      {showFoldingToggle ? (
        <button type="button" onClick={() => setFoldingEnabled((current) => !current)}>
          Content folding: {foldingEnabled ? 'On' : 'Off'}
        </button>
      ) : null}
      <div className="h-[34rem] w-[min(48rem,calc(100vw-4rem))] overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
        <LiveMarkdownEditor
          value={value}
          active={false}
          editable={editable}
          contentFoldingEnabled={foldingEnabled}
          onChange={setValue}
        />
      </div>
    </div>
  )
}

const meta = {
  title: 'Notes/Live editor',
  component: LiveNoteExample,
  args: { initialMarkdown: NOTE_MARKDOWN }
} satisfies Meta<typeof LiveNoteExample>

export default meta
type Story = StoryObj<typeof meta>

export const WorkingNote: Story = {}

export const NestedListFolding: Story = {
  args: { initialMarkdown: '- Parent\n  - Child one\n  - Child two\n- Sibling' }
}

export const NestedTaskFolding: Story = {
  args: {
    initialMarkdown: '- [x] Parent task\n  - [x] Completed child\n  - [ ] Open child\n- [ ] Sibling'
  }
}

export const HeadingFolding: Story = {
  args: {
    initialMarkdown:
      '# Parent\n\nParent text.\n\n## Child\n\nChild text.\n\n### Nested\n\nNested text.\n\n## Sibling\n\nSibling text.\n\nSetext sibling\n--------------\n\nSetext text.'
  }
}

export const FoldingSetting: Story = {
  args: {
    initialMarkdown:
      '# Section\n\nSection text.\n\n- Parent\n  - Child\n\n## Subsection\n\nSubsection text.',
    showFoldingToggle: true
  }
}

export const NewNote: Story = {
  args: { initialMarkdown: '' }
}

export const ReadOnly: Story = {
  args: { editable: false }
}
