# Build Plan

Status: Active  
Last updated: 2026-08-07

## Delivery approach

Build Kuskus as a sequence of complete vertical slices. Each milestone must connect the visible interface to real local files and end in behavior suitable for dogfooding. Avoid building a polished mock interface whose data model will be replaced later.

## Milestone 1: Local Markdown note

Goal: prove the complete local-first architecture with the smallest content type.

Deliverables:

- Create a library in a user-selected parent folder.
- Open an existing valid Kuskus library.
- Reopen the last valid library on launch.
- Display Inbox with a toolbar-summoned inline New Item card.
- Open or refocus that card with in-app `Ctrl+N` while workspace shortcuts are active.
- On Windows, register fixed `Ctrl+Shift+Space` while the single Kuskus process is running and route it to a
  singleton bottom-right Inbox composer sharing its recoverable session with the inline surface.
- Accept Markdown without a permanent capture tile or modal.
- Commit with Save or `Ctrl+Enter`.
- Write readable vault files plus hidden schema-v2 library, collection, and item records according
  to the storage contract.

## Vault-native redesign (completed 2026-07-29)

- Added schema-v2 vault scanning, readable capture filenames, nested folder collections, legacy
  companion-note asset compatibility, visible Archive, hidden Trash, and stable hidden records.
- Added a collapsible nested-folder tree with per-library disclosure state and validated subfolder
  creation from each parent folder's menu.
- Added initialization preview/commit, guided schema-v1 sibling migration, startup/focus/watch
  reconciliation, fingerprint-based binary recovery, and typed vault-change notifications.
- Added core Obsidian frontmatter, wikilink, alias, heading, note-embed, and image-embed handling;
  unresolved links remain safe and visible.
- Added general-file items, referenced-attachment detection and preference, relative paths in DTOs,
  filename-backed rename, and ID-only native operations.
- Verification covers initialization, migration, lifecycle operations, conflicts, malformed input,
  path validation, persistence, restart, lint, types, tests, and production build.
- Removed visible Kuskus YAML from new notes, added `.url` Internet Shortcuts, filesystem-identity
  reconciliation, unique-fingerprint fallback, and recoverable automatic cleanup of legacy metadata.
- Read saved notes back into the interface after reload or restart.
- Morph the draft into the newly saved first card.
- Show `note.md` content in the in-app detail view.
- Render full Markdown in cards and details and allow guarded text editing from the detail view.
- Keep detail scrolling on the shared shadcn ScrollArea and suspend workspace shortcuts while the
  modal is open so Markdown editing commands remain local to the note.
- Show actionable states for missing, invalid, or unwritable libraries.

Exit criteria:

- A real note can be created, found on disk, reopened after restart, and viewed in its detail view.
- Capture and saved notes support decoration-only Obsidian-style Live Preview without changing
  authoritative Markdown bytes. A saved note can switch among Read, Live, highlighted Markdown, and
  linked Split presentations, update its preview on every committed edit, autosave, persist across
  restart, retain source selection and pane positions, and remain protected from stale overwrites
  through reviewable conflict resolution.
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
- Durable general-file staging across quick-capture handoff and restart.
- Durable FIFO capture submissions for notes, links, images, and files, with immediate fresh-session
  reuse, restart resumption, exact-once item identity, and persistent recovery actions.
- Independent sibling note images with stable item IDs, collision-safe names, standard relative
  embeds, and destination snapshots that survive queue delay, retry, and restart.
- A policy-based main-process attachment resolver implementing `same-folder` now while reserving
  future vault-root, configured-folder, and note-subfolder placement without renderer or schema churn.
- Reference-aware note and image move, rename, archive, Trash, restore, and permanent-delete behavior,
  including stale-review protection and optional unused-image cleanup.
- Editable timestamp naming for clipboard images, automatic movement of exclusively referenced
  sibling images, reference-update feedback, and a saved-note Attachments panel.

Exit criteria:

- Original external files remain unchanged.
- Library copies survive restart and missing previews.

### Image slice acceptance criteria

- Clipboard bitmap and image-file paste/drop create exactly one image item through New Item or the focused content canvas.
- Images added after Markdown begins are staged, recovered after restart, and finalized as
  independently indexed sibling files with portable relative Markdown links.
- Stale schema-v1 `./assets/` drafts normalize in place when activated, and restart-recovered queues
  replace both current and legacy aliases before the note is written.
- Existing `.assets` embeds with spaces, percent signs, escaped characters, or parentheses render
  and participate in reference tracking without changing their Markdown bytes.
