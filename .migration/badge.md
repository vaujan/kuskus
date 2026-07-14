# badge

2026-07-14, golden pair via CLI, migrated to Base UI.

## Changed

- `src/renderer/src/components/ui/badge.tsx`: replaced Radix Slot composition with Base UI `useRender`.
- Leftover scan: `radix-ui|@radix-ui` has no matches.

## Left alone

- Badge consumers retain their existing variants.

## Behavior changes

- Polymorphic use now follows the Base UI `render` API.

## Verify by hand

- Confirm count badges remain visible and do not expand sidebar rows unexpectedly.
