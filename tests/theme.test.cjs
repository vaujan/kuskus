const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const {
  DEFAULT_TYPOGRAPHY,
  applyControlStyle,
  applyTheme,
  createFontStack,
  createLocalFontPreference,
  getFontPreferenceLabel,
  resolveBaseFontSize,
  resolveAppliedTheme,
  resolveColorMode,
  resolveColorTheme,
  resolveControlStyle,
  resolveFontPreference
} = require('../src/renderer/src/hooks/theme.ts')

test('defaults to system fonts and equal note sizes across editing and reading', () => {
  assert.equal(DEFAULT_TYPOGRAPHY.uiFont, 'system-ui')
  assert.equal(DEFAULT_TYPOGRAPHY.contentFont, 'system-ui')
  assert.equal(DEFAULT_TYPOGRAPHY.codeFont, 'system-mono')
  assert.equal(DEFAULT_TYPOGRAPHY.sourceFontSize, '16')
  assert.equal(DEFAULT_TYPOGRAPHY.contentFontSize, '16')
})

test('resolves and applies the saved control style', () => {
  assert.equal(resolveControlStyle('flat'), 'flat')
  assert.equal(resolveControlStyle('skeuomorphic'), 'skeuomorphic')
  assert.equal(resolveControlStyle(null), 'skeuomorphic')
  assert.equal(resolveControlStyle('unknown'), 'skeuomorphic')

  const root = { dataset: {} }
  applyControlStyle('flat', root)
  assert.equal(root.dataset.controlStyle, 'flat')
})

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
  assert.equal(resolveColorTheme('obsidian'), 'obsidian')
  assert.equal(resolveColorTheme('github'), 'github')
  assert.equal(resolveColorTheme('vscode'), 'vscode')
  assert.equal(resolveColorTheme('ayu'), 'ayu')
  assert.equal(resolveColorTheme('material'), 'material')
  assert.equal(resolveColorTheme('moss'), 'moss')
  assert.equal(resolveColorTheme('clay'), 'clay')
  assert.equal(resolveColorTheme('solarized'), 'solarized')
  assert.equal(resolveColorTheme('catppuccin'), 'catppuccin')
  assert.equal(resolveColorTheme('tokyo-storm'), 'tokyo-storm')
  assert.equal(resolveColorTheme('monokai'), 'monokai')
  assert.equal(resolveColorTheme('one'), 'one')
  assert.equal(resolveColorTheme('dracula'), 'dracula')
  assert.equal(resolveColorTheme('gruvbox'), 'gruvbox')
  assert.equal(resolveColorTheme('nord'), 'nord')
  assert.equal(resolveColorTheme('custom'), 'one')
  assert.equal(resolveColorTheme(null), 'one')
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
      contentFont: 'local:Literata',
      contentFontFallback: 'system-ui',
      codeFont: 'local:Iosevka',
      codeFontFallback: 'system-mono',
      sourceFontSize: '14',
      contentFontSize: '17'
    },
    root
  )
  assert.deepEqual([...classes], ['dark'])
  assert.equal(root.style.colorScheme, 'dark')
  assert.equal(root.dataset.colorTheme, 'moss')
  assert.equal(properties.get('--font-ui'), "'IBM Plex Sans Variable', system-ui, sans-serif")
  assert.equal(properties.get('--font-content'), '"Literata", system-ui, sans-serif')
  assert.equal(properties.get('--font-code'), '"Iosevka", ui-monospace, monospace')
  assert.equal(properties.get('--markdown-source-font-size'), '14px')
  assert.equal(properties.get('--markdown-content-font-size'), '17px')

  applyTheme(
    'light',
    'graphite',
    {
      uiFont: 'system-ui',
      uiFontFallback: 'none',
      contentFont: 'inter',
      contentFontFallback: 'none',
      codeFont: 'system-mono',
      codeFontFallback: 'none',
      sourceFontSize: '13',
      contentFontSize: '16'
    },
    root
  )
  assert.deepEqual([...classes], [])
  assert.equal(root.style.colorScheme, 'light')
  assert.equal(root.dataset.colorTheme, 'graphite')
  assert.equal(properties.get('--font-ui'), 'system-ui, sans-serif')
  assert.equal(properties.get('--font-content'), "'Inter Variable', sans-serif")
  assert.equal(properties.get('--font-code'), 'ui-monospace, monospace')
})

test('accepts only supported Markdown base font sizes', () => {
  assert.equal(resolveBaseFontSize('13', '16'), '13')
  assert.equal(resolveBaseFontSize('20', '16'), '20')
  assert.equal(resolveBaseFontSize('19', '16'), '16')
  assert.equal(resolveBaseFontSize(null, '14'), '14')
})

