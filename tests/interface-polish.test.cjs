const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')

test('main workspace uses borderless navigation and illustrated empty states', () => {
  const sidebar = readFileSync(
    require.resolve('../src/renderer/src/features/shell/app-sidebar.tsx'),
    'utf8'
  )
  const workspace = readFileSync(
    require.resolve('../src/renderer/src/features/library/workspace.tsx'),
    'utf8'
  )
  const librarySidebar = readFileSync(
    require.resolve('../src/renderer/src/features/shell/library-sidebar.tsx'),
    'utf8'
  )
  const focusList = readFileSync(
    require.resolve('../src/renderer/src/features/items/focus-item-list.tsx'),
    'utf8'
  )
  const loading = readFileSync(
    require.resolve('../src/renderer/src/app/loading-screen.tsx'),
    'utf8'
  )

  assert.doesNotMatch(sidebar, /group-data-\[side=left\]:border-r/)
  assert.match(sidebar, /peer-data-active\/menu-button:text-sidebar-selection-foreground/)
  assert.match(sidebar, /data-active:hover:bg-sidebar-selection/)
  assert.match(librarySidebar, /bg-sidebar-selection font-medium/)
  assert.doesNotMatch(sidebar, /sidebar-backdrop[\s\S]{0,180}backdrop-blur/)
  assert.doesNotMatch(sidebar, /0_0_0_1px_color-mix\(in_oklch,var\(--sidebar-border\)/)
  assert.match(sidebar, /sidebar-backdrop[\s\S]{0,180}bg-transparent/)
  assert.match(librarySidebar, /isFloating \? 'floating' : 'sidebar'/)
  assert.match(librarySidebar, /<AppSidebar variant={sidebarVariant}>/)
  assert.doesNotMatch(librarySidebar, /<AppSidebar variant="inset">/)
  assert.doesNotMatch(workspace, /<EmptyMedia/)
  assert.match(workspace, /src=\{bubuntuLine\}/)
  assert.match(workspace, /src=\{bubuntuLine\}[\s\S]{0,100}draggable=\{false\}/)
  assert.doesNotMatch(workspace, /No item selected/)
  assert.doesNotMatch(workspace, /Choose an item from the list/)
  assert.match(loading, /src=\{bubuntuLine\}/)
  assert.match(loading, /src=\{bubuntuLine\}[\s\S]{0,100}draggable=\{false\}/)
  assert.match(loading, /role="progressbar"/)
  assert.doesNotMatch(loading, /<Spinner|Opening Kuskus…/)
  assert.match(workspace, /Create new note <Kbd>Ctrl\+N<\/Kbd>/)
  assert.match(workspace, /Return to overview/)
  assert.match(workspace, /Return to overview <Kbd>Esc<\/Kbd>/)
  assert.match(workspace, /Add item <Kbd>Ctrl\+Shift\+N<\/Kbd>/)
  assert.match(
    workspace,
    /<Button aria-keyshortcuts="Control\+N"[\s\S]{0,160}Create new note <Kbd>Ctrl\+N<\/Kbd>/
  )
  assert.match(workspace, /variant="tonal"[\s\S]{0,180}Add item <Kbd>Ctrl\+Shift\+N<\/Kbd>/)
  assert.match(workspace, /max-w-none flex-row flex-wrap justify-center gap-2/)
  assert.match(workspace, /variant="tonal"/)
  assert.match(workspace, /variant="ghost"/)
  assert.match(workspace, /emptyDestinationCopy\(destination\)/)
  assert.match(workspace, /emptyMessage=[\s\S]{0,500}emptyDestination\.title/)
  assert.match(workspace, /emptyDescription=[\s\S]{0,600}emptyDestination\.description/)
  assert.match(
    focusList,
    /emptyAction \? <EmptyContent className="gap-2">\{emptyAction\}<\/EmptyContent> : null/
  )
  assert.match(
    workspace,
    /event\.key !== 'Escape'[\s\S]{0,180}focusItemId !== null[\s\S]{0,240}returnToMasonry\(\)/
  )
})

test('overview toolbar separates retrieval from primary and tonal creation', () => {
  const button = readFileSync(
    require.resolve('../src/renderer/src/components/ui/button.tsx'),
    'utf8'
  )
  const toolbar = readFileSync(
    require.resolve('../src/renderer/src/features/shell/app-toolbar.tsx'),
    'utf8'
  )
  const workspace = readFileSync(
    require.resolve('../src/renderer/src/features/library/workspace.tsx'),
    'utf8'
  )
  const quickOpen = readFileSync(
    require.resolve('../src/renderer/src/features/search/quick-open-dialog.tsx'),
    'utf8'
  )

  assert.match(toolbar, /className="h-8 flex-1 rounded-4xl"/)
  assert.match(toolbar, /grid-cols-\[auto_minmax\(10rem,1fr\)_auto\]/)
  assert.match(
    toolbar,
    /@min-\[48rem\]\/toolbar:grid-cols-\[minmax\(0,1fr\)_minmax\(10rem,28rem\)_minmax\(0,1fr\)\]/
  )
  assert.equal((toolbar.match(/@min-\[48rem\]\/toolbar:inline/g) ?? []).length, 2)
  assert.doesNotMatch(toolbar, /@min-\[76rem\]\/toolbar:inline/)
  assert.match(toolbar, /size=\{filterCount > 0 \? 'sm' : 'icon-sm'\}[\s\S]{0,220}Sort and filter/)
  assert.match(toolbar, /size="sm"[\s\S]{0,160}Create new note/)
  assert.match(button, /tonal: 'bg-primary\/15 text-primary hover:bg-primary\/20/)
  assert.match(toolbar, /variant="tonal"[\s\S]{0,220}data-new-item-button/)
  assert.match(toolbar, /aria-keyshortcuts="Control\+Shift\+N"/)
  assert.match(workspace, /if \(event\.shiftKey\) openComposer\(\)/)
  assert.match(workspace, /target\.closest\([\s\S]{0,180}\[role="textbox"\]/)
  assert.match(quickOpen, /<CommandShortcut>Ctrl\+N<\/CommandShortcut>/)
  assert.match(quickOpen, /<CommandShortcut>Ctrl\+Shift\+N<\/CommandShortcut>/)
})

test('focus item type badges use the compact semantic variants', () => {
  const badge = readFileSync(require.resolve('../src/renderer/src/components/ui/badge.tsx'), 'utf8')
  const row = readFileSync(
    require.resolve('../src/renderer/src/features/items/focus-index-row.tsx'),
    'utf8'
  )

  assert.match(badge, /sm: 'h-4 gap-0\.5 px-1\.5 pt-px pb-0/)
  for (const variant of ['note', 'linkType', 'image', 'file']) {
    assert.match(badge, new RegExp(`${variant}:`))
  }
  assert.match(row, /size="sm" variant=\{itemTypeBadgeVariant\(item\)\}/)
  assert.match(row, /relativeAddedTime\(item\.createdAt\)/)
  assert.match(row, /dateTime=\{item\.createdAt\}/)
  assert.doesNotMatch(row, /relativeUpdatedTime|dateTime=\{item\.updatedAt\}/)
})

test('notifications are iconless and expose dev-only visual previews', () => {
  const toaster = readFileSync(
    require.resolve('../src/renderer/src/features/shell/app-toaster.tsx'),
    'utf8'
  )
  const notify = readFileSync(require.resolve('../src/renderer/src/lib/notify.tsx'), 'utf8')
  const devTools = readFileSync(require.resolve('../src/renderer/src/dev-tools.ts'), 'utf8')
  const preview = readFileSync(
    require.resolve('../src/renderer/src/dev-notification-preview.tsx'),
    'utf8'
  )

  assert.match(toaster, /success: null/)
  assert.match(toaster, /loading: null/)
  assert.match(toaster, /fontFamily: 'var\(--font-ui\)'/)
  assert.doesNotMatch(notify, /icon:/)
  assert.match(notify, /<Button className="ml-auto shrink-0" size="sm" variant="secondary"/)
  assert.doesNotMatch(notify, /action: \{ label:/)
  assert.match(devTools, /dev-notification-preview/)
  assert.match(preview, /kuskusDev/)
  assert.match(preview, /event\.altKey.*event\.shiftKey/)
})

test('focus rail keeps compact ghost and secondary actions', () => {
  const header = readFileSync(
    require.resolve('../src/renderer/src/features/items/focus-list-header.tsx'),
    'utf8'
  )
  const sidebarTrigger = readFileSync(
    require.resolve('../src/renderer/src/features/shell/shell-sidebar-trigger.tsx'),
    'utf8'
  )

  assert.equal((header.match(/size="icon-sm"/g) ?? []).length, 4)
  assert.match(sidebarTrigger, /SidebarTrigger size="icon-sm"/)
  assert.match(header, /absolute top-1 right-1 size-1 rounded-full/)
  assert.doesNotMatch(header, /<Badge/)
  assert.doesNotMatch(header, /tonal|data-lifted/)
  assert.match(header, /variant=\{retrievalActive \? 'secondary' : 'ghost'\}/)
  assert.match(header, /size="icon-sm"\s+variant="ghost"[\s\S]{0,160}Create new note/)
  assert.match(
    header,
    /size="icon-sm"\s+variant=\{composerOpen \|\| hasDraft \? 'secondary' : 'ghost'\}[\s\S]{0,160}data-new-item-button/
  )
})

test('detail toolbar icon buttons share the quieter foreground treatment', () => {
  const styles = readFileSync(require.resolve('../src/renderer/src/assets/main.css'), 'utf8')
  const sidebar = readFileSync(
    require.resolve('../src/renderer/src/features/shell/app-sidebar.tsx'),
    'utf8'
  )
  const detail = readFileSync(
    require.resolve('../src/renderer/src/features/items/item-detail-dialog.tsx'),
    'utf8'
  )
  const actions = readFileSync(
    require.resolve('../src/renderer/src/features/items/item-action-menu.tsx'),
    'utf8'
  )

  assert.match(sidebar, /cn\('text-muted-foreground', className\)/)
  assert.match(detail, /aria-label="Back to items"/)
  assert.match(detail, /<ChevronLeft aria-hidden="true"/)
  assert.doesNotMatch(detail, /<ChevronLeft data-icon="inline-start"/)
  assert.match(actions, /size=\{props\.triggerSurface === 'caption' \? 'icon-sm' : 'icon'\}/)
  assert.match(actions, /\? 'text-muted-foreground'/)
  assert.match(styles, /--icon-stroke-width: 1\.25/)
  assert.match(styles, /\.tabler-icon \{\s*stroke-width: var\(--icon-stroke-width\)/)
  assert.doesNotMatch(`${sidebar}\n${detail}\n${actions}`, /stroke=\{/)
})

test('shared controls transition only the properties they change', () => {
  const controls = ['button', 'tabs', 'switch'].map((name) =>
    readFileSync(require.resolve(`../src/renderer/src/components/ui/${name}.tsx`), 'utf8')
  )

  for (const control of controls) assert.doesNotMatch(control, /transition-all/)
})

test('editable note scrollers never expose app-level horizontal overflow', () => {
  const editors = ['markdown-editor.tsx', 'live/live-markdown-editor.tsx'].map((file) =>
    readFileSync(require.resolve(`../src/renderer/src/features/items/${file}`), 'utf8')
  )

  for (const editor of editors) {
    assert.match(editor, /'\.cm-scroller': \{[\s\S]{0,120}overflowX: 'hidden'/)
  }
})

test('rail and masonry note previews clip wide code without a horizontal scrollbar', () => {
  const markdown = readFileSync(require.resolve('../src/renderer/src/assets/markdown.css'), 'utf8')

  assert.match(markdown, /\.kuskus-note-card-markdown pre \{\s*overflow-x: hidden;/)
})

test('note image clicks stay in-app and Vim carets use the primary color', () => {
  const preview = readFileSync(
    require.resolve('../src/renderer/src/features/items/markdown-preview.tsx'),
    'utf8'
  )
  const editors = ['markdown-editor.tsx', 'live/live-markdown-editor.tsx'].map((file) =>
    readFileSync(require.resolve(`../src/renderer/src/features/items/${file}`), 'utf8')
  )

  assert.match(preview, /onClick=\{\(event\) => \{\s*event\.preventDefault\(\)/)
  for (const editor of editors) {
    assert.match(
      editor,
      /'\.cm-vimMode \.cm-fat-cursor'[\s\S]{0,100}background: 'var\(--primary\)'/
    )
    assert.match(editor, /outlineColor: 'var\(--primary\)'/)
  }
})

test('sidebar visibility is animated without compromising resize or keyboard focus response', () => {
  const sidebar = readFileSync(
    require.resolve('../src/renderer/src/features/shell/app-sidebar.tsx'),
    'utf8'
  )
  const motion = readFileSync(require.resolve('../src/renderer/src/assets/motion.css'), 'utf8')
  const focusList = readFileSync(
    require.resolve('../src/renderer/src/features/items/focus-item-list.tsx'),
    'utf8'
  )
  const focusRow = readFileSync(
    require.resolve('../src/renderer/src/features/items/focus-index-row.tsx'),
    'utf8'
  )

  assert.match(sidebar, /sidebar-motion-gap/)
  assert.match(sidebar, /sidebar-motion-container/)
  assert.match(sidebar, /data-hidden={hidden}/)
  assert.match(sidebar, /SIDEBAR_FLOATING_QUERY = SIDEBAR_NARROW_QUERY/)
  assert.match(sidebar, /\(hidden \|\| isFloating\) && 'w-0'/)
  assert.match(sidebar, /data-overlay={isFloating}/)
  assert.match(sidebar, /group-data-\[variant=floating\]:shadow-/)
  assert.match(motion, /\.sidebar-motion-gap \{[\s\S]*?--motion-ease-drawer/)
  assert.match(motion, /data-overlay='true'[\s\S]*?opacity[\s\S]*?transform/)
  assert.match(
    motion,
    /data-overlay='true'\]\[data-hidden='true'\]\[data-side='left'\][\s\S]*?translateX\(-12px\)/
  )
  assert.match(motion, /data-resizing='true'[\s\S]*?transition: none/)
  assert.match(sidebar, /scheduleWidth\(drag\.startWidth/)
  assert.doesNotMatch(focusList, /behavior: reduceMotion \? 'auto' : 'smooth'/)
  assert.doesNotMatch(`${focusList}\n${focusRow}`, /transition-\[background-color,opacity/)
})

test('capture uses interruptible transitions and keeps Quick Capture static', () => {
  const composer = readFileSync(
    require.resolve('../src/renderer/src/features/capture/add-item-composer.tsx'),
    'utf8'
  )
  const workspace = readFileSync(
    require.resolve('../src/renderer/src/features/library/workspace.tsx'),
    'utf8'
  )

  assert.match(composer, /surface !== 'quick'.*\n\s*'scale-100 opacity-100 transition-/)
  assert.match(composer, /starting:scale-\[0\.98\] starting:opacity-0/)
  assert.doesNotMatch(composer, /animate-in fade-in zoom-in/)
  assert.doesNotMatch(composer, /ease-in['"]/)
  assert.match(workspace, /!composerOpen && !showExternalDropShadow && 'hidden'/)
})
