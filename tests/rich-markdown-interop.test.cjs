const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const { NoteAutosaveCoordinator } = require('../src/renderer/src/features/items/note-autosave.ts')
const { createMarkdownDiffRows } = require('../src/renderer/src/features/items/markdown-diff.ts')
const {
  decodeMarkdownLinkTarget,
  setMarkdownTaskChecked,
  toggleMarkdownMarker
} = require('../src/renderer/src/features/items/markdown-formatting.ts')
const {
  getScrollRatio,
  getScrollTopForRatio,
  hasMeaningfulScrollDelta
} = require('../src/renderer/src/features/items/markdown-scroll.ts')
const {
  getSplitToggleMode,
  toggleReadLive,
  toggleSourceMode
} = require('../src/renderer/src/features/items/note-view-mode.ts')
const {
  getPublishedMarkdownChange
} = require('../src/renderer/src/features/items/markdown-editor-change.ts')
const {
  prepareObsidianMarkdown
} = require('../src/renderer/src/features/items/obsidian-markdown.ts')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function noteDto(body, updatedAt = '2026-07-21T00:00:00.000Z') {
  return {
    schemaVersion: 1,
    id: '90000000-0000-4000-8000-000000000001',
    type: 'note',
    title: body.split('\n')[0].replace(/^#+\s*/, ''),
    body,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt,
    missingContent: false,
    attachments: []
  }
}

test('keeps blank edits pending and produces a side-by-side Markdown diff', () => {
  const coordinator = new NoteAutosaveCoordinator({
    itemId: noteDto('Initial').id,
    initialMarkdown: 'Initial',
    save: async (input) => ({ ok: true, data: noteDto(input.markdown) }),
    onSaved: () => undefined,
    onDraftReplaced: () => undefined
  })
  coordinator.updateDraft('   ')
  assert.equal(coordinator.getSnapshot().status, 'dirty')
  assert.equal(coordinator.getSnapshot().error, null)
  coordinator.dispose()

  const rows = createMarkdownDiffRows('Same\nMy line\nSame end', 'Same\nDisk line\nSame end')
  assert.equal(rows[0].kind, 'same')
  assert.equal(rows[1].kind, 'changed')
  assert.equal(rows[1].localText, 'My line')
  assert.equal(rows[1].diskText, 'Disk line')
  assert.equal(rows[2].kind, 'same')
})

test('safely decodes Markdown vault-link targets', () => {
  assert.equal(decodeMarkdownLinkTarget('Folder%2FNote'), 'Folder/Note')
  assert.equal(decodeMarkdownLinkTarget('broken%link'), null)
})

test('toggles the selected Markdown task without changing sibling tasks', () => {
  const markdown = '- [ ] First\n  - [x] Nested\n1. [ ] Ordered'
  assert.equal(
    setMarkdownTaskChecked(markdown, 1, false),
    '- [ ] First\n  - [ ] Nested\n1. [ ] Ordered'
  )
  assert.equal(
    setMarkdownTaskChecked(markdown, 2, true),
    '- [ ] First\n  - [x] Nested\n1. [x] Ordered'
  )
})

test('toggles Markdown emphasis markers while preserving the intended selection', () => {
  assert.deepEqual(toggleMarkdownMarker('Hello world', 6, 11, '**'), {
    value: 'Hello **world**',
    selectionStart: 8,
    selectionEnd: 13
  })
  assert.deepEqual(toggleMarkdownMarker('Hello **world**', 8, 13, '**'), {
    value: 'Hello world',
    selectionStart: 6,
    selectionEnd: 11
  })
  assert.deepEqual(toggleMarkdownMarker('Hello **world**', 6, 15, '**'), {
    value: 'Hello world',
    selectionStart: 6,
    selectionEnd: 11
  })
  assert.deepEqual(toggleMarkdownMarker('Hello ', 6, 6, '*'), {
    value: 'Hello **',
    selectionStart: 7,
    selectionEnd: 7
  })
  assert.deepEqual(toggleMarkdownMarker('**word**', 2, 6, '*'), {
    value: '***word***',
    selectionStart: 3,
    selectionEnd: 7
  })
  assert.deepEqual(toggleMarkdownMarker('***word***', 3, 7, '*'), {
    value: '**word**',
    selectionStart: 2,
    selectionEnd: 6
  })
})

test('uses predictable note-mode keyboard transitions', () => {
  assert.equal(toggleReadLive('read'), 'live')
  assert.equal(toggleReadLive('live'), 'read')
  assert.equal(toggleReadLive('markdown'), 'read')
  assert.equal(toggleReadLive('split'), 'read')
  assert.equal(toggleSourceMode('read'), 'markdown')
  assert.equal(toggleSourceMode('live'), 'markdown')
  assert.equal(toggleSourceMode('markdown'), 'live')
  assert.equal(getSplitToggleMode('read', 'read'), 'split')
  assert.equal(getSplitToggleMode('live', 'live'), 'split')
  assert.equal(getSplitToggleMode('split', 'live'), 'live')
  assert.equal(getSplitToggleMode('markdown', 'markdown'), 'split')
  assert.equal(getSplitToggleMode('split', 'markdown'), 'markdown')
})

test('normalizes legacy HTML breaks for the Read renderer', () => {
  assert.equal(
    prepareObsidianMarkdown('line<br/>next\n`literal <br/>`', []),
    'line  \nnext\n`literal <br/>`'
  )
})

test('publishes every CodeMirror document change, including empty Markdown', () => {
  assert.equal(getPublishedMarkdownChange(true, '# Updated'), '# Updated')
  assert.equal(getPublishedMarkdownChange(true, ''), '')
  assert.equal(getPublishedMarkdownChange(false, '# Unchanged'), null)
})

test('maps linked Markdown scrolling proportionally and handles non-overflowing panes', () => {
  assert.equal(getScrollRatio(300, 1000, 400), 0.5)
  assert.equal(getScrollTopForRatio(0.5, 1600, 600), 500)
  assert.equal(getScrollRatio(100, 300, 400), 0)
  assert.equal(getScrollTopForRatio(0.75, 300, 400), 0)
  assert.equal(getScrollRatio(-20, 1000, 400), 0)
  assert.equal(getScrollTopForRatio(2, 1000, 400), 600)
  assert.equal(hasMeaningfulScrollDelta(100, 100.5), false)
  assert.equal(hasMeaningfulScrollDelta(100, 101), true)
})
