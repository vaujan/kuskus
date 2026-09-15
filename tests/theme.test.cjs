const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const {
  applyTheme,
  createFontStack,
  createLocalFontPreference,
  getFontPreferenceLabel,
  resolveAppliedTheme,
  resolveColorMode,
  resolveColorTheme,
  resolveFontPreference
} = require('../src/renderer/src/hooks/theme.ts')
test('resolves color modes and rejects stale values', () => {
  assert.equal(resolveColorMode('light'), 'light')
  assert.equal(resolveColorMode('dark'), 'dark')
  assert.equal(resolveColorMode('system'), 'system')
  assert.equal(resolveColorMode('solarized-light'), 'dark')
  assert.equal(resolveColorMode(null), 'dark')
})

test('resolves curated color themes and rejects stale values', () => {
  assert.equal(resolveColorTheme('kuskus'), 'kuskus')
  assert.equal(resolveColorTheme('graphite'), 'graphite')
  assert.equal(resolveColorTheme('moss'), 'moss')
  assert.equal(resolveColorTheme('clay'), 'clay')
  assert.equal(resolveColorTheme('solarized'), 'solarized')
  assert.equal(resolveColorTheme('catppuccin'), 'catppuccin')
  assert.equal(resolveColorTheme('tokyo-storm'), 'tokyo-storm')
  assert.equal(resolveColorTheme('monokai'), 'monokai')
  assert.equal(resolveColorTheme('one'), 'one')
  assert.equal(resolveColorTheme('one-pro-flat'), 'one-pro-flat')
  assert.equal(resolveColorTheme('one-pro-darker'), 'one-pro-darker')
  assert.equal(resolveColorTheme('dracula'), 'dracula')
  assert.equal(resolveColorTheme('gruvbox'), 'gruvbox')
  assert.equal(resolveColorTheme('nord'), 'nord')
  assert.equal(resolveColorTheme('custom'), 'kuskus')
  assert.equal(resolveColorTheme(null), 'kuskus')
})

test('resolves bundled and local font preferences safely', () => {
  assert.equal(resolveFontPreference('inter', 'system-ui'), 'inter')
  assert.equal(resolveFontPreference('system-mono', 'inter'), 'system-mono')
  assert.equal(resolveFontPreference('local:Iosevka', 'inter'), 'local:Iosevka')
  assert.equal(resolveFontPreference('none', 'inter'), 'inter')
  assert.equal(resolveFontPreference('none', 'inter', true), 'none')
  assert.equal(resolveFontPreference('local:', 'inter'), 'inter')
  assert.equal(resolveFontPreference(null, 'inter'), 'inter')
})

test('creates labeled local font preferences and safe fallback stacks', () => {
  assert.equal(createLocalFontPreference('  Iosevka  '), 'local:Iosevka')
  assert.equal(getFontPreferenceLabel('local:Iosevka'), 'Iosevka')
  assert.equal(
    createFontStack('inter', 'system-ui', 'sans-serif'),
    "'Inter Variable', system-ui, sans-serif"
  )
  assert.equal(
    createFontStack('local:Font "Name', 'none', 'monospace'),
    '"Font \\"Name", monospace'
  )
})

test('resolves the applied theme from stored preference and system preference', () => {
  // resolveAppliedTheme reads window.matchMedia; stub it for the test.
  const originalMatchMedia = global.window?.matchMedia
  global.window = { matchMedia: () => ({ matches: true }) }
  try {
    assert.equal(resolveAppliedTheme('dark'), 'dark')
    assert.equal(resolveAppliedTheme('light'), 'light')
    assert.equal(resolveAppliedTheme('system'), 'dark')
  } finally {
    if (originalMatchMedia) global.window = { matchMedia: originalMatchMedia }
    else delete global.window
  }
})

