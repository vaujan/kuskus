# Base UI project migration

2026-07-14, whole-project golden-pair migration, completed.

## Changed

- Changed `components.json` from `radix-vega` to `base-vega`.
- Replaced the `radix-ui` dependency with `@base-ui/react` and refreshed `pnpm-lock.yaml`.
- Migrated button, badge, separator, tooltip, and dropdown-menu wrappers; card required no primitive change.
- Added official shadcn Base UI primitives for input, textarea, field, alert, empty, spinner, toggle, toggle-group, and sidebar.
- Rebuilt the left rail with shadcn's Sidebar, SidebarHeader, SidebarContent, SidebarMenu, and SidebarFooter so it spans the full window height beside the action/title header.
- Leftover scan: `rg "radix-ui|@radix-ui" src/renderer/src package.json components.json` has no matches.

## Left alone

- Electron's native title-bar controls remain custom platform controls.
- The storage, preload, and main-process code are unrelated to the primitive migration.

## Behavior changes

- Base UI composition uses `render`, replacing Radix `asChild` where needed.

## Verify by hand

- Test sidebar hide/show, focused title-bar controls, setup form submission, search, composer save, Explorer reveal, and tooltips in both themes.
