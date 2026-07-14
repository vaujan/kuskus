# separator

2026-07-14, golden pair via CLI, migrated to Base UI.

## Changed

- `src/renderer/src/components/ui/separator.tsx`: replaced `radix-ui` Separator.Root with Base UI Separator.
- Leftover scan: `radix-ui|@radix-ui` has no matches.

## Left alone

- Existing horizontal separator consumers remain unchanged.

## Behavior changes

- The obsolete Radix `decorative` prop is no longer exposed.

## Verify by hand

- Confirm sidebar separators are visible in both themes.
