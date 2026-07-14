# button

2026-07-14, golden pair via CLI, migrated successfully to the Base UI button primitive.

## Changed

- `components.json`: switched the whole-project shadcn style from `radix-vega` to `base-vega`.
- `package.json` and `pnpm-lock.yaml`: installed `@base-ui/react` alongside Radix for the migration window.
- `src/renderer/src/components/ui/button.tsx:1`: replaced Radix Slot with `@base-ui/react/button`.
- `src/renderer/src/components/ui/button.tsx:43`: changed the wrapper API from `asChild` to Base UI's `render`-capable `ButtonPrimitive.Props` while preserving variants and sizes.
- Leftover scan is clean: `rg -n "radix-ui|@radix-ui" src/renderer/src/components/ui/button.tsx` returned no matches.
- Whole-renderer consumer sweep found no remaining `asChild`, Radix imports, or stale Radix CSS variables.

## Left alone

- `src/renderer/src/components/ui/card.tsx` is plain React and is not part of the Radix migration.
- Button consumers do not use `asChild`, so no call sites required changes for this component.

## Behavior changes

The wrapper now follows Base UI's `render` composition API. Existing Kuskus button call sites use native buttons and retain their behavior.

## Verify by hand

- Open the library setup and main library screens; click default, secondary, ghost, and icon buttons.
- Tab through enabled and disabled buttons and confirm focus rings, disabled behavior, pressed feedback, and click actions match the baseline.
