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
- Display Inbox with a toolbar-summoned inline New Item card.
- Accept Markdown without a permanent capture tile or modal.
- Commit with Save or `Ctrl+Enter`.
- Write `library.json`, `item.json`, and `note.md` according to the storage contract.
- Read saved notes back into the interface after reload or restart.
- Morph the draft into the newly saved first card.
- Show `note.md` content in the in-app detail view.
- Render full Markdown in cards and details and allow guarded text editing from the detail view.
- Keep detail scrolling on the shared shadcn ScrollArea and suspend workspace shortcuts while the
  modal is open so Markdown editing commands remain local to the note.
- Show actionable states for missing, invalid, or unwritable libraries.

Exit criteria:

- A real note can be created, found on disk, reopened after restart, and viewed in its detail view.
- A saved note can switch among rendered Read, highlighted Markdown, and linked Split presentations,
  update its preview on every committed edit, autosave, persist across restart, retain source
  selection and pane positions, and remain protected from stale overwrites through reviewable
  conflict resolution.
- The external filesystem is never accessible through an arbitrary renderer-supplied path.
- Typecheck, lint, and production build pass.

## Milestone 2: Images and general files

Deliverables:

- Clipboard image paste.
- Recoverable image staging with explicit **Save image** confirmation before item creation.
- File paste and drag-and-drop.
- Safe copy into the library with progress and collision protection.
- Image, PDF, and general-file cards.
- In-app detail actions.
- Interrupted-import recovery.

Exit criteria:

- Original external files remain unchanged.
- Library copies survive restart and missing previews.

### Image slice acceptance criteria

- Clipboard bitmap and image-file paste/drop create exactly one image item through New Item or the focused content canvas.
- Images added after Markdown begins are staged, recovered after restart, and finalized as portable note assets.
- The authoritative image is copied into the library via a temporary directory and survives restart.
- Invalid image data, missing stored content, and unsafe item IDs produce visible errors without exposing arbitrary filesystem paths.
- Image cards show a natural-ratio preview and open a larger in-app preview.

## Milestone 3: URL capture

Deliverables:

- Detect a single pasted URL in the New Item card.
- Keep the detected URL editable and recoverable until **Save link** or `Ctrl+Enter` confirms it.
- Persist the URL before performing network metadata work.
- Show a provisional card immediately.
- Enrich title, domain, favicon, description, and preview in the background.
- Open in the default browser.
- Preserve usable items when metadata retrieval fails.

Exit criteria:

- URL capture works offline with at least the original URL intact.
- Pasting a URL does not create an item or begin metadata enrichment before explicit confirmation.

## Milestone 4: Collections and organization

Deliverables:

- Inbox, All Items, collections, Archive, and Trash navigation.
- Create, rename, and remove collections.
- Move one or more items safely.
- Rename item display titles without renaming stored content files.
- Archive and unarchive one or more items safely.
- Restore items from Trash.
- Preserve or resolve active New Item drafts before navigation.

Exit criteria:

- Interrupted moves and collection operations cannot silently lose content.

## Milestone 5: Retrieval views

Deliverables:

- Responsive Masonry view.
- Uniform Grid view.
- Compact Table view with Name, Type, and Added columns.
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

Milestone 1 was completed on 2026-07-14. The summoned New Item and Markdown image-attachment slice was completed on 2026-07-19. Milestone 2 continues with PDFs and general files. Library sorting by date added, title, and item type (Milestone 5 retrieval work) was completed on 2026-07-28.
