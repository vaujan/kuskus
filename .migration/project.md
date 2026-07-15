# Base UI project migration

2026-07-14, whole-project golden-pair migration completed from shadcn `radix-vega` to `base-vega`.

## Dependency swap

- Added `@base-ui/react@1.6.0` with pnpm before migrating wrappers.
- Migrated Button, Badge, Separator, Tooltip, and Dropdown Menu using their official shadcn `base-vega` variants.
- Removed the direct `radix-ui` dependency after the last wrapper migrated and refreshed `pnpm-lock.yaml`.
- `pnpm list --depth 0` confirms `@base-ui/react` is the only direct UI primitive package.

## Consumer sweep

- Updated the Show in Explorer tooltip trigger in `src/renderer/src/App.tsx` from `asChild` to Base UI's `render` prop.
- `rg -n "radix-ui|@radix-ui|--radix-|asChild|IconPlaceholder" src/renderer/src package.json components.json` returned no matches.
- `card.tsx` remained unchanged because it is plain React rather than a primitive wrapper.

## Behavior changes

- Separator is semantic because Base UI has no decorative separator mode.
- Tooltip content uses the shadcn Base UI default 4px side offset; its provider still defaults to zero delay.
- Dropdown checkbox and radio items default to remaining open after selection; this was documented without adding `closeOnClick`.

## Verification

- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: passed, 3 tests.
- `pnpm build`: passed for main, preload, and renderer bundles.
- Focused Prettier check for migrated wrappers and `App.tsx`: passed.
- A temporary browser harness verified button enabled/disabled states, semantic separator output, menu opening, arrow-key navigation, typeahead, disabled items, checkbox stay-open behavior, submenu navigation, Escape dismissal, and trigger focus return; the harness was removed afterward.
- Final Electron-specific tooltip hover/focus feel remains listed in the Tooltip report for hands-on QA.

0 wrappers remain on Radix.