test('defines light and dark palettes for every iconic theme', () => {
  const css = readFileSync(require.resolve('../src/renderer/src/assets/main.css'), 'utf8')

  for (const theme of [
    'obsidian',
    'github',
    'vscode',
    'ayu',
    'material',
    'solarized',
    'catppuccin',
    'tokyo-storm',
    'monokai',
    'one',
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

test('scrollable selects use the shared scroll area', () => {
  const select = readFileSync(
    require.resolve('../src/renderer/src/components/ui/select.tsx'),
    'utf8'
  )

  assert.match(select, /viewportRender=\{<SelectPrimitive\.List \/>\}/)
  assert.doesNotMatch(select, /overflow-y-auto/)
})

test('settings keeps contextual view controls on the surfaces they affect', () => {
  const panel = readFileSync(
    require.resolve('../src/renderer/src/features/settings/settings-window-app.tsx'),
    'utf8'
  )
  const theme = readFileSync(require.resolve('../src/renderer/src/hooks/theme.ts'), 'utf8')

  assert.match(panel, /<SidebarProvider/)
  assert.match(panel, /<SidebarMenuButton/)
  assert.match(panel, /md:left-\[208px\]/)
  assert.match(panel, /SettingsSection = 'appearance' \| 'editing'/)
  assert.doesNotMatch(panel, /IconBolt|>Capture</)
  assert.match(panel, /<ScrollArea/)
  assert.match(panel, /COLOR_THEMES\.map/)
  assert.match(panel, /COLOR_MODES\.map/)
  assert.match(theme, /Kuskus/)
  assert.match(theme, /Graphite/)
  assert.match(theme, /label: 'Obsidian'/)
  assert.match(theme, /GitHub/)
  assert.match(theme, /VS Code/)
  assert.match(theme, /Ayu/)
  assert.match(theme, /Material/)
  assert.match(theme, /Moss/)
  assert.match(theme, /Clay/)
  assert.match(theme, /Solarized/)
  assert.match(theme, /Catppuccin/)
  assert.match(theme, /Tokyo Storm/)
  assert.match(theme, /Monokai/)
  assert.equal(theme.match(/label: 'One Dark'/g)?.length, 1)
  assert.match(theme, /Dracula/)
  assert.match(theme, /Gruvbox/)
  assert.match(theme, /Nord/)
  assert.match(panel, /<Select[\s\S]*value={colorTheme}/)
  assert.doesNotMatch(panel, /<ToggleGroup[\s\S]*value=\{\[colorTheme\]\}/)
  assert.match(panel, /Typography/)
  assert.match(panel, /ariaLabel="UI font"/)
  assert.match(panel, /ariaLabel="Code font"/)
  assert.doesNotMatch(panel, /font fallback|allowGenericOnly/)
  assert.match(panel, /Source size/)
  assert.match(panel, /Live & Read size/)
  assert.match(panel, /Show line numbers in Markdown Source mode/)
  assert.doesNotMatch(panel, /theme preview/)
  assert.match(panel, /Content font/)
  assert.doesNotMatch(panel, /Default view/)
  assert.doesNotMatch(panel, /Sort items by/)
  assert.doesNotMatch(panel, /Focus rail density/)
  assert.doesNotMatch(panel, /Note reading width/)
  assert.doesNotMatch(panel, /Inline title/)
})

test('applies separate Source and Live plus Read font-size tokens', () => {
  const sourceEditor = readFileSync(
    require.resolve('../src/renderer/src/features/items/markdown-editor.tsx'),
    'utf8'
  )
  const markdownCss = readFileSync(
    require.resolve('../src/renderer/src/assets/markdown.css'),
    'utf8'
  )

  assert.match(sourceEditor, /var\(--markdown-source-font-size, 14px\)/)
  assert.match(
    markdownCss,
    /data-typeset-presentation='detail'[\s\S]*var\(--markdown-content-font-size, 16px\)/
  )
})

test('toggles line numbers only in Markdown Source mode', () => {
  const sourceEditor = readFileSync(
    require.resolve('../src/renderer/src/features/items/markdown-editor.tsx'),
    'utf8'
  )
  const liveEditor = readFileSync(
    require.resolve('../src/renderer/src/features/items/live/live-markdown-editor.tsx'),
    'utf8'
  )

  assert.match(sourceEditor, /useSetting<boolean>\('sourceLineNumbers'\)/)
  assert.match(sourceEditor, /lineNumbersCompartment\.reconfigure/)
  assert.doesNotMatch(liveEditor, /sourceLineNumbers/)
})

test('system monospace stays monospace when selected for UI or reading text', () => {
  assert.equal(createFontStack('system-mono', 'system-ui', 'sans-serif'), 'ui-monospace, monospace')
  assert.equal(createFontStack('system-mono', 'inter', 'sans-serif'), 'ui-monospace, monospace')
})

test('unavailable local fonts retain an appropriate system fallback', () => {
  assert.equal(
    createFontStack('local:Font That Is Not Installed', 'system-ui', 'sans-serif'),
    '"Font That Is Not Installed", system-ui, sans-serif'
  )
  assert.equal(
    createFontStack('local:Font That Is Not Installed', 'none', 'monospace'),
    '"Font That Is Not Installed", monospace'
  )
  assert.equal(
    createFontStack('local:Font That Is Not Installed', 'system-mono', 'sans-serif'),
    '"Font That Is Not Installed", ui-monospace, monospace'
  )
})
