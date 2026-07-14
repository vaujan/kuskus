# sidebar

2026-07-14, official Base UI registry component, added as the application shell starter.

## Changed

- Added `src/renderer/src/components/ui/sidebar.tsx` and its official dependencies.
- `src/renderer/src/App.tsx` now composes SidebarProvider, Sidebar, SidebarInset, and sidebar menu primitives for the full-height left column.
- Leftover scan: `radix-ui|@radix-ui` has no matches.

## Left alone

- Native Windows title-bar controls remain outside the draggable header as platform-specific controls.

## Behavior changes

- The sidebar persists its existing local preference and now uses shadcn's off-canvas mobile behavior at narrow widths.

## Verify by hand

- Hide and show the sidebar, resize to a narrow desktop width, and confirm the toolbar starts beside—not above—the sidebar.
