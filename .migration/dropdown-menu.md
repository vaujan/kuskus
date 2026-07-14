# dropdown-menu

2026-07-14, golden pair via CLI, migrated successfully from Radix DropdownMenu to Base UI Menu.

## Changed

- `src/renderer/src/components/ui/dropdown-menu.tsx:2`: replaced Radix DropdownMenu with `@base-ui/react/menu` while retaining the public `DropdownMenu*` names.
- `src/renderer/src/components/ui/dropdown-menu.tsx:19`: introduced `Portal > Positioner > Popup`, forwarded all positioning props, and replaced Radix CSS variables with Base UI variables.
- `src/renderer/src/components/ui/dropdown-menu.tsx:125`: mapped submenus to `SubmenuRoot` and `SubmenuTrigger`, preserving the shadcn submenu positioning defaults.
- `src/renderer/src/components/ui/dropdown-menu.tsx:170`: mapped checkbox and radio indicators to their Base UI-specific parts.
- Leftover scan is clean: `rg -n "radix-ui|@radix-ui" src/renderer/src/components/ui/dropdown-menu.tsx` returned no matches.
- Whole-renderer consumer sweep found no remaining `asChild`, Radix imports, or stale Radix CSS variables.

## Left alone

- Dropdown Menu has no current Kuskus consumer, so no application call sites were changed.
- The Vega translucent menu surface, Lucide icons, variants, inset spacing, shortcut styling, and public exports were preserved.

## Behavior changes

Base UI checkbox and radio items default to keeping the menu open after selection. This is documented and intentionally not overridden with `closeOnClick`.

## Verify by hand

- In a temporary harness, open the menu by mouse and keyboard; verify arrow-key navigation, typeahead, disabled items, Escape dismissal, and focus return.
- Open a submenu and select checkbox and radio items; confirm submenu positioning and the documented stay-open behavior, then remove the harness before committing production code.
