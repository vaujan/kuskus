const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')

test('main workspace uses borderless navigation and quiet text-first empty states', () => {
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
  assert.match(workspace, /Create new note \(Ctrl \+ N\)/)
  assert.match(workspace, /Return to overview/)
  assert.match(workspace, /variant="link"/)
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
  assert.doesNotMatch(notify, /icon:/)
  assert.match(notify, /<Button className="ml-auto shrink-0" size="sm" variant="secondary"/)
  assert.doesNotMatch(notify, /action: \{ label:/)
  assert.match(devTools, /dev-notification-preview/)
  assert.match(preview, /kuskusDev/)
  assert.match(preview, /event\.altKey.*event\.shiftKey/)
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
  assert.match(actions, /'size-10 text-muted-foreground'/)
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

  assert.match(composer, /surface !== 'quick'.*\n\s*'scale-100 opacity-100 transition-/)
  assert.match(composer, /starting:scale-\[0\.98\] starting:opacity-0/)
  assert.doesNotMatch(composer, /animate-in fade-in zoom-in/)
  assert.doesNotMatch(composer, /ease-in['"]/)
})
