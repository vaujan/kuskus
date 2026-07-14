# badge

2026-07-14, golden pair via CLI, migrated successfully to Base UI composition utilities.

## Changed

- `src/renderer/src/components/ui/badge.tsx:1`: replaced Radix Slot with Base UI `mergeProps` and `useRender`.
- `src/renderer/src/components/ui/badge.tsx:30`: changed polymorphic composition from `asChild` to `render` while preserving all badge variants and classes.
- Leftover scan is clean: `rg -n "radix-ui|@radix-ui" src/renderer/src/components/ui/badge.tsx` returned no matches.
- Whole-renderer consumer sweep found no remaining `asChild`, Radix imports, or stale Radix CSS variables.

## Left alone

- Badge consumers in `src/renderer/src/App.tsx` use the default span rendering and required no API changes.
- `src/renderer/src/components/ui/card.tsx` is plain React and is not part of the Radix migration.

## Behavior changes

The wrapper's polymorphic API is now `render` instead of `asChild`. Existing Kuskus badge call sites are unaffected.

## Verify by hand

- Open the main library view and confirm secondary and outline badges retain their colors, spacing, and rounded shape.
- Tab to any interactive badge added during future use and confirm its rendered element receives the expected focus styling.
