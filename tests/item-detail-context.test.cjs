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

test('detail modes share the compact toolbar and inline document flow', () => {
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
  const windowMaterialStyles = readFileSync(
    require.resolve('../src/renderer/src/assets/window-material.css'),
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
  const workspaceSource = readFileSync(
    require.resolve('../src/renderer/src/features/library/workspace.tsx'),
    'utf8'
  )
  const focusToolbarSource = detailSource.slice(
    detailSource.indexOf("if (presentation === 'focus')"),
    detailSource.indexOf('const leadingControls')
  )
  const focusSplitHandlerSource = workspaceSource.slice(
    workspaceSource.indexOf('const handleFocusSplitChange'),
    workspaceSource.indexOf('const changeFocusNoteExpanded')
  )

  assert.match(detailSource, /data-detail-utility-bar/)
  assert.match(focusToolbarSource, /data-detail-focus-header/)
  assert.match(focusToolbarSource, /relative z-40 flex h-10 shrink-0 items-center justify-between/)
  assert.match(focusToolbarSource, /data-detail-focus-title/)
  assert.match(
    focusToolbarSource,
    /absolute left-1\/2 max-w-\[min\(32rem,calc\(100%-28rem\)\)\] -translate-x-1\/2 truncate/
  )
  assert.match(focusToolbarSource, /max-\[1080px\]:hidden/)
  assert.match(focusToolbarSource, /Exit zen mode \(Ctrl\+Shift\+\\\\\)/)
  assert.match(focusToolbarSource, /Enter zen mode \(Ctrl\+Shift\+\\\\\)/)
  assert.match(focusToolbarSource, /aria-pressed=\{expanded\}/)
  assert.match(focusToolbarSource, /onClick=\{\(\) => onExpandedChange\(!expanded\)\}/)
  assert.match(
    focusToolbarSource,
    /!expanded && 'group-data-\[focus-single-pane=true\]\/focus-detail:hidden'/
  )
  assert.match(focusToolbarSource, /<ArrowsDiagonal/)
  assert.match(focusToolbarSource, /<ArrowsDiagonalMinimize/)
  assert.match(
    focusToolbarSource,
    /transition-\[opacity,scale,filter\].*cubic-bezier\(0\.2,0,0,1\).*motion-reduce:transition-none/
  )
  assert.doesNotMatch(focusToolbarSource, /data-detail-focus-identity|identityControls/)
  assert.match(focusToolbarSource, /data-detail-focus-actions/)
  assert.match(focusToolbarSource, /pointer-events-auto ml-auto flex/)
  assert.match(focusToolbarSource, /\{modeControls\}\s*\{actions\}/)
  assert.doesNotMatch(focusToolbarSource, /aria-label="Close item"/)
  assert.match(
    detailSource,
    /data-detail-pane[\s\S]*presentation === 'focus' && !expanded[\s\S]*aria-label="Close item"/
  )
  assert.match(focusToolbarSource, /!isMac && 'pr-\[8\.625rem\]'/)
  assert.doesNotMatch(focusToolbarSource, /Previous item|Next item/)
  assert.doesNotMatch(focusToolbarSource, /\[-webkit-app-region:drag\]/)
  assert.match(detailSource, /className="size-10 text-muted-foreground"/)
  assert.match(detailSource, /<span>{activeOption\.shortLabel}<\/span>/)
  assert.doesNotMatch(detailSource, /mode === 'live' && 'bg-muted text-foreground'/)
  assert.match(detailSource, /function NoteModeHud/)
  assert.match(detailSource, /role="status"/)
  assert.match(detailSource, /window\.setTimeout\(\(\) => setModeHudVisible\(false\), 900\)/)
  assert.match(detailSource, /<NoteModeHud mode={mode} visible={modeHudVisible} \/>/)
  assert.doesNotMatch(detailSource, /before:bg-primary\/35/)
  assert.match(detailSource, /<DropdownMenuRadioGroup/)
  assert.doesNotMatch(detailSource, /<DropdownMenuCheckboxItem/)
  assert.match(actionMenuSource, /<DropdownMenuCheckboxItem/)
  assert.doesNotMatch(detailSource, /CaptionTileButton/)
  assert.match(actionMenuSource, /triggerSurface\?: 'default' \| 'caption'/)
  assert.match(actionMenuSource, /!props\.hideOpenAction/)
  assert.match(workspaceSource, /triggerSurface="caption"[\s\S]*?hideOpenAction/)
  assert.match(actionMenuSource, /props\.triggerSurface === 'caption' \? 'ghost' : 'secondary'/)
  assert.doesNotMatch(actionMenuSource, /CaptionTileButton/)
  assert.match(focusWorkspaceSource, /data-focus-single-pane={!split}/)
  assert.match(focusWorkspaceSource, /expanded && 'hidden'/)
  assert.match(focusWorkspaceSource, /split && !expanded/)
  assert.match(focusWorkspaceSource, /data-focus-expanded={expanded}/)
  assert.doesNotMatch(
    windowMaterialStyles,
    /\.focus-detail-surface\[data-focus-expanded='true'\] \{[^}]*background-color:/
  )
  assert.match(
    windowMaterialStyles,
    /\.focus-detail-surface\[data-focus-expanded='true'\] \[data-detail-structural-surface\] \{[\s\S]*?border: 0;[\s\S]*?border-radius: 0;/
  )
  assert.match(windowMaterialStyles, /\[data-focus-caption-controls\][\s\S]*?opacity: 0\.35/)
  assert.match(windowMaterialStyles, /:is\(:hover, :focus-within\)[\s\S]*?opacity: 1/)
  assert.match(focusWorkspaceSource, /data-focus-caption-controls/)
  assert.match(focusWorkspaceSource, /WindowControls/)
  assert.match(detailSource, /data-detail-content-stack/)
  assert.match(detailSource, /flex-1 flex-col/)
  assert.match(detailSource, /relative flex min-h-0 min-w-0 flex-1/)
  assert.match(detailSource, /if \(nextExpanded\) setAttachmentsOpen\(false\)/)
  assert.match(
    detailSource,
    /event\.key === 'Escape' && expanded && !isEditingTarget[\s\S]*changeExpanded\(false\)/
  )
  assert.match(
    workspaceSource,
    /const \[focusNoteExpanded, setFocusNoteExpanded\] = useState\(\n\s*\(\) => initialSession\?\.focusNoteExpanded \?\? false\n\s*\)/
  )
  assert.match(workspaceSource, /focusItemSummary\?\.type === 'note'/)
  assert.match(workspaceSource, /open=\{!sidebarHidden && !focusNoteExpansionActive\}/)
  assert.match(workspaceSource, /setFocusNoteExpanded\(false\)/)
  assert.match(
    workspaceSource,
    /const \[focusWorkspaceOpen, setFocusWorkspaceOpen\] = useState\(\n\s*\(\) => initialSession !== null && initialSession\.focusItemId !== null\n\s*\)/
  )
  assert.match(workspaceSource, /Masonry overview/)
  assert.doesNotMatch(focusSplitHandlerSource, /setFocusNoteExpanded\(false\)/)
  assert.match(workspaceSource, /announceStatus\(expanded \? 'Zen mode on' : 'Zen mode off'\)/)
  assert.match(detailSource, /aria-keyshortcuts="Control\+Shift\+\\\\"/)
  assert.match(
    detailSource,
    /\[['"]Backslash['"], ['"]IntlBackslash['"]\]\.includes\(event\.code\)[\s\S]*changeExpanded\(!expanded\)/
  )
  assert.doesNotMatch(
    workspaceSource,
    /localStorage\.(?:getItem|setItem)\([^\n]*focus-note-expanded/
  )
  assert.match(detailSource, /<ButtonGroup/)
  assert.match(detailSource, /aria-pressed={mode === value}/)
  assert.match(detailSource, /window\.addEventListener\('keydown', handleNoteModeShortcut, true\)/)
  assert.match(
    detailSource,
    /window\.removeEventListener\('keydown', handleNoteModeShortcut, true\)/
  )
  assert.doesNotMatch(detailSource, /<header className="kuskus-detail-document-frame/)
  assert.doesNotMatch(detailSource, /NoteMetadataControls|NoteIdentityControls/)
  assert.match(detailSource, /function NoteDocumentBlocks/)
  assert.match(detailSource, /showInlineTitle/)
  assert.match(
    detailSource,
    /<MarkdownEditor[\s\S]*?header=\{[\s\S]*?showInlineTitle \? \([\s\S]*?<InlineItemTitle/
  )
  assert.match(
    editorSource,
    /Decoration\.widget\(\{ widget: new MarkdownHeaderWidget\(\), block: true/
  )
  assert.doesNotMatch(detailSource, /border-b border-border\/50 pt-10 pb-2/)
  assert.doesNotMatch(detailSource, /group-hover\/title:opacity-100/)
  assert.match(
    detailSource,
    /localStorage\.setItem\(NOTE_INLINE_TITLE_STORAGE_KEY, String\(showInlineTitle\)\)/
  )
  assert.match(detailSource, /data-reading-width={readingWidth}/)
  assert.equal((detailSource.match(/data-detail-pane/g) ?? []).length, 1)
  assert.match(
    detailSource,
    /data-detail-pane[\s\S]{0,240}window-canvas[\s\S]{0,240}rounded-tl-2xl/
  )
  assert.match(detailSource, /function DetailInspector/)
  assert.match(detailSource, /function FileCanvas/)
  assert.match(detailSource, /<article className="kuskus-detail-document-frame/)
  assert.match(actionMenuSource, /<DropdownMenuLabel>View<\/DropdownMenuLabel>/)
  assert.match(actionMenuSource, /Readable line length/)
  assert.match(actionMenuSource, /Inline title/)
  assert.match(actionMenuSource, /Manage attachments/)
  assert.match(actionMenuSource, /Note details/)
  assert.match(markdownStyles, /--detail-document-max-width: 48rem/)
  assert.match(markdownStyles, /max-width: var\(--detail-document-max-width\)/)
  assert.match(markdownStyles, /\[data-reading-width='wide'\] \.kuskus-detail-document-frame/)
  assert.match(markdownStyles, /--detail-document-max-width: none/)
  assert.match(editorSource, /maxWidth: 'var\(--detail-document-max-width\)'/)
  assert.doesNotMatch(detailSource, /pt-28/)
})
