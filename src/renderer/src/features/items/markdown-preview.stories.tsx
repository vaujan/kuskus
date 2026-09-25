import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import type { NoteAttachmentDto } from '../../../../shared/library-contract'
import { MarkdownPreview } from './markdown-preview'
import { NOTE_FORMATTING_MARKDOWN, NOTE_MARKDOWN } from './note-story-fixtures'

const missingImage: NoteAttachmentDto = {
  id: 'missing-image',
  filename: 'reference.png',
  relativePath: 'attachments/reference.png',
  sourceFilename: 'reference.png',
  mediaType: 'image/png',
  width: 1200,
  height: 800,
  missingContent: true
}

function NotePreviewExample({
  markdown,
  editable = false,
  attachments = [],
  showFoldingToggle = false
}: {
  markdown: string
  editable?: boolean
  attachments?: NoteAttachmentDto[]
  showFoldingToggle?: boolean
}): React.JSX.Element {
  const [value, setValue] = useState(markdown)
  const [foldingEnabled, setFoldingEnabled] = useState(true)

  return (
    <div>
      {showFoldingToggle ? (
        <button type="button" onClick={() => setFoldingEnabled((current) => !current)}>
          Content folding: {foldingEnabled ? 'On' : 'Off'}
        </button>
      ) : null}
      <div
        data-slot="scroll-area-viewport"
        className="max-h-[36rem] w-[min(44rem,calc(100vw-4rem))] overflow-auto rounded-lg border border-border bg-card p-6 text-card-foreground"
      >
        <MarkdownPreview
          key={String(foldingEnabled)}
          value={value}
          attachments={attachments}
          attachmentPreviews={{}}
          presentation="detail"
          contentFoldingEnabled={foldingEnabled}
          onChange={editable ? setValue : undefined}
        />
      </div>
    </div>
  )
}

const meta = {
  title: 'Notes/Reading',
  component: NotePreviewExample,
  args: { markdown: NOTE_MARKDOWN }
} satisfies Meta<typeof NotePreviewExample>

export default meta
type Story = StoryObj<typeof meta>

export const ProjectNote: Story = {}

export const NestedListFolding: Story = {
  args: { markdown: '- Parent\n  - Child one\n  - Child two\n- Sibling' }
}

export const NestedTaskFolding: Story = {
  args: {
    markdown: '- [x] Parent task\n  - [x] Completed child\n  - [ ] Open child\n- [ ] Sibling'
  }
}

export const HeadingFolding: Story = {
  args: {
    markdown:
      '# Parent\n\nParent text.\n\n## Child\n\nChild text.\n\n### Nested\n\nNested text.\n\n## Sibling\n\nSibling text.\n\nSetext sibling\n--------------\n\nSetext text.'
  }
}

export const ScrollPreservation: Story = {
  args: {
    markdown: [
      '# Intro',
      ...Array.from({ length: 30 }, (_, index) => `Intro paragraph ${index + 1}.`),
      '## Parent',
      ...Array.from({ length: 30 }, (_, index) => `Parent paragraph ${index + 1}.`),
      '## Tail',
      ...Array.from({ length: 30 }, (_, index) => `Tail paragraph ${index + 1}.`)
    ].join('\n\n')
  }
}

export const FoldingSetting: Story = {
  args: {
    markdown:
      '# Section\n\nSection text.\n\n- Parent\n  - Child\n\n## Subsection\n\nSubsection text.',
    showFoldingToggle: true
  }
}

export const InteractiveChecklist: Story = {
  args: { editable: true }
}

export const Formatting: Story = {
  args: { markdown: NOTE_FORMATTING_MARKDOWN }
}

export const MissingAttachment: Story = {
  args: {
    markdown: '# Image reference\n\n![Screenshot of the interface](attachments/reference.png)',
    attachments: [missingImage]
  }
}
