# card

2026-07-14, golden pair via CLI, verified Base UI-compatible.

## Changed

- `src/renderer/src/components/ui/card.tsx`: refreshed from the Base UI Vega registry; no primitive API change was required.
- Leftover scan: `radix-ui|@radix-ui` has no matches.

## Left alone

- Card consumers retain their existing composition and layout responsibilities.

## Behavior changes

- None.

## Verify by hand

- Confirm setup, note, and expanded composer cards preserve their borders, headers, and keyboard-visible controls.
