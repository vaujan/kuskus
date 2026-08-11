const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
const ts = require('typescript')

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true
    },
    fileName: filename
  })
  module._compile(output.outputText, filename)
}

const {
  formatItemUpdatedAt,
  resolveItemDetailContext,
  resolveItemLocationPath
} = require('../src/renderer/src/features/items/item-detail-context.ts')
const {
  NOTE_READING_WIDTH_STORAGE_KEY,
  parseNoteReadingWidth,
  toggleNoteReadingWidth
} = require('../src/renderer/src/features/items/note-reading-width.ts')

const collections = [
  {
    schemaVersion: 2,
    id: 'projects',
    name: 'Projects',
    icon: 'folder',
    createdAt: '2026-08-01T00:00:00.000Z',
    relativePath: 'Projects',
    parentId: null
  },
  {
    schemaVersion: 2,
    id: 'saver',
    name: 'Saver',
    icon: 'folder',
    createdAt: '2026-08-01T00:00:00.000Z',
    relativePath: 'Projects/Saver',
    parentId: 'projects'
  }
]

test('resolves active detail locations and nested collection paths', () => {
  assert.deepEqual(resolveItemLocationPath({ type: 'inbox' }, collections), ['Inbox'])
  assert.deepEqual(
    resolveItemLocationPath({ type: 'collection', collectionId: 'saver' }, collections),
    ['Projects', 'Saver']
  )
})

test('uses stable labels for Archive, Trash, and unavailable folders', () => {
  assert.deepEqual(
    resolveItemLocationPath({ type: 'archive', originalCollectionId: 'saver' }, collections),
    ['Archive']
  )
  assert.deepEqual(
    resolveItemLocationPath(
      { type: 'trash', trashedFrom: 'collection', originalCollectionId: 'saver' },
      collections
    ),
    ['Trash']
  )
  assert.deepEqual(
    resolveItemLocationPath({ type: 'collection', collectionId: 'missing' }, collections),
    ['Folder unavailable']
  )
})

test('formats the localized updated timestamp and preserves invalid input', () => {
  assert.equal(formatItemUpdatedAt('2026-08-10T04:30:00', 'en-US'), 'Aug 10, 2026, 4:30 AM')
  assert.equal(formatItemUpdatedAt('not-a-date', 'en-US'), 'not-a-date')
  assert.deepEqual(
    resolveItemDetailContext(
      { type: 'collection', collectionId: 'saver' },
      '2026-08-10T04:30:00',
      collections,
      'en-US'
    ),
    {
      locationPath: ['Projects', 'Saver'],
      updatedLabel: 'Aug 10, 2026, 4:30 AM'
    }
  )
})

test('reading width defaults safely and toggles between comfortable and wide', () => {
  assert.equal(NOTE_READING_WIDTH_STORAGE_KEY, 'kuskus-note-reading-width')
  assert.equal(parseNoteReadingWidth(null), 'comfortable')
  assert.equal(parseNoteReadingWidth('comfortable'), 'comfortable')
  assert.equal(parseNoteReadingWidth('invalid'), 'comfortable')
  assert.equal(parseNoteReadingWidth('wide'), 'wide')
  assert.equal(toggleNoteReadingWidth('comfortable'), 'wide')
  assert.equal(toggleNoteReadingWidth('wide'), 'comfortable')
})