- The authoritative image is copied into the library via a temporary directory and survives restart.
- Invalid image data, missing stored content, and unsafe item IDs produce visible errors without exposing arbitrary filesystem paths.
- Image cards show a natural-ratio preview and open a larger in-app preview.
- A supported image dragged over the content canvas reserves the first capture slot with a static
  shadow card or row, hands off to the confirmation composer without losing an existing draft, and
  never implies that the image was saved before explicit confirmation.

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
- Present nested collections as a collapsible tree with validated folder icons and recursive counts.
- Browse parent folders as aggregate subtree scopes while keeping capture destinations precise.
- Move one or more items safely through tree-aware menus or drag and drop.
- Keep dragged source items anchored and dimmed while a capped, elevated native preview follows the
  pointer; multi-item previews identify their count and valid destinations provide restrained depth
  feedback without obscuring the workspace.
- Reparent folders through a validated move dialog or drag and drop without changing identity.
- Refuse non-empty nested-folder removal before moving any direct items.
- Rename item display titles without renaming stored content files.
- Rename the sole selected or focused visible item with renderer-local `F2` outside Trash.
- Archive and unarchive one or more items safely.
- Restore items from Trash.
- Move selected or focused visible items to Trash with renderer-local `Delete`; in Trash, reuse the
  permanent-delete confirmation.
- Preserve or resolve active New Item drafts before navigation.

Exit criteria:

- Interrupted moves and collection operations cannot silently lose content.

## Milestone 5: Retrieval views

Deliverables:

- Responsive Masonry view.
- Uniform Grid view.
- Retain the existing compact Table implementation while keeping it unavailable pending a revised
  retrieval and toolbar decision.
- Focus master-detail view with a responsive default text-first Index rail, optional natural-height Visual
  rail, shared full detail, pane-based capture, integrated retrieval chrome, persisted density,
  unified Focus selection tint with distinct active/bulk semantics, and narrow drill-in behavior.
- Search by title, note, URL/domain, and filename.
- Type filters, referenced-attachment visibility, and basic sorting.
- Persist sidebar and view preferences.

Exit criteria:

- View changes preserve selection, ordering, and active context.

## Milestone 6: Reliability and dogfooding readiness

Deliverables:

- Trash and permanent deletion safeguards.
- Missing-content and read-only-library recovery states.
- Index rebuild path if an index has been introduced.
- Keyboard and accessibility pass.
- Selection-first `F2` and `Delete` commands across Masonry, Grid, and Focus, with focused-item
  fallback, menu labels, editable/menu/detail/dialog guards, and no modified Delete variants.
- Selection-aware item context and overflow menus across Masonry, Grid, and Focus, with explicit
  clicked-item and selected-item scopes for every organization and lifecycle action.
- Seven-day dogfooding build.

Exit criteria:

- The criteria in `docs/06-dogfooding-log.md` can be attempted with real project data.

## Current milestone

Milestone 1 was completed on 2026-07-14. The summoned New Item and Markdown image-attachment slice
was completed on 2026-07-19 and redesigned as Obsidian-compatible independent attachments on
2026-08-02. The global shortcut-first capture entry was completed on 2026-07-29 and moved to the
shared-session bottom-right popup on 2026-07-30. Renderer-local `F2` rename and `Delete` item commands
were completed on 2026-07-29. Milestone 2 continues with PDFs and general files. Library sorting by
date added, title, and item type (Milestone 5 retrieval work) was completed on 2026-07-28.

## Performance foundation (completed 2026-08-07)

- Added repeatable temporary 100-, 1,000-, and 5,000-item benchmarks for cold rebuild, no-op
  reconciliation, one-note edits, cached startup, search, memory, and unchanged record writes.
- Added an atomic rebuildable library snapshot, unchanged-file signatures, bounded scanning,
  streamed hashing, shared attachment resolution maps, and single-flight watcher/focus reconciliation.
- Split lightweight library overview IPC from exact item-detail reads and moved full-note search to
  the main-process snapshot.
- Added 100-card progressive visual rendering, persistent Masonry observers, shared preview request
  concurrency and LRU caching, separate dynamic surface entries, and a Latin-only base font asset.

## Performance improvement pass (planned)

The next measured pass is defined in `docs/11-performance-improvement-plan.md`. It prioritizes
bounded card thumbnails, viewport-driven and byte-bounded preview caching, idle Quick Capture
renderer destruction, and narrower editor lazy-loading before lower-impact React micro-optimizations.
