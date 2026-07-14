# tooltip

2026-07-14, golden pair via CLI, migrated successfully to the Base UI tooltip anatomy and consumer API.

## Changed

- `src/renderer/src/components/ui/tooltip.tsx:1`: replaced Radix Tooltip with `@base-ui/react/tooltip`.
- `src/renderer/src/components/ui/tooltip.tsx:5`: renamed the provider prop from `delayDuration` to `delay` while retaining the zero-delay default.
- `src/renderer/src/components/ui/tooltip.tsx:26`: moved positioning props onto `Positioner` and content into `Popup`, with Base UI transform variables and arrow positioning.
- `src/renderer/src/App.tsx:339`: migrated the Show in Explorer trigger from `asChild` to `render={<Button />}`.
- Leftover scan is clean: `rg -n "radix-ui|@radix-ui" src/renderer/src/components/ui/tooltip.tsx src/renderer/src/App.tsx` returned no matches.
- Whole-renderer consumer sweep found no remaining `asChild`, Radix imports, or stale Radix CSS variables.

## Left alone

- The global `TooltipProvider` placement in `src/renderer/src/App.tsx` already matches Base UI's required provider composition.
- Tooltip text, accessible button label, reveal handler, and Electron native boundary were not changed.

## Behavior changes

Tooltip content now uses the Base UI/shadcn default `sideOffset` of 4px instead of the prior 0px. Provider delay remains 0ms.

## Verify by hand

- Hover and keyboard-focus the Show in Explorer icon; confirm the tooltip appears above it with a small gap and readable arrow.
- Press Enter on the focused trigger, confirm the reveal action still runs, then dismiss or move focus and confirm the tooltip closes without trapping focus.
