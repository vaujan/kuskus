# dropdown-menu

2026-07-14, golden pair via CLI, migrated to Base UI.

## Changed

- `src/renderer/src/components/ui/dropdown-menu.tsx`: replaced Radix menu primitives with the official Base UI Menu wrapper.
- Leftover scan: `radix-ui|@radix-ui` has no matches.

## Left alone

- No application consumer currently renders a dropdown menu.

## Behavior changes

- Base UI uses popup state and positioner variables rather than Radix-specific variables.

## Verify by hand

- When a menu consumer is added, verify keyboard navigation, typeahead, submenu movement, and close-on-select behavior.
