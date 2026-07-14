# tooltip

2026-07-14, golden pair via CLI, migrated to Base UI.

## Changed

- `src/renderer/src/components/ui/tooltip.tsx`: replaced Radix portal/content primitives with Base UI portal, positioner, and popup primitives.
- `src/renderer/src/App.tsx`: updated the Explorer trigger to use Base UI `render` composition.
- Leftover scan: `radix-ui|@radix-ui` has no matches.

## Left alone

- Tooltip content and provider placement remain unchanged.

## Behavior changes

- Trigger composition uses `render` instead of `asChild`.

## Verify by hand

- Hover and keyboard-focus the Explorer action; confirm the tooltip appears and the action still opens Explorer.
