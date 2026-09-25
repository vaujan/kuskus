import type { NoteItemDto } from '../../../../shared/library-contract'

export const NOTE_MARKDOWN = `# Project notes

Collect the references that explain **why** this direction works. Keep the first pass small, then refine the details.

## Next steps

- [x] Gather visual references
- [ ] Compare the layouts at narrow widths
- [ ] Write up the decision

The [design brief](https://example.com/brief) has the original goals.`

export const NOTE_FORMATTING_MARKDOWN = `# Markdown examples

Use **bold**, *emphasis*, and \`inline code\` where they help scanning.

> A short quote gives the page a different rhythm.

| Surface | Purpose | Status |
| --- | --- | --- |
| Visual | Browse references | Ready |
| Focus | Read one note | In progress |

The area of a circle is $A = \\pi r^2$.

\`\`\`ts
const nextStep = 'Review the notes'
\`\`\``

export const SAMPLE_NOTE: NoteItemDto = {
  schemaVersion: 2,
  id: 'storybook-note',
  type: 'note',
  title: 'Project notes',
  titleSource: 'derived',
  body: NOTE_MARKDOWN,
  createdAt: '2026-09-24T00:00:00.000Z',
  updatedAt: '2026-09-24T00:00:00.000Z',
  missingContent: false,
  attachments: [],
  location: { type: 'inbox' },
  relativePath: 'Project notes.md',
  referencedAttachment: false
}