test('detail modes share the compact toolbar and configurable document frame', () => {
  const detailSource = readFileSync(
    require.resolve('../src/renderer/src/features/items/item-detail-dialog.tsx'),
    'utf8'
  )
  const editorSource = readFileSync(
    require.resolve('../src/renderer/src/features/items/markdown-editor.tsx'),
    'utf8'
  )
  const markdownStyles = readFileSync(
    require.resolve('../src/renderer/src/assets/markdown.css'),
    'utf8'
  )
  const actionMenuSource = readFileSync(
    require.resolve('../src/renderer/src/features/items/item-action-menu.tsx'),
    'utf8'
  )
  const focusWorkspaceSource = readFileSync(
    require.resolve('../src/renderer/src/features/library/focus-workspace.tsx'),
    'utf8'
  )
  const focusToolbarSource = detailSource.slice(
    detailSource.indexOf("if (presentation === 'focus')"),
    detailSource.indexOf('const leadingControls')
  )

  assert.match(detailSource, /data-detail-utility-bar/)
  assert.match(focusToolbarSource, /data-detail-focus-header/)
  assert.match(focusToolbarSource, /grid h-10 shrink-0 grid-cols-/)
  assert.doesNotMatch(focusToolbarSource, /data-detail-focus-identity|identityControls/)
  assert.match(focusToolbarSource, /data-detail-focus-actions/)
  assert.match(focusToolbarSource, /!isMac && 'pr-\[8\.625rem\]'/)
  assert.doesNotMatch(focusToolbarSource, /Previous item|Next item/)
  assert.doesNotMatch(focusToolbarSource, /\[-webkit-app-region:drag\]/)
  assert.match(detailSource, /surface === 'caption' \? 'h-10 rounded-2xl'/)
  assert.doesNotMatch(detailSource, /CaptionTileButton/)
  assert.match(actionMenuSource, /triggerSurface\?: 'default' \| 'caption'/)
  assert.match(actionMenuSource, /props\.triggerSurface === 'caption' \? 'ghost' : 'secondary'/)
  assert.doesNotMatch(actionMenuSource, /CaptionTileButton/)
  assert.match(focusWorkspaceSource, /data-focus-single-pane={!split}/)
  assert.match(focusWorkspaceSource, /aria-label="Back to items"/)
  assert.match(
    focusWorkspaceSource,
    /pointer-events-auto absolute top-0 right-0 z-50 h-10 \[-webkit-app-region:no-drag\]/
  )
  assert.match(focusWorkspaceSource, /inset-x-0 top-0 z-30 h-10 \[-webkit-app-region:drag\]/)
  assert.match(detailSource, /data-detail-content-stack/)
  assert.match(detailSource, /flex-1 flex-col/)
  assert.match(detailSource, /<ButtonGroup/)
  assert.match(detailSource, /aria-pressed={mode === value}/)
  assert.match(detailSource, /<header className="kuskus-detail-document-frame/)
  assert.match(detailSource, /label="Wide reading width"/)
  assert.match(detailSource, /pressed={readingWidth === 'wide'}/)
  assert.match(
    detailSource,
    /localStorage\.setItem\(NOTE_READING_WIDTH_STORAGE_KEY, readingWidth\)/
  )
  assert.match(detailSource, /data-reading-width={readingWidth}/)
  assert.match(detailSource, /<ViewportWide aria-hidden="true" \/>/)
  assert.match(detailSource, /function NoteMetadataControls/)
  assert.match(detailSource, /function NoteIdentityControls/)
  assert.match(
    detailSource,
    /kuskus-detail-document-frame flex shrink-0 flex-col border-b border-border\/40 py-5/
  )
  assert.doesNotMatch(detailSource, /identityControls=|showIdentityHeader/)
  assert.match(detailSource, /h-10 w-fit shrink-0 gap-1 px-2/)
  assert.match(detailSource, /w-max min-w-44 max-w-72/)
  assert.match(detailSource, /w-max min-w-52 max-w-72/)
  assert.match(detailSource, /aria-label={`Move note from \${locationLabel}`}/)
  assert.match(detailSource, /<PopoverTitle className="text-sm">Note details<\/PopoverTitle>/)
  assert.match(detailSource, /<FolderDropdownDestinationItems/)
  assert.match(detailSource, /Manage attachments\.\.\./)
  assert.doesNotMatch(
    detailSource,
    /<DropdownMenuLabel[^>]*>[\s\S]*?<\/DropdownMenuLabel>\s*<DropdownMenuGroup>/
  )
  assert.doesNotMatch(detailSource, /attachmentControl/)
  assert.match(detailSource, /<article className="kuskus-detail-document-frame/)
  assert.match(detailSource, /mode === 'split' && 'hidden @min-\[860px\]\/detail:flex'/)
  assert.match(markdownStyles, /--detail-document-max-width: 48rem/)
  assert.match(markdownStyles, /max-width: var\(--detail-document-max-width\)/)
  assert.match(markdownStyles, /\[data-reading-width='wide'\] \.kuskus-detail-document-frame/)
  assert.match(markdownStyles, /--detail-document-max-width: none/)
  assert.match(editorSource, /maxWidth: 'var\(--detail-document-max-width\)'/)
  assert.doesNotMatch(detailSource, /pt-28/)
})
