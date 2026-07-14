# separator

2026-07-14, golden pair via CLI, migrated successfully to the Base UI separator primitive.

## Changed

- `src/renderer/src/components/ui/separator.tsx:1`: replaced the Radix separator import with `@base-ui/react/separator`.
- `src/renderer/src/components/ui/separator.tsx:5`: removed the Radix-only `decorative` prop and used Base UI's callable separator primitive.
- Leftover scan is clean: `rg -n "radix-ui|@radix-ui" src/renderer/src/components/ui/separator.tsx` returned no matches.

## Left alone

- The separator call site in `src/renderer/src/App.tsx` did not pass `decorative` and required no source change.
- Existing orientation classes and visual dimensions were preserved from the `base-vega` golden variant.

## Behavior changes

The separator is now semantic and exposes `role="separator"`; Base UI does not support Radix's decorative mode.

## Verify by hand

- Open the expanded sidebar and confirm the horizontal separator retains its full width, one-pixel height, and theme color.
- Inspect the separator with accessibility tooling and confirm it exposes the separator role without disrupting keyboard navigation.
