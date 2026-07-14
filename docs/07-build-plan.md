# Build Plan

Status: Active  
Last updated: 2026-07-14

## Delivery approach

Build Kuskus as a sequence of complete vertical slices. Each milestone must connect the visible interface to real local files and end in behavior suitable for dogfooding. Avoid building a polished mock interface whose data model will be replaced later.

## Milestone 1: Local Markdown note

Goal: prove the complete local-first architecture with the smallest content type.

Deliverables:

- Create a library in a user-selected parent folder.
- Open an existing valid Kuskus library.
- Reopen the last valid library on launch.
- Display Inbox and the inline Add Item composer.
- Expand the composer in place and accept Markdown.
- Commit with Save or `Ctrl+Enter`.
- Write `library.json`, `item.json`, and `note.md` according to the storage contract.
- Read saved notes back into the interface after reload or restart.
- Insert a newly saved note card immediately after Add Item.
- Reveal `note.md` in Windows File Explorer.
- Show actionable states for missing, invalid, or unwritable libraries.

Exit criteria:

- A real note can be created, found on disk, reopened after restart, and revealed in Explorer.
- The external filesystem is never accessible through an arbitrary renderer-supplied path.
- Typecheck, lint, and production build pass.

## Milestone 2: Images and general files

Deliverables:

- Clipboard image paste.
- File paste and drag-and-drop.
- Safe copy into the library with progress and collision protection.
- Image, PDF, and general-file cards.
- Open and Show in Explorer actions.
- Interrupted-import recovery.

Exit criteria:

- Original external files remain unchanged.
- Library copies survive restart and missing previews.

## Milestone 3: URL capture

Deliverables:

- Detect a single pasted URL in the universal composer.
- Persist the URL before performing network metadata work.
- Show a provisional card immediately.
- Enrich title, domain, favicon, description, and preview in the background.
- Open in the default browser.
- Preserve usable items when metadata retrieval fails.

Exit criteria:

- URL capture works offline with at least the original URL intact.

## Milestone 4: Collections and organization

Deliverables:

- Inbox, All Items, collections, and Trash navigation.
- Create, rename, and remove collections.
- Move one or more items safely.
- Restore items from Trash.
- Resolve active composer drafts before navigation.

Exit criteria:

- Interrupted moves and collection operations cannot silently lose content.

## Milestone 5: Retrieval views

Deliverables:

- Responsive Visual view.
- Uniform Grid view.
- Compact List view.
- Search by title, note, URL/domain, and filename.
- Type filters and basic sorting.
- Persist sidebar and view preferences.

Exit criteria:

- View changes preserve selection, ordering, and active context.

## Milestone 6: Reliability and dogfooding readiness

Deliverables:

- Trash and permanent deletion safeguards.
- Missing-content and read-only-library recovery states.
- Index rebuild path if an index has been introduced.
- Keyboard and accessibility pass.
- Seven-day dogfooding build.

Exit criteria:

- The criteria in `docs/06-dogfooding-log.md` can be attempted with real project data.

## Current milestone

Milestone 1 was completed on 2026-07-14. Milestone 2, images and general files, is next.