test('applies light and dark color modes', () => {
  const classes = new Set()
  const properties = new Map()
  const root = {
    classList: {
      toggle: (name, enabled) => (enabled ? classes.add(name) : classes.delete(name))
    },
    dataset: {},
    style: {
      setProperty: (name, value) => properties.set(name, value)
    }
  }

  applyTheme(
    'dark',
    'moss',
    {
      uiFont: 'plex',
      uiFontFallback: 'system-ui',
      codeFont: 'local:Iosevka',
      codeFontFallback: 'system-mono'
    },
    root
  )
  assert.deepEqual([...classes], ['dark'])
  assert.equal(root.style.colorScheme, 'dark')
  assert.equal(root.dataset.colorTheme, 'moss')
  assert.equal(properties.get('--font-ui'), "'IBM Plex Sans Variable', system-ui, sans-serif")
  assert.equal(properties.get('--font-code'), '"Iosevka", ui-monospace, monospace')

  applyTheme(
    'light',
    'graphite',
    {
      uiFont: 'system-ui',
      uiFontFallback: 'none',
      codeFont: 'system-mono',
      codeFontFallback: 'none'
    },
    root
  )
  assert.deepEqual([...classes], [])
  assert.equal(root.style.colorScheme, 'light')
  assert.equal(root.dataset.colorTheme, 'graphite')
  assert.equal(properties.get('--font-ui'), 'system-ui, sans-serif')
  assert.equal(properties.get('--font-code'), 'ui-monospace, monospace')
})

test('defines light and dark palettes for every iconic theme', () => {
  const css = readFileSync(require.resolve('../src/renderer/src/assets/main.css'), 'utf8')

  for (const theme of [
    'solarized',
    'catppuccin',
    'tokyo-storm',
    'monokai',
    'one',
    'one-pro-flat',
    'one-pro-darker',
    'dracula',
    'gruvbox',
    'nord'
  ]) {
    assert.match(css, new RegExp(`:root\\[data-color-theme='${theme}'\\]`))
    assert.match(css, new RegExp(`:root\\.dark\\[data-color-theme='${theme}'\\]`))
  }
})

test('menu surfaces inherit the active color mode and palette', () => {
  const config = JSON.parse(readFileSync(require.resolve('../components.json'), 'utf8'))
  const surfaces = [
    '../src/renderer/src/components/ui/dropdown-menu.tsx',
    '../src/renderer/src/components/ui/context-menu.tsx',
    '../src/renderer/src/components/ui/select.tsx'
  ]

  assert.equal(config.menuColor, 'default-translucent')
  for (const surface of surfaces) {
    const source = readFileSync(require.resolve(surface), 'utf8')
    assert.doesNotMatch(source, /['"]dark(?:\s|['"])/)
    assert.doesNotMatch(source, /focus:text-accent-foreground/)
    assert.doesNotMatch(source, /data-\[variant=destructive\]:text-destructive/)
  }
})

test('settings keeps contextual view controls on the surfaces they affect', () => {
  const panel = readFileSync(
    require.resolve('../src/renderer/src/features/settings/settings-dialog.tsx'),
    'utf8'
  )

  assert.match(panel, /showOverlay={false}/)
  assert.match(panel, /modal={false}/)
  assert.match(panel, /<ScrollArea/)
  assert.match(panel, /Kuskus/)
  assert.match(panel, /Graphite/)
  assert.match(panel, /Moss/)
  assert.match(panel, /Clay/)
  assert.match(panel, /Solarized/)
  assert.match(panel, /Catppuccin/)
  assert.match(panel, /Tokyo Storm/)
  assert.match(panel, /Monokai/)
  assert.match(panel, /One Dark/)
  assert.match(panel, /One Dark Pro Flat/)
  assert.match(panel, /One Dark Pro Darker/)
  assert.match(panel, /Dracula/)
  assert.match(panel, /Gruvbox/)
  assert.match(panel, /Nord/)
  assert.match(panel, /<Select[\s\S]*value={colorTheme}/)
  assert.doesNotMatch(panel, /<ToggleGroup[\s\S]*value=\{\[colorTheme\]\}/)
  assert.match(panel, /Typography/)
  assert.match(panel, /Primary UI font/)
  assert.match(panel, /UI font fallback/)
  assert.match(panel, /Primary code font/)
  assert.match(panel, /Code font fallback/)
  assert.match(panel, /var\(--font-code\)/)
  assert.doesNotMatch(panel, /Default view/)
  assert.doesNotMatch(panel, /Sort items by/)
  assert.doesNotMatch(panel, /Focus rail density/)
  assert.doesNotMatch(panel, /Note reading width/)
  assert.doesNotMatch(panel, /Inline title/)
})
