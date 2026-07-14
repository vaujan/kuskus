# button

2026-07-14, golden pair via CLI, migrated to Base UI.

## Changed

- `src/renderer/src/components/ui/button.tsx`: replaced the Radix slot wrapper with shadcn's Base UI button primitive.
- Leftover scan: `radix-ui|@radix-ui` has no matches.

## Left alone

- Native Windows title-bar buttons remain platform controls, not application component primitives.

## Behavior changes

- `asChild` is no longer supported; Base UI consumers use `render` where composition is needed.

## Verify by hand

- Tab to buttons, press Enter and Space, and confirm disabled buttons cannot be activated.
