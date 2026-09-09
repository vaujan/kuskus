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

  assert.doesNotMatch(sidebar, /group-data-\[side=left\]:border-r/)
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
