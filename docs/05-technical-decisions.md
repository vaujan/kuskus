# Technical Decisions

Status: Living record  
Last updated: 2026-07-14

This file records decisions that constrain implementation. New entries are append-only; superseded decisions remain for context and link to their replacements. See `10-current-architecture.md` for the current system map.

## Current foundation

The existing repository already uses:

- Electron 39.
- Electron Vite.
- React 19 and TypeScript.
- Tailwind CSS 4.
- shadcn/ui and Radix primitives.
- A sandboxed renderer with context isolation enabled and Node integration disabled.
- A narrow preload bridge for native window controls.
- Custom title-bar controls on Windows.

These are current implementation facts, not permanent product requirements. Replacing them requires a recorded reason.

## Decision template

```text
## DEC-XXX: Short title

Date:
Status: Proposed | Accepted | Superseded

Context:

Options considered:

Decision:

Consequences:

Revisit when:
```

## DEC-001: Windows-first desktop implementation

Date: 2026-07-14  
Status: Accepted

### Context

The initial user works on Windows, and the current Electron foundation already targets desktop platforms.

### Decision

Build and validate the first usable version on Windows. Avoid unnecessary platform coupling in domain and storage code, but do not delay dogfooding for macOS or Linux packaging.

### Consequences

- Windows File Explorer behavior is the first reveal-in-system-manager integration.
- Windows path, filename, locking, and long-path behavior require testing.
- Platform-specific interfaces belong behind typed main-process services.

### Revisit when

The Windows dogfooding workflow is reliable and another platform is actively needed.

## DEC-002: Continue with the existing Electron foundation

Date: 2026-07-14  
Status: Accepted

### Context

The repository contains a working Electron, React, and TypeScript shell with secure renderer defaults and custom window controls.

### Decision

Use the existing foundation for the MVP instead of changing desktop frameworks before validating the product workflow.

### Consequences

- Filesystem, database, network metadata, and shell operations execute in the main process or a controlled worker.
- Renderer access occurs through a narrow typed preload API.
- Node integration remains disabled in the renderer.
- IPC input and resolved filesystem paths must be validated in the main process.

### Revisit when

Measured performance, packaging, security, or maintenance problems cannot be resolved within Electron.

## DEC-003: Imported content is copied into a managed library

Date: 2026-07-14  
Status: Accepted

### Context

A portable, reliable library cannot depend on external files remaining at their original paths. Linking in place adds missing-file behavior and weakens backup guarantees.

### Decision

For the MVP, copy imported images, PDFs, and general files into the selected Kuskus library. Preserve the external original and remember its original filename as metadata.

### Consequences

- The library is self-contained and can be backed up as one folder.
- Imports consume additional disk space.
- Duplicate detection may become valuable later.
- Kuskus deletion affects only the library copy.

### Revisit when

Dogfooding shows a repeated need to manage very large files or preserve external folder ownership.

## DEC-004: Files are authoritative; database is a rebuildable index

Date: 2026-07-14  
Status: Accepted

### Context

Local storage does not provide meaningful ownership if the only readable representation is a proprietary database.

### Decision

Use ordinary content files and documented JSON/Markdown metadata as the source of truth. A local database may support search and fast queries, but Kuskus must be able to rebuild it from the library.

### Consequences

- Import and update operations must keep authoritative files consistent.
- Index rebuild and corruption recovery become required capabilities.
- External edits can be discovered rather than making the library unusable.

### Revisit when

The proposed file layout causes a demonstrated reliability or performance problem at realistic library sizes.

## DEC-005: URL items are bookmarks, not offline archives

Date: 2026-07-14  
Status: Accepted

### Context

Full webpage preservation introduces complex rendering, storage, authentication, and fidelity problems.

### Decision

The MVP stores the original URL and available metadata. Metadata failure does not invalidate the item. Kuskus does not promise that the remote page will remain available.

### Consequences

- URL capture can remain fast and robust.
- The product must describe URL items as saved references rather than permanent archives.
- Offline snapshots can be evaluated independently later.

### Revisit when

Broken or changing sources repeatedly undermine the dogfooding workflow.

## DEC-006: Visual view is responsive and format-aware

Date: 2026-07-14  
Status: Accepted

### Context

Wireframes show an expanded or hidden sidebar, while the visual references show mixed-format cards with both uniform and natural heights.

### Decision

Provide Visual, Grid, and List modes. Visual is the default and uses format-aware cards with a responsive column count. Hiding the sidebar increases available width but does not force a specific number of columns.

### Consequences

- Card presentation varies by item type.
- Selection and ordering must remain stable across view changes.
- Layout performance must be tested with realistic item counts and image sizes.

### Revisit when

Dogfooding demonstrates that one view is unnecessary or the masonry behavior makes retrieval less predictable.

## Decisions still required during implementation

- Database and indexing library.
- ID generation format.
- Exact library directory names and filename sanitization.
- Filesystem transaction and recovery approach.
- URL metadata fetcher, limits, and security policy.
- Thumbnail generation pipeline and cache limits.
- Search tokenization and supported languages.
- Multi-window policy.
- Auto-update policy before any public distribution.

## DEC-007: Use Base UI for shadcn primitives

Date: 2026-07-14
Status: Accepted

### Context

The initial interface used shadcn's `radix-vega` component base and the bundled `radix-ui`
package. The application only depended on five Radix-backed wrappers, and shadcn provides
matching `base-vega` variants that preserve the established Vega styling while using Base UI.

### Decision

Use shadcn's `base-vega` component base and `@base-ui/react` for interface primitives. Keep
the local shadcn wrappers as the application-facing API and adopt Base UI's `render` composition
model instead of Radix's `asChild` model.

### Consequences

- New shadcn components resolve to Base UI variants.
- Polymorphic wrapper consumers use the `render` prop.
- Base UI behavior differences remain visible and documented rather than being silently patched.
- The Electron renderer security model, storage contract, and native-operation boundaries are unchanged.

### Revisit when

A Base UI limitation blocks a required golden workflow or creates a demonstrated accessibility,
behavior, or maintenance problem that cannot be addressed in the local wrapper.

## DEC-008: Import image bytes through the narrow library bridge

Date: 2026-07-15
Status: Accepted

### Context

The renderer can receive clipboard and drag-and-drop image data, but it must not receive arbitrary filesystem access or decide where library content is written.

### Decision

The renderer sends image bytes, declared media type, and optional source filename through a typed preload API. The main-process library service validates the binary signature and dimensions, then writes the content to a temporary directory inside the library before atomically finalizing the item.

### Consequences

- Clipboard images and image-file imports use the same durable storage path.
- The renderer cannot supply a destination path.
- The initial image slice supports PNG, JPEG, GIF, WebP, and BMP; PDFs and generic files remain deferred.

## DEC-009: Retain quick-note drafts in renderer-local storage

Date: 2026-07-15
Status: Accepted

### Context

The universal composer must let users leave unfinished text without losing it, including across an app restart. Draft text is presentation state and does not become authoritative library content until the user saves it.

### Decision

Store one quick-note draft per library path in renderer-local storage. Close and Escape collapse the composer while retaining non-empty text. A successful note save clears the draft. Image import attempts remain in renderer memory because retry requires the original `File`; failed attempts expose Retry and Remove without widening the preload API.

### Consequences

- Draft recovery does not create partial authoritative item files.
- Switching libraries does not mix drafts because the library path scopes the storage key.
- Failed image imports survive composer collapse during the current session but not a full app restart.
- Preload, IPC, storage contracts, and main-process permissions remain unchanged.

### Revisit when

Kuskus adds multiple simultaneous destinations, draft synchronization, or a requirement to recover binary import attempts after restart.

## DEC-010: Use a feature-oriented modular monolith

Date: 2026-07-15
Status: Accepted

### Context

The first note and image vertical slices concentrated application lifecycle, IPC registration,
filesystem persistence, item validation, and renderer features into a few large files. The process
security boundaries were sound, but adding the remaining MVP item types and collection workflows
would make those files harder to change and verify safely.

### Decision

Keep Kuskus as one Electron application while organizing each process by responsibility. Shared
modules own typed IPC contracts; the preload remains a thin adapter; main-process IPC, window,
library orchestration, storage, and item parsing are separate modules; and renderer code is grouped
by application, capture, item, library, and shell features. UI primitives remain separate from
application feature components.

### Consequences

- Process and IPC boundaries remain explicit without introducing additional runtimes or services.
- Library workflows coordinate storage through a focused store while pure item modules can be
  tested independently.
- Saved-item variants compose a shared frame instead of accumulating format flags in one component.
- New modules are introduced for working behavior, not as empty placeholders for deferred features.
- Imports target concrete modules rather than broad barrel files.

### Revisit when

Measured complexity requires independently deployable processes, or multiple renderer surfaces need
a shared application-state layer that shallow feature ownership cannot support.

## DEC-011: Store collection identity separately from its display name

Date: 2026-07-15
Status: Accepted

### Context

Folder names are user-facing and need safe renaming without changing identity or relying on a path derived from renderer input.

### Decision

Each collection has a UUID-named directory in `collections/` with a readable `collection.json`. Rename updates only that metadata; deletion is allowed only after the main process confirms its `items/` directory is empty.

### Consequences

- A renamed folder keeps its stable identity.
- The renderer requests only typed CRUD operations through the preload bridge.
- Future item moves have a stable folder target without accepting arbitrary paths.

## DEC-012: Use in-app item details instead of Explorer reveal actions

Date: 2026-07-15
Status: Accepted

### Context

The card-level Explorer controls interrupted visual browsing and made ordinary item clicks feel like file-manager actions.

### Decision

Remove Explorer reveal and native local-file opening APIs from the product UI. Cards open read-only in-app details; URL items retain a narrow, validated main-process action for opening their original `http` or `https` URL in the default browser.

### Consequences

- Library files remain user-readable and accessible outside Kuskus, but the renderer no longer requests native filesystem actions.
- URL metadata is saved in `item.json`; failed enrichment remains a valid bookmark.
- URL metadata fetching is bounded and rejects local/private network destinations before loading page metadata.

## DEC-013: Standardize interface icons and persist collection icon keys

Date: 2026-07-17
Status: Amended by DEC-033

### Context

The renderer mixed Lucide and Tabler icons even though shadcn was configured for Tabler. User-created
collections also shared one folder glyph, making similarly named project destinations harder to scan.

### Decision

Use Tabler for all application icons. Collections may persist an optional icon key from a curated,
application-owned allow-list. The main process validates renderer requests, and the renderer maps
validated keys to imported Tabler component objects.

### Consequences

- Existing collections without an icon remain schema-version-1 compatible and display the default folder.
- Unknown icon values fall back safely without hiding or rewriting collection metadata.
- Arbitrary SVG, icon component names, custom colors, and the full upstream catalog are not persisted or exposed.
- Changing icon libraries later requires updating one renderer registry while keeping stable stored keys.

## DEC-014: Restore validated Explorer reveal from item details

Date: 2026-07-18
Status: Accepted

### Context

DEC-012 removed Explorer actions to keep card browsing focused, but Kuskus's local-first promise
requires users to reach each item's authoritative library files. The detail viewer provides a
contained place for this secondary native action without adding file-manager chrome to cards.

### Decision

Supersede DEC-012 only for Explorer reveal. Every item detail exposes **Show in Explorer** through
a narrow item-ID IPC operation. The main process validates the item ID against the open library,
resolves the path itself, and reveals local content when it exists. URL items and missing-content
items reveal their authoritative `item.json`. Cards remain free of Explorer controls, and local
files are not opened directly from the renderer.

### Consequences

- Users can move from an in-app detail to the corresponding user-controlled library file.
- The renderer never supplies or receives an arbitrary filesystem path.
- Missing-content items still reveal useful metadata for inspection and repair.
- URL opening remains a separate validated `http` or `https` operation.

## DEC-015: Name the masonry layout explicitly and replace List with Table

Date: 2026-07-18
Status: Accepted

### Context

The original **Visual** label did not describe its masonry layout, and the original **List** mode
rendered card-like rows instead of a semantic data table.

### Decision

Supersede the view naming and compact-mode presentation in DEC-006. The user-facing modes are
**Masonry**, **Grid**, and **Table**. Table uses semantic rows with Name, Type, and Added columns,
while Add Item remains a standalone full-width card above it. The renderer migrates the legacy
stored `list` preference to `table` without changing authoritative library data.

### Consequences

- Masonry remains the default responsive, format-aware card layout.
- Table provides a compact, keyboard-accessible retrieval view without introducing sorting,
  pagination, or a new data dependency.
- View preference compatibility remains renderer-local; IPC and storage contracts are unchanged.

## DEC-016: Summon capture from the toolbar and bundle local images with Markdown notes

Date: 2026-07-19
Status: Superseded in attachment placement and lifecycle by DEC-040

### Context

The permanent Add Item tile competed with saved content after direct paste and drag-and-drop became familiar. The modal editing state also separated capture from the visual library. Notes could retain text drafts, but an image pasted after writing began could not remain part of the same portable Markdown item.

### Decision

Supersede the resting capture presentation in the golden workflow and DEC-015. A primary toolbar action summons one normal-width draft card at the beginning of the content view; no capture tile remains when the card is hidden. Direct paste and drop summon the same card, and successful capture morphs it into the saved card.

Supersede DEC-009 for binary draft recovery. Markdown text remains in library-scoped renderer storage. Images added after note text begins are validated and staged under `.kuskus/temp/note-draft/`, then atomically finalized as `assets/` files beside `note.md`. Additive attachment metadata maps stable attachment IDs to safe relative filenames. Saved and staged previews are requested through item and attachment IDs rather than renderer paths.

### Consequences

- The resting canvas contains only saved content while capture remains available from the toolbar and direct paste.
- Empty-card images remain standalone image items; images added after Markdown begins become portable relative references.
- Legacy schema-version-1 notes remain valid with an empty attachment list and require no migration.
- Missing individual attachments render an inline warning without hiding readable note text.
- Draft text and images recover across ordinary restarts; successful commit or explicit discard clears staged files.
- PDFs and generic files remain in their existing milestone and can reuse the same draft-card state machine later.

### Revisit when

Dogfooding shows that normal card width is insufficient for quick notes, one draft per library prevents useful parallel capture, or accumulated draft assets require a broader cleanup policy.

## DEC-017: Edit saved Markdown through guarded item updates

Date: 2026-07-21
Status: Accepted

### Context

Saved notes were rendered by a small line-based preview and could only be changed by editing
`note.md` outside Kuskus. Adding in-app editing must preserve user-readable files, existing note
assets, renderer sandboxing, and external edits made after the detail view opened.

### Decision

Render note Markdown with a standards-based renderer and the vendored shadcn Typeset stylesheet in
cards and details. Note details provide explicit Edit and Preview modes; Preview follows the current
draft, while only Save or `Ctrl+Enter` writes to disk. The renderer sends an item ID, new Markdown,
and the Markdown version it opened through the typed preload API. The main process rejects stale
updates and swaps a staged complete item directory into place with startup recovery. This slice edits
text only and preserves the existing attachment manifest and assets.

### Consequences

- Raw HTML remains disabled and external links continue through the validated URL operation.
- Closing or navigating away from a dirty edit requires an explicit discard decision.
- Interrupted updates recover to the prepared version or the previous complete item.
- Adding or removing saved-note attachments remains a separate future slice.

## DEC-018: Edit saved Markdown in a WYSIWYG canvas with guarded autosave

Date: 2026-07-21
Status: Accepted

### Context

DEC-017 proved safe saved-note updates but exposed Markdown in a textarea and required a separate
Preview mode and explicit Save. The intended writing experience keeps rendered structure visible
while editing without weakening local-file authority or stale-write protection.

### Decision

Supersede DEC-017's editor presentation and explicit-Save behavior. Use one Markdown-backed Milkdown
canvas for Read and Edit, toggleable with `Ctrl+E`. Edit hides ordinary Markdown markers and exposes
contextual formatting controls. Renderer changes autosave after approximately 800 ms; `Ctrl+Enter`
flushes immediately, and close or item navigation waits for pending persistence.

Each autosave continues to send the last confirmed Markdown as its expected version. Autosaves are
serialized and coalesced so an older response cannot replace a newer draft. A conflict returns the
authoritative disk snapshot, pauses autosave, and requires the user to review a side-by-side Markdown
diff before choosing either version. Raw HTML and unsupported documents remain readable but do not
enter the rich editor. Existing attachment assets are preserved; adding saved-note attachments remains
deferred.

### Consequences

- Merely opening a note or toggling modes never writes it; the first real WYSIWYG edit may normalize
  harmless Markdown source formatting while preserving meaning.
- Routine note autosave is implicit: Saved, Saving, and pending states add no header chrome. Invalid,
  failed, and conflicted states remain visible because they require user action.
- The existing recoverable item-directory swap remains the authoritative write transaction.
- Read and Edit preserve one editor instance, scroll position, selection, and undo history.

## DEC-019: Own contextual editor presentation with React and shadcn

Date: 2026-07-22
Status: Accepted

### Context

Crepe's bundled slash menu and selection toolbar are Vue-rendered implementation details. They do
not compose with the application's React shadcn primitives, and their icon-only controls do not
provide the accessible names, focus treatment, or compact grouped presentation required by Kuskus.

### Decision

Milkdown remains responsible for Markdown state, selection anchoring, commands, and undo history.
Kuskus supplies React plugin views for the selection toolbar and slash menu, composed from local
shadcn Command, Toggle, Tooltip, Separator, and keyboard primitives. Plugin-scoped handlers operate
only while their overlay is active, and semantic editor color tokens provide a caret and focus ring
with at least 3:1 adjacent contrast in both themes.

### Consequences

- Contextual controls share the established theme, Tabler icons, hit areas, and accessibility model.
- Crepe's block handle, link editor, table controls, math editor, and document behavior remain intact.
- Overlay lifecycle code must mount and destroy React roots with the Milkdown editor instance.
- No storage, IPC, autosave, conflict, or Markdown compatibility contract changes.

## DEC-020: Add explicit Markdown Source mode and reserve modal title-bar controls

Date: 2026-07-22
Status: Accepted

### Context

Read and Edit intentionally hide Markdown markers, but direct source access is still useful for
precise local-file editing and for documents that the rich editor refuses to load. Item-detail
surfaces also covered the frameless Windows title bar, making its window controls unreachable.

### Decision

Replace the Read/Edit toggle with a shadcn Select containing Read, Edit, and Source. Source edits the
same autosave draft as Milkdown but is never entered by `Ctrl+E`; that shortcut toggles Read and Edit
and returns Source to Read. Source changes use the existing validation, serialized autosave,
conflict, and guarded-leave pipeline. Raw HTML remains excluded from Milkdown but editable in Source.

Keep the detail dialog modal while constraining its backdrop and surface below the 48-pixel title
bar. Render the existing typed Windows controls inside the dialog portal, and route its close action
through the pending-save guard. Headings render uniformly bold without visually applying nested
bold, italic, inline-code, or strikethrough marks; those source markers are preserved, and the
corresponding WYSIWYG toolbar actions are hidden for heading selections.

Amendment (2026-07-28): Heading-specific inline-formatting restrictions are removed. Bold, italic,
inline-code, and strikethrough render consistently across cards, Read, and Edit. Unformatted
headings use a 400 weight, nested bold uses a 700 weight, and all four WYSIWYG toolbar actions remain
available for heading selections. Markdown remains authoritative, so existing formatted headings
require no migration.

### Consequences

- No storage schema, IPC, preload, or main-process changes are required.
- Safe Source drafts are synchronized into the existing Milkdown instance before returning to Read
  or Edit; unsupported drafts stay in Read or Source until made safe.
- The underlying toolbar remains inert while item details are open, but Windows window management
  remains reachable without risking an unflushed note close.

## DEC-021: Scope detail presentation and keyboard ownership to the modal

Date: 2026-07-22
Status: Accepted

### Context

Keeping DEC-020's backdrop below the title bar left the application toolbar visually outside the
modal even though its actions were inert. Detail content also mixed native overflow containers with
the library's Base UI ScrollArea, the custom selection toolbar could overlap Milkdown's link input,
and window-level workspace shortcuts could still respond to editor key combinations.

### Decision

Supersede DEC-020 only for backdrop placement. Cover the complete window with the standard backdrop
token and no blur, while keeping the detail-owned guarded Windows controls above it and the detail
surface below the title bar. Use the shared shadcn ScrollArea for every user-facing detail scroll
owner.

Workspace-level shortcut listeners accept an enabled state and ignore handled events; the workspace
disables them while any item detail is open. Detail-owned and Milkdown-native shortcuts remain
active. Activating Link from the custom selection toolbar hides that toolbar before invoking
Milkdown's link command and does not steal focus back from the link input.

### Consequences

- The toolbar and content read as one modal background without introducing a blur layer.
- Editor formatting takes priority over sidebar and search shortcuts until the detail closes.
- Link editing and selection formatting are mutually exclusive overlays.
- Storage, preload, IPC, autosave, conflict, and Markdown contracts remain unchanged.

## DEC-022: Use Windows caption glyphs for guarded window controls

Date: 2026-07-22
Status: Accepted

### Context

Kuskus keeps renderer-owned window controls so the item-detail autosave guard can intercept Close,
but generic application icons made those controls look unlike the Windows caption buttons they
replace.

### Decision

Keep the existing narrow typed window IPC operations and guarded Close path. On Windows, render the
controls with Microsoft's documented Segoe Fluent `ChromeMinimize`, `ChromeMaximize`,
`ChromeRestore`, and `ChromeClose` glyphs, with Segoe MDL2 as the older-Windows fallback. Match the
Windows caption-button dimensions and light/dark interaction fills, including the standard red
Close hover and pressed states. These operating-system caption glyphs are exempt from DEC-013's
Tabler-only application-icon rule; non-Windows frameless controls retain Tabler glyphs.

### Consequences

- Window controls visually match Windows while pending note persistence can still delay Close.
- Maximize and Restore continue to reflect the main-process window state.
- Caption rendering depends only on fonts bundled with supported Windows versions and falls back to
  Segoe MDL2 where Segoe Fluent Icons is unavailable.
- The renderer still exposes no arbitrary native window or filesystem operation.

## DEC-023: Confirm detected captures before authoritative item creation

Date: 2026-07-22
Status: Accepted

### Context

DEC-016 made an empty-card image or standalone URL save immediately after paste. Dogfooding showed
that this made paste feel like an irreversible command and left the composer's Save action
inconsistent across detected types.

### Decision

Supersede DEC-016 only for commit timing. URLs, clipboard images, and dropped images are detected and
staged in the summoned draft card but do not create an authoritative item until **Save link**,
**Save image**, **Save note**, or `Ctrl+Enter` confirms the detected result. Direct canvas paste and
drop summon the same populated confirmation state.

Text and URLs remain library-scoped renderer drafts. Image bytes use the existing validated
`.kuskus/temp/note-draft/` bundle for compatibility. The renderer commits a standalone image by
attachment ID; the main process revalidates the staged bytes, atomically creates the image item, and
clears the bundle only after success. Adding text or another image converts an image candidate into
a Markdown note in input order.

### Consequences

- Paste and drop never create an Inbox item without an explicit confirmation.
- Image, link, and note drafts survive hide, library switching, and restart without becoming
  authoritative content.
- Failed commits retain the draft for retry or explicit discard.
- URL metadata enrichment begins only after the URL item is committed.
- The legacy temporary directory name remains an internal compatibility detail; no library schema
  migration is required.

## DEC-024: Separate Archive from Trash and infer item location from authoritative directories

Date: 2026-07-22
Status: Accepted

### Context

Folders previously persisted metadata but did not provide real item destinations, and item-native
operations assumed every item lived in Inbox. Deletion also needs a recoverable intent distinct from
keeping inactive material outside active browsing.

### Decision

Keep folders flat. Add authoritative `archive/` and existing `trash/` locations beside Inbox and
collection item directories. The parent directory determines current location; compatible additive
metadata records the collection used for unarchive and whether a trashed item came from Inbox, a
collection, or Archive. All Items includes only active Inbox and collection content.

Item directory moves use validated item IDs and recoverable batch manifests under `.kuskus/temp/`.
The main process resolves every item location before filesystem, preview, autosave, enrichment, or
Explorer operations. Manual rename writes a custom display title marker and never changes the stored
content filename.

### Consequences

- Archive intentionally retains hidden content; Trash remains the path to permanent deletion.
- Restore returns to the immediately previous location, with Inbox as the safe fallback when a
  previous collection no longer exists.
- Multi-item moves cannot silently settle in a partial state after restart.
- Existing schema-version-1 items remain valid because lifecycle and title markers are additive.
- The renderer continues to receive no arbitrary filesystem paths.

## DEC-025: Cache validated rich-link assets behind an intermediary saving card

Date: 2026-07-22
Status: Accepted

### Context

URL metadata stored remote preview URLs, but the renderer Content Security Policy correctly blocked
those images. Link confirmation also exposed only button-level progress before changing card shape,
which did not communicate the network-backed preview work.

### Decision

After **Save link**, replace the composer with a same-slot saving card. Create and register the
authoritative bookmark first, then show **Preparing preview** while metadata and the first preview
attempt run. Release the intermediary after success, fallback, or 12 seconds, with a 500 ms minimum
successful duration.

Fetch HTML heads and remote image candidates only in the main process. Resolve and reject private or
reserved network destinations before each request and redirect, enforce redirect, time, byte, MIME,
signature, and dimension limits, and cache validated raster or ICO bytes under
`.kuskus/thumbnails/<item-id>/`. The renderer requests preview bytes by item ID and asset kind; it
never receives the remote asset URL or an arbitrary local path. Additive metadata version 2 records
site name and webpage/video classification, and legacy URL items re-enrich once.

### Consequences

- Link saving remains durable before network work and failures still produce valid bookmarks.
- The renderer CSP remains unchanged, while cached previews work offline and can be rebuilt.
- URL moves do not move cache files because item IDs address the library-level cache.
- Permanent deletion removes matching cache entries on a best-effort basis.
- Notes and images retain their existing save transition.

## DEC-026: Preserve source order across Masonry columns

Date: 2026-07-28
Status: Accepted

### Context

CSS multi-column layout filled each column from top to bottom, so Masonry displayed the same item
sequence differently from Grid, Table, keyboard focus, range selection, and detail navigation.

### Decision

Masonry keeps the authoritative renderer item order and assigns successive visible cards across
responsive columns from left to right. Card positions are measured in the renderer so each column
retains natural card heights. Predictable cross-view ordering takes priority over placing every next
card in the currently shortest column.

### Consequences

- Masonry, Grid, Table, keyboard order, selection, and detail navigation share one item sequence.
- Unequal card heights may leave column bottoms uneven.
- Card and container size changes require a local layout recalculation but do not affect storage,
  IPC, or authoritative item ordering.

## DEC-027: Keep library sorting as renderer-local presentation state

Date: 2026-07-28
Status: Accepted

### Context

Browsing needed ordering beyond the fixed newest-first scan order. Sorting changes only how
already-loaded items are presented; it must not weaken the single shared item sequence from DEC-026
or add storage and IPC surface.

### Decision

Sort the filtered visible items in the renderer with a pure comparator. The supported orders are
newest first (default), oldest first, title A-Z, title Z-A, and grouping by item type, with
deterministic tiebreakers (added date, then item ID) so keyboard order, range selection, and detail
navigation stay stable. The preference persists in renderer-local storage and applies uniformly to
Masonry, Grid, and Table. A newly saved item joins its sorted position and is scrolled into view
rather than always appearing first.

### Consequences

- No preload, IPC, schema, or storage-contract changes.
- The main-process newest-first scan order remains the neutral base order.
- The golden workflow's "newly saved items appear first" rule now describes the default sort only.
- Table rows reorder through the same control without column-header sorting.

### Revisit when

Dogfooding asks for per-destination sort preferences, additional sort keys such as last edited, or
column-header sorting in Table view.

## DEC-028: Route user feedback toasts through a shared notify module

Date: 2026-07-28
Status: Accepted

### Context

Toast calls were assembled ad hoc at each call site, so every notification rendered the same
generic success icon regardless of the operation, and undoable operations re-implemented the same
action-button pattern with inconsistent durations and copy.

### Decision

All user feedback toasts flow through `src/renderer/src/lib/notify.tsx`, which maps each library
verb (archive, trash, restore, rename, delete, open link) to a distinct Tabler icon and owns copy,
durations, and the Undo affordance. Undoable toasts expose the persisted reversal both as a toast
action button and as a renderer-wide Ctrl+Z shortcut that is active only while an Undo toast is
visible and never intercepts editable targets, menus, or dialogs. Raw `toast.*` calls are reserved
for the notify module.

### Consequences

- Adding or restyling a notification is a one-file change; call sites pass only domain data.
- The undo shortcut stack lives in the renderer and tracks at most the visible Undo toasts.
- The countdown affordance is presentational only; the Sonner dismiss timer remains authoritative.

## DEC-029: Edit saved notes as plain Markdown

Date: 2026-07-28
Status: Accepted

### Context

The Milkdown canvas kept Markdown authoritative but introduced a second block-based document model,
source normalization, asynchronous editor lifecycle, and contextual controls. Saved-note editing
needs direct, predictable access to the same user-readable text already stored in `note.md`.

### Decision

Supersede DEC-018 and DEC-019 for editor presentation, DEC-020 for note modes, and DEC-021 for
Milkdown-specific keyboard and overlay behavior. Saved notes provide Read and Markdown modes behind
a visible segmented control; `Ctrl+E` toggles between them. Read uses the existing sanitized
standards-based renderer with GFM, soft-break, math, and local-attachment support. Markdown uses a
controlled monospace textarea and saves its value without normalization.

Remove Milkdown, block handles, slash commands, and floating or fixed formatting toolbars.
`Ctrl+B` and `Ctrl+I` remain local to the textarea and toggle Markdown emphasis markers.
The autosave debounce, immediate `Ctrl+Enter` flush, stale-write check, conflict review, guarded
navigation, and item-ID-based storage operation from DEC-018 remain unchanged.

### Consequences

- Existing `note.md` files and attachments require no migration and are not rewritten merely by
  opening a note or switching modes.
- Raw HTML remains editable and persistable but is not executed by the Read renderer.
- The renderer no longer carries a block-editor dependency, document model, overlay lifecycle, or
  editor-specific theme layer.
- No storage schema, preload, IPC, or main-process changes are required.

## DEC-030: Add highlighted source and linked split presentation

Date: 2026-07-28
Status: Accepted

### Context

DEC-029 removed the block editor and restored exact Markdown editing, but its uniform textarea did
not provide source hierarchy or a way to compare source with the rendered result while writing.
The text mode control also consumed more header width than the adjacent icon-led detail controls.

### Decision

Extend DEC-029 with renderer-local Read, Markdown, and Split modes behind a compact icon segmented
control aligned beside detail navigation. `Ctrl+E` retains the Read/Markdown transition, while
`Ctrl+Shift+E` toggles Split and restores the previous single-pane mode. Below the desktop breakpoint,
Split remains selected but presents Markdown only.

Replace the native textarea with a focused CodeMirror 6 configuration using the GFM parser, exact
controlled-string synchronization, local undo history, emphasis shortcuts, restrained token color,
and heading-scaled source typography. Split composes that editor with the existing sanitized
`MarkdownPreview`; either pane drives the other by guarded proportional scrolling.

Amendment (2026-07-29): Every CodeMirror document-changing transaction publishes the complete
authoritative string to the shared autosave draft, including external history-free synchronization;
duplicate values are harmless because the coordinator is idempotent. Split scroll mirroring is
animation-frame throttled, tracks the active source or preview driver, and recalculates after draft,
content-size, or pane-size changes.

Amendment (2026-07-29, pane parity): The editor uses the app-native `::selection` instead of
CodeMirror's drawn selection layer, so selected text looks and behaves identically in source and
preview, focused or not. The source scroller deliberately avoids the standard `scrollbar-width` /
`scrollbar-color` properties (rendered by Chromium as a flat thin thumb) and instead uses the same
webkit scrollbar metrics as the shared `ScrollArea` (10px lane, 8px rounded border-colored thumb,
transparent track, no buttons). The source scroller always spans its pane; the Markdown text column
centers itself at `max-w-3xl` inside `.cm-content`, so single-pane Markdown mode keeps the scrollbar
at the pane edge exactly like Read mode. The autosave coordinator revives on `subscribe`: React
StrictMode
runs effect cleanup and setup on the memoized coordinator in development, and a live subscription
therefore restores `disposed` instances and re-arms any dirty-draft autosave instead of silently
ignoring all future edits.

### Consequences

- CodeMirror is a renderer dependency and an editing surface only, not a block or document model.
- Source highlighting, heading scale, and split position never change saved Markdown bytes.
- Read, Markdown, and Split share one autosave draft and the existing validation, conflict, and
  guarded-leave pipeline.
- Split preview updates are immediate; the existing debounce applies only to persistence.
- No storage schema, preload, IPC, main-process, attachment, or preview-renderer changes are required.

## DEC-031: Make ordinary vault files authoritative

Date: 2026-07-29
Status: Accepted

### Context

Schema v1 made stable UUID packages authoritative. Although recoverable, the physical library was
difficult to browse in Explorer and could not be shared live with an Obsidian vault without an
import/export synchronization layer.

### Decision

Supersede DEC-003, DEC-011, and DEC-022 wherever they prescribe UUID-named visible directories,
flat collections, metadata-backed titles, or package-directory lifecycle moves. Schema v2 treats
visible filenames as titles, ordinary nested folders as collections, and Markdown or binary files
as authoritative content. Stable item and collection identities, timestamps, fingerprints, icons,
and recovery state live in human-readable records under `.kuskus/`.

Kuskus and Obsidian may co-own the same folder. Kuskus preserves existing YAML with a
comment-preserving parser, adds only its namespaced properties, ignores `.obsidian`, uses companion
assets for new attachments, safely resolves core Obsidian links, and reconciles external edits from
the main process. Initialization is explicit. Schema-v1 migration builds and verifies a sibling
vault before swapping paths and permanently retaining the original as a timestamped backup.

### Consequences

- Explorer and Obsidian edits immediately change Kuskus titles and organization after reconciliation.
- Renames and moves are validated filesystem operations; renderer contracts remain ID based.
- Binary identity is inherently ambiguous after an offline rename plus content edit, so Kuskus does
  not guess when fingerprints are duplicated.
- Hidden records and previews are rebuildable support data, never the sole readable representation.
- Older libraries require the guided migration; unsupported newer schemas and repair conflicts do
  not receive automatic destructive rewrites.

## DEC-032: Keep Kuskus identity out of visible files

Date: 2026-07-29
Status: Accepted

### Context

DEC-031 initially placed a stable UUID in every Markdown file. That made offline rename recovery
stronger but made an otherwise ordinary vault visibly dependent on Kuskus and rewrote notes merely
to index them.

### Decision

Supersede DEC-031 wherever it adds Kuskus-owned YAML. Normal Markdown remains byte-for-byte user
content. Web bookmarks use Windows `.url` Internet Shortcuts, while stable identity and enrichment
metadata remain under `.kuskus/records/`. Reconciliation uses exact relative path, unique filesystem
identity, then unique content fingerprint; ambiguity creates a new identity rather than guessing.

On the first compatible launch, automatically remove legacy Kuskus YAML only after creating a
checksummed recovery copy. Convert blank generated bookmarks to `.url`; leave bookmarks with
user-authored properties or body content unchanged and report them for repair.

### Consequences

- Opening or initializing a vault does not modify ordinary Markdown.
- Explorer can open bookmark files directly in the default browser.
- `.url` bookmarks are visible in the vault but do not behave as Obsidian Markdown notes.
- An offline copy-delete move combined with a content edit can receive a new Kuskus identity.
- Cleanup recovery copies are retained and never removed automatically.

## DEC-033: Keep folder navigation text-first without deleting icon metadata

Date: 2026-07-29
Status: Superseded by DEC-035

### Context

Custom collection glyphs added visual noise to the nested folder tree and competed with disclosure
chevrons, names, counts, and row actions.

### Decision

Do not render or offer editing for collection icons in the folder navigation or folder dialogs. Keep
the existing validated icon field, IPC operation, stored values, and renderer registry intact for
backward compatibility. New folders use the existing default icon value.

### Consequences

- Folder hierarchy is communicated through disclosure controls and indentation instead of glyphs.
- Opening or editing a library never removes previously stored collection icon values.
- Icon presentation can be restored later without a storage migration.

## DEC-034: Reuse the main window and composer for global capture

Date: 2026-07-29
Status: Superseded by DEC-038

### Context

Fast capture needs an entry point from other applications, but a second capture window or an
automatic clipboard-save path would duplicate draft state, detection, recovery, and native
boundaries.

### Decision

Register fixed `Ctrl+Shift+Space` ownership in the Electron main process while Kuskus is running.
The shortcut restores and focuses the single main window, then sends one typed preload event that
selects Inbox and summons the existing New Item composer. Preload queues an early request until the
renderer subscribes. Clipboard reads and authoritative writes remain explicit renderer actions.

Use one application process so a second launch focuses the existing window instead of competing for
the shortcut or active vault. Registration status is read through the narrow window bridge and is
shown in Settings; collisions remain recoverable and do not prevent app startup.

### Consequences

- Global capture inherits the existing recoverable draft and confirmation behavior.
- Closing Kuskus unregisters the shortcut; tray residency, launch-at-login, customization, and a
  separate quick-capture window remain out of scope.
- Foreground details and dialogs retain ownership when capture is summoned; the composer is prepared
  behind them without forcing a close or save.

## DEC-035: Treat nested folders as aggregate visual scopes

Date: 2026-07-29
Status: Accepted

### Context

Vault-native storage makes ordinary nested directories authoritative, but the initial text-only tree
provided weak recognition, direct-only parent views, ambiguous flat move menus, and no drag-based
organization. Those gaps made routine filing slower than the visual library workflow requires.

### Decision

Supersede DEC-033's presentation restriction. Render the existing validated collection icons and
restore their picker while retaining compact rows, restrained contrast, separate disclosure controls,
names, recursive counts, and right-click actions. Selecting a folder uses its complete subtree as the
browsing, search, selection, and count scope; capture still targets the exact selected folder.

Items and multi-selections use a renderer-owned drag payload and may be dropped on Inbox or a folder.
Folder moves use a separate payload and one validated ID-only main-process operation for menu and drag
interactions. The operation preserves identity, refuses self/descendant targets, resolves destination
name collisions, and rewrites descendant collection and item paths with in-process rollback.

### Consequences

- Parent folders work as project-level visual views without flattening the vault on disk.
- Internal organization drags cannot be mistaken for external file-import drags.
- Folder icons improve recognition without becoming arbitrary SVG or color metadata.
- Folder move failures retain the source directory and records; crash-recovery manifests remain a
  future reliability hardening beyond the current in-process rollback used by collection rename.

## DEC-036: Apply optional Windows Mica through the typed window boundary

Date: 2026-07-30
Status: Superseded by DEC-037

### Context

Kuskus benefits from calmer separation between its navigation chrome and visual library, but a
fully transparent Electron window weakens standard resizing and maximizing behavior. The appearance
must remain optional, readable, and independent from authoritative vault content.

### Decision

On Windows 11 build 22621 or newer, enable the system-drawn Mica background by default and expose a
persisted **Translucent background** preference in Settings. The renderer sends only a validated
boolean through the typed window bridge; the main process determines platform support and applies
`mica` or `none`. Renderer material tokens keep the sidebar structurally heavier while the toolbar
and content canvas share one continuous material without stacking translucent layers. Cards and
popup surfaces remain solid.

Unsupported platforms retain the opaque theme. Reduced-transparency, increased-contrast, and
forced-color media preferences also resolve the renderer surfaces to opaque colors without changing
the stored choice. Electron's `transparent: true` window mode is not used.

### Consequences

- Window resizing, maximizing, caption controls, and the existing sandbox boundary remain intact.
- The preference is disposable renderer-local presentation state and does not change the vault or
  library schema.
- macOS vibrancy and Linux compositor materials remain separate future platform work.

## DEC-037: Use Acrylic and selective shell transparency on Windows

Date: 2026-07-30
Status: Accepted

### Context

The initial Mica treatment preserved the frameless window behavior but remained visually close to an
opaque dark surface. Mica is a restrained wallpaper-tinted base material, and the renderer's heavier
canvas and sidebar tints obscured most of that effect. The desired reference uses Acrylic with lower
surface opacity and reserves solid colors for content-bearing surfaces.

### Decision

Supersede DEC-036's choice of Mica while retaining its typed preference boundary, supported Windows
version, startup behavior, and accessibility fallbacks. Apply Electron's system-drawn `acrylic`
background material when translucency is enabled. Use one lower-opacity renderer material for the
toolbar and workspace and a slightly heavier sidebar tint. Material-specific semantic tokens give
borders, cards, and sidebar interaction fills restrained translucency; dialogs, popovers, inputs,
and previews remain solid. Folder selection uses the same fill and typography as other sidebar
destinations without a folder-only ring. Continue to avoid Electron's `transparent: true` mode and
retain the custom frameless caption controls.

Amendment (2026-07-30, integration boundary): A renderer-local window-material controller owns the
versioned presentation preference, migration from the original local-storage key, root
`data-window-material` state, native synchronization, last-request-wins ordering, and rollback after
native failure. The React hook only subscribes to the controller snapshot and exposes the checkbox
interface. Acrylic token substitutions, shell selectors, and accessibility fallbacks live in a
dedicated renderer stylesheet rather than the base theme. The main process remains authoritative
for platform support and native material changes.

Amendment (2026-07-30, quick capture): The separate quick-capture BrowserWindow is the exception to
the solid popup-surface rule. On Windows 11 22H2 and newer it uses native Acrylic independently of
the main-window preference when system Transparency effects are available, with a 38-percent
composer tint over the native material. Native Windows frame geometry owns anti-aliased outer
clipping; the renderer fills that geometry without a competing radius, transparent gutter, external
border, shadow, or simulated CSS desktop blur. Unsupported platforms retain CSS-clipped opaque
rounding. Reduced-transparency, increased-contrast, and forced-color modes paint an opaque surface.
The typed material status distinguishes OS support from reduced transparency, preserves the user's
stored preference while blocked, and reapplies both windows when Electron reports a native-theme
change.

### Consequences

- The desktop color and Acrylic texture remain visible through the shell and lightly through cards
  without weakening higher-priority dialog, input, popover, or preview surfaces.
- Toolbar and workspace no longer read as differently colored horizontal bands.
- The sidebar remains distinguishable through material weight rather than an opaque panel color.
- Navigation hover and active states remain consistent across folder and non-folder destinations.
- Acrylic behavior on resize, maximize, restore, focus, and custom caption controls requires focused
  Windows verification because the native material is more sensitive than Mica on frameless windows.
- Disabling translucency and all accessibility media fallbacks reproduce the existing opaque theme.

## DEC-038: Present global capture in one shared-session popup

Date: 2026-07-30
Status: Accepted

### Context

DEC-034 avoided duplicated capture state by restoring the complete main window. In real use, that
application switch interrupted the source task even though capture needs only the universal composer.
A second renderer surface is useful only if it cannot fork drafts, lose staged files, or commit twice.

### Decision

Supersede DEC-034's main-window presentation while retaining its fixed shortcut, explicit commit,
single process, registration reporting, and no-clipboard-read constraints. `Ctrl+Shift+Space` opens
one frameless, taskbar-hidden quick-capture window at the bottom-right of the pointer's monitor. The
main window remains unchanged unless the user explicitly continues a captured note in the full
editor. An unavailable library reveals the existing main recovery flow.

A main-process capture-session service persists revisioned text per library in app-local state and
broadcasts one active editing owner between the inline and popup renderers. Staged images remain in
the controlled vault temporary area; general files now stage there before commit as well. Typed IPC
exposes session, ownership, staging, validated popup sizing, hide, and main-window handoff operations
without renderer paths or arbitrary window bounds. Successful popup capture confirms for 650 ms and
hides after authoritative local persistence; continuing a note waits for that persistence, then
reveals the main window and opens the saved note in its live editor. Optional URL metadata continues
independently.

### Consequences

- Global capture no longer changes the main window's destination, filters, selection, dialogs, or
  visibility. The popup exposes no visible window actions; Escape and ordinary focus loss hide it,
  while the main-window handoff remains an internal recovery route when no usable library exists.
- Popup and inline capture are two presentations of one recoverable draft and cannot edit
  concurrently; the legacy local-storage text draft migrates on first use.
- General-file selection becomes durable staging rather than renderer-only `File` state, so window
  handoff and restart preserve it without modifying the external source.
- Closing the main window destroys the popup and quits normally on Windows. Tray residency,
  launch-at-login, shortcut customization, automatic clipboard reads, and multiple capture windows
  remain out of scope.

## DEC-039: Hand accepted captures to a durable FIFO queue

Date: 2026-07-31
Status: Accepted

### Context

The shared capture session kept its saving flag until an authoritative vault write completed. The
quick window could hide before then, but reopening it exposed the same busy composer. The single
note-draft and file-draft directories also meant that removing the flag alone would let a later
capture overwrite assets still needed by the earlier save.

### Decision

Save first snapshots the revisioned session into a submission with a reserved final item ID,
submission timestamp, and job-specific staged assets under `.kuskus/temp/capture-queue/`. A
crash-recoverable handoff resets the shared session only after that submission is durable. Quick
capture then hides immediately and may reopen with a fresh session.

A main-process FIFO worker serializes authoritative vault writes. Pending and processing submissions
resume after restart; the reserved item ID reconciles a crash after finalization without creating a
duplicate. URL enrichment begins only after the bookmark is authoritative and does not occupy the
queue. Failed submissions retain their immutable payload and expose Retry, Restore to composer, and
explicit Discard through a compact issue banner and main-window recovery view.

### Consequences

- Background saving does not own the shared session or prevent another quick capture.
- Notes, links, images, and files share one ordering and exact-once boundary.
- Submission timestamps, rather than variable filesystem completion times, define capture order.
- Temporary queue data may be the recovery copy until ordinary user-readable vault content is
  finalized; it is retained across restart and removed only after success or explicit discard.
- Active draft staging remains single-session and ownership protected, while accepted assets are
  immutable and isolated by submission ID.

## DEC-040: Store new note attachments as independent Obsidian-compatible files

Date: 2026-08-02
Status: Accepted

### Context

DEC-016 coupled pasted images to a generated `<note-name>.assets/` directory. That layout made the
files less natural in an ordinary vault, made independent image lifecycle actions unreliable, and
reduced interoperability with Obsidian vaults whose attachments may live beside a note, at the root,
or in shared and nested folders. Attachment placement may become user-configurable later, but the
current milestone must not introduce a setting or depend on `.obsidian` configuration.

### Decision

Supersede DEC-016's attachment placement and lifecycle while retaining its composer and recoverable
staging behavior. New pasted note images are collision-safe independent files beside the final note,
use their staged UUID as the stable item ID, and are embedded with standard URL-encoded relative
Markdown links. Markdown is authoritative for reference relationships; hidden records preserve
identity and validated paths without owning the relationship. Existing `.assets` notes and arbitrary
Obsidian attachment paths remain supported without migration, and `.obsidian` is never read or
modified.

All capture and storage callers use one main-process placement resolver. It accepts a validated vault,
final note path, candidate filename, and versionable policy. An absent policy resolves to
`same-folder`, the only current implementation. The boundary reserves future `vault-root`,
`specific-folder`, and `note-subfolder` strategies without adding a preference field, picker, UI, or
renderer capture-schema dependency now. Durable submissions snapshot their capture destination and
persist every resolved note and image path before background processing.

Independent lifecycle operations are reference-aware. Moving a note leaves images in place and
rewrites its relative embeds. Renaming, moving, archiving, or collision-restoring an image rewrites
inbound Markdown with rollback. Trash intentionally leaves references unchanged after a warning that
is guarded by an opaque reference revision. Permanent note deletion may offer an unchecked cleanup
of images with no remaining reference from active, archived, or trashed notes. Legacy companion
directories retain their coupled behavior.

Move **Show referenced attachments** from Settings to a persistent per-device Visibility filter.
Referenced items remain hidden by default; the value participates in the active-filter badge and
resets with **Clear filters**.

### Consequences

- New Kuskus notes use an ordinary layout that Obsidian can open without a generated attachment
  directory or Kuskus-specific link syntax.
- Attachment paths, preview lookup, scanning, reference rewriting, and deletion inspection cannot
  assume siblings or `.assets`.
- One balanced Markdown-image parser owns extraction and rewriting. Legacy unencoded destinations
  that standards renderers reject are repaired only in the presentation copy; source Markdown stays
  byte-for-byte unchanged.
- Schema-v1 `./assets/` capture placeholders remain readable and are normalized before a stale draft
  is displayed or a queued submission is finalized.
- Accepted captures cannot be redirected by a later folder or future placement-policy change.
- Image Trash is recoverable but may intentionally leave a visible missing embed until restore.
- Attachment-location settings remain feasible without promising them in the current milestone.

## DEC-041: Give sibling note images lightweight ownership

Date: 2026-08-03
Status: Accepted

### Context

Always leaving independent images behind made ordinary note moves surprising when referenced cards
were hidden. Generic clipboard filenames also made the ordinary vault harder to understand.

### Decision

Clipboard images receive a local-time timestamp name at staging and immediately expose the selected
stem for optional inline replacement; the detected extension remains fixed and generated Markdown
uses an empty alt. New names are snapshotted with durable capture submissions.

A note move automatically includes an indexed sibling image only when every inbound note is in the
same move. Shared, missing, untracked, and separately organized images remain in place with rewritten
relative links. Explicit image moves and renames always rewrite all inbound notes transactionally.
The interface reports moved, retained, and updated counts and exposes saved images from a note-level
Attachments panel.

### Consequences

- Common note-and-screenshot folders stay together without reorganizing deliberate shared layouts.
- Timestamp names remain predictable when capture is accepted without additional typing.
- Image lifecycle actions must flush valid note drafts and refuse unresolved conflicts before native
  rewrites.

## DEC-042: Render live Markdown with CodeMirror decorations

Date: 2026-08-03
Status: Accepted

### Context

DEC-029 and DEC-030 restored exact plain-Markdown editing after the Milkdown experiment introduced a
second document model and source normalization. Read, Markdown, and Split preserve source authority,
but writing still requires looking through source markers or at a separate preview. Capture also used
a native textarea, so its editing behavior differed from saved notes.

### Decision

Add an Obsidian-style Live mode backed by the existing CodeMirror 6 and Lezer GFM document. A view
plugin derives replace, mark, line, and widget decorations from the syntax tree and renderer-local
scanners; it never creates a second document model. Markdown markers remain visible on active lines
and are hidden elsewhere. Tasks, local images, math, links, wikilinks, quotes, lists, rules, and fenced
code receive in-place presentation or interaction where safe. Raw HTML and unsupported constructs
remain source.

Saved notes expose Read, Live, Markdown, and Split. `Ctrl+E` owns the primary Read/Live transition,
`Ctrl+Alt+E` toggles exact Markdown source, and `Ctrl+Shift+E` retains the Split transition. Replace
the capture textarea with a CodeMirror surface using the same live-preview extension while preserving
draft ownership, image-paste selection, explicit commit, keyboard commands, and quick-capture parity.
The rendered card, capture Live Preview, saved Read mode, and saved Live mode share one semantic
typesetting token set. Capture selects the compact 15-pixel card preset; saved Live selects the
16-pixel reading preset. Exact Markdown source and Split source retain their monospace presentation.

### Consequences

- Decorations never change Markdown bytes; autosave, stale-write checks, conflict review, guarded
  navigation, attachment storage, IPC, and main-process contracts remain unchanged.
- Every widget edit is a normal CodeMirror transaction, so undo history and the existing complete-text
  publication pipeline remain authoritative.
- The active line reveals source to keep caret movement, IME composition, and precise edits available.
- Shared card and reading presets keep heading hierarchy, body leading, emphasis, code, quotes, rules,
  lists, and images consistent without coupling the Markdown renderer to CodeMirror's document model.
  Wrapped composer placeholder text is presentation-only and does not contribute to the editable
  line's caret geometry.
- Markdown remains a first-class exact-source escape hatch, while Split retains source beside the
  sanitized renderer.
- Large notes build live decorations only for visible ranges and rebuild when the document, active
  lines, viewport, or attachment previews change.

## DEC-043: Add a guarded Focus master-detail view

Date: 2026-08-04
Status: Accepted

### Context

Masonry supports visual discovery and Table supports compact retrieval, but repeatedly opening and
closing a modal slows sequential review and long-form reading. A second independent detail
implementation would risk diverging autosave, conflict, attachment, and native-operation behavior.

### Decision

Add **Focus** beside Masonry, Grid, and Table. Focus presents a compact, resizable two-line item rail
beside the complete existing detail body. Extract the detail controller and content from its dialog
shell so modal and Focus presentations share note modes, guarded autosave, conflicts, attachments,
title editing, previews, and actions. This supersedes DEC-020 and DEC-021 only for the claim that all
item details must be modal; Masonry, Grid, and Table retain the modal presentation and its keyboard
ownership.

Focus keeps active-item state separate from bulk selection, persists only its renderer-local view
and rail-width preferences, and becomes list-first drill-in navigation below a 760-pixel content
width. New item uses a temporary first row and renders the shared recoverable composer in the detail
pane. Search and filters may hide the active row without discarding its detail, while explicit item,
destination, view, library, and window-close transitions pass through the note-save guard.

### Consequences

- Focus adds no IPC, preload, schema, native-operation, or authoritative vault state.
- Detail behavior has one controller and two shells rather than duplicated save logic.
- The item rail and detail pane scroll independently; a persisted keyboard-operable separator owns
  the wide-layout split.
- Workspace shortcuts remain available from the list and toolbar but ignore events owned by the
  inline detail surface.

## DEC-044: Scope retrieval chrome to each active view

Date: 2026-08-04
Status: Accepted

### Context

DEC-043 initially placed Focus below the same application toolbar as the visual canvas. Search,
sorting, filtering, and New item therefore appeared visually detached from the compact list they
controlled, while the detailed reading pane lost vertical space to canvas-oriented chrome. The
implemented Table view also lacked a settled retrieval and toolbar direction.

### Decision

Masonry and Grid retain the complete application toolbar with scoped Search, combined Sort and
Filter, and New item. Focus uses a minimal draggable title bar for the sidebar trigger and Windows
controls, while its item rail owns a destination header, Sort menu, scoped Filter field, type and
visibility filters, and New item. The same renderer retrieval state and capture session back both
presentations; keyboard shortcuts keep their existing guards.

Focus and modal note details share a prominent editable title header without a location picker or
Created/Updated metadata. Moving items stays in the item action menus and the bulk move control,
where Archive and Trash remain non-interactive read-only labels.

Table is unavailable pending a new product decision. Settings omit it, and persisted `table` or
legacy `list` preferences resolve to Masonry. Its renderer implementation remains in the repository
so reconsideration does not require reconstructing proven row behavior.

### Consequences

- The complete toolbar belongs only to Masonry and Grid; Focus retrieval controls remain attached
  to the list they affect.
- Focus retains a generous native drag region and guarded Windows close without duplicating window
  IPC or note-save logic.
- Sort, filters, search, capture drafts, and item moves continue to use shared state and validated
  item-ID operations.
- Table cannot be activated through Settings, persisted presentation state, or normal view changes.

## DEC-045: Make Focus a top-aligned visual master-detail view

Date: 2026-08-04
Status: Accepted

### Context

DEC-043's compact two-line rail reduced visual recognition, and DEC-044's separate minimal title bar
spent a full window row on one sidebar action. The opaque detail and composer surfaces also prevented
the Windows Acrylic material from remaining continuous through Focus.

### Decision

Supersede the compact-rail and separate-title-bar portions of DEC-043 and DEC-044. Focus starts its
rail and detail at the top of the window. The rail owns one integrated row containing the sidebar
trigger, scoped Search, combined Sort and Filter, and New item; Windows controls occupy the visible
detail pane or the full-width list row during narrow drill-in navigation.

Reuse the natural-height Masonry cards in an ordered, independently scrolling rail. Persist a
320-to-720-pixel width with a 420-pixel default and a 45-percent workspace cap. Ordered Masonry adds
columns only when each can retain at least 256 pixels. The active-detail accent remains distinct from
bulk selection, and the pane composer uses the first visual-card slot.

Focus uses a denser translucent rail material and a lighter detail material. Structural detail and
composer surfaces inherit that material, while dialogs, inputs, menus, editors, and media previews
remain solid. Reduced-transparency, increased-contrast, and forced-color modes keep opaque fallbacks.

### Consequences

- Focus and Masonry share one format-aware card implementation and one row-major visual order.
- Caption controls, detail actions, and draggable regions coexist without restoring a global header.
- The change adds no IPC, preload, schema, native-operation, or authoritative vault state.

## DEC-046: Use a rebuildable incremental read model for performance

Date: 2026-08-07
Status: Accepted

### Context

The schema-v2 scanner reread and hashed every visible file, rewrote unchanged records, and reloaded
the complete record directory once per note while resolving attachments. A 340-item mixed fixture
took 74.7 seconds for one refresh and did not complete a second refresh within 120 seconds. The
renderer also received complete note bodies and mounted every card at once.

### Decision

Keep visible vault files authoritative while adding `.kuskus/index/library-v1.json` as an atomic,
versioned, disposable snapshot. Records retain file size and modification signatures so unchanged
paths reuse metadata and fingerprints. Scans use bounded concurrency, stream changed-file hashes,
load records once, build shared attachment/reference maps, and write only changed records.

The main process owns a single-flight in-memory snapshot. Startup may return the validated cached
snapshot immediately and reconcile in the background; watcher and focus reconciliation publish the
new snapshot only after authoritative scanning succeeds. Renderer startup and refresh use
`LibraryOverviewDto` note previews, full item detail is requested by validated item ID, and full-note
search runs against the main-process snapshot. Visual and Grid views progressively mount ordered
100-item pages, while media previews share a bounded request queue and LRU object-URL cache.

Main and Quick Capture choose separate dynamic entry modules. The base font payload is limited to
the used Latin Inter variable WOFF2 with system serif and monospace fallbacks.

### Consequences

- Deleting or corrupting the index affects speed only; the next compatible read rebuilds it.
- External edits can briefly follow a cached paint but converge through startup, watcher, or focus
  reconciliation without weakening conflict or path-safety checks.
- Normal card/search IPC no longer requires complete note bodies, while detail editing still receives
  exact authoritative Markdown.
- Performance regressions are checked with temporary 100-, 1,000-, and 5,000-item fixtures rather
  than committed synthetic libraries.

## DEC-047: Deflate the eager renderer surfaces behind code-split boundaries

Date: 2026-08-07
Status: Accepted

### Context

The budget script found the main surface at 3.2 MB and Quick Capture at 2.7 MB of eager
JavaScript, plus 1.1 MB of font assets, because the Markdown/capture stack was bundled into the
startup graph of both windows. The perf budget could not detect this: `[...Set].map(basename)`
passed the array index to `path.basename` as its `suffix` argument and threw.

### Decision

- Fix the budget script to wrap the callback: `[...discovered].map((file) => basename(file))`.
- Load `AddItemComposer` lazily in both `workspace` and the Quick Capture entry so the Capture/CodeMirror
  stack leaves the startup graph; load `MarkdownPreview` lazily in note cards so `react-markdown` and
  KaTeX leave it as well. Each is a `React.lazy` import with a small `Suspense` fallback.
- Generate a woff2-only KaTeX stylesheet (`scripts/generate-katex-woff2-css.cjs` →
  `src/renderer/src/assets/katex-woff2.css`) and import that instead of `katex/dist/katex.min.css`,
  because the Electron renderer is Chromium-only and never fetches the `.ttf`/`.woff` fallbacks.

### Consequences

- Quick Capture drops to ~1.5 MB and leaves the markdown editor stack out of the startup window; the
  shared base-UI floating runtime (tooltip/dropdown/select) is still eager in the main surface, which
  stays above the 1.5 MB budget until it is also deferred.
- Font assets drop from ~1.1 MB to ~0.3 MB of woff2.
- Card note previews and the composer may paint a brief `Suspense` fallback on first load per session.

## DEC-048: Compact Focus rail cards and stretch the note reading canvas

Date: 2026-08-08
Status: Accepted

### Context

The Focus rail and Masonry already share the same card components, but the rail's wrapper added a
separate primary ring for the active item and rendered one very wide column at the default 420px
rail. The narrower pane made the masonry-sized content feel oversized, and the note reading canvas
was capped to a centered 768px column that did not use the available detail width.

### Decision

- Focus rail cards reuse the exact Masonry card surface and interactions (hover, press, accent
  halo). The focused item is passed the same masonry accent halo/checked indicator as a selected
  card; `data-active` and `aria-current` remain for accessible Active/Selected states.
- Add a renderer-local `compact` density to the shared item cards (notes, images, URLs, files) and
  a matching 13px compact Markdown typeset preset. The Focus rail opts in so its content reads
  smaller than Masonry, matching the narrower pane. Masonry and Grid keep their existing sizes.
- Remove the note reading width cap: drop the `max-w-3xl`/`mx-auto` note article in the detail
  surface and the `.kuskus-typeset` `max-width` so the note reads edge-to-edge with the existing
  responsive gutters. Masonry note cards are narrower than the old cap, so they are unchanged.

### Consequences

- The Focus rail and Masonry look and behave the same for hover, press, and activation.
- Compact card content is presentation-only and does not change card anatomy, ordering, or storage.
- Notes in Read/Live/Split use the full detail width in both the dialog and the Focus pane.

## DEC-049: Share a semantic control-height token across sidebar and toolbars

Date: 2026-08-08
Status: Accepted

### Context

In the Focus view the search field and square toolbar buttons used a 40px height while the sidebar
navigation rows (Inbox, All Items, folders) used 32px, so co-located interactive controls did not
read as one sizing system. The main toolbar additionally rendered the sidebar trigger at 40px next
to 32px controls. Component sizes were hardcoded spacing utilities at each call site, so any single
alignment fix would have required isolated pixel edits.

### Decision

Add a semantic control-height token family to the shared theme (`--control-height-xs/sm/md/lg/xl`,
driven by the existing `--spacing` scale, with `md` the standard 32px control height). The shared
primitives consume it in place of hardcoded heights: button and input sizes, sidebar menu buttons,
the sidebar group label, the sidebar input, and input-group buttons. Toolbar controls apply it too:
the shell sidebar trigger, the app-toolbar search field, and the Focus list header search and
icon buttons. No component compensates with per-control offsets or top-left margins; existing flex
alignment (`items-center`, `justify-center`) centers text and icons unchanged.

### Consequences

- Sidebar rows, square toolbar buttons, and search fields share one 32px `md` control height and
  the same vertical rhythm in the Focus, Visual, and Grid views.
- Adjusting the standard control size later is a one-line theme change instead of a component sweep.
- Button `size` variants keep their existing dense `xs/sm` and generous `lg` tiers with exact
  pre-change pixel values.
- Left in place: window caption controls stay 40px for a classic Windows title-bar hit target, and
  the floating bulk-action bar remains its own larger size.

## DEC-050: Align Focus detail navigation with the Windows caption bar

Date: 2026-08-08
Status: Accepted

### Context

In the Focus detail pane the previous, next, show-in-explorer, and more-actions utilities floated as
a rounded pill capsule with 40px circular ghost buttons, which did not share the geometry or
interaction language of the renderer-owned Windows caption buttons beside them (transparent flat
46px tiles with hover/active fills and an inset focus ring).

### Decision

- Extract the caption tile primitive as a shared `CaptionTileButton` reused by both the window
  controls and the Focus detail navigation.
- In Focus on Windows, previous, more actions, and next render as transparent 46x40 caption tiles
  flush against the left edge of the minimize/maximize/close strip, keeping the same hover fill,
  active fill, focus ring, and disabled dimming. Next/previous still flush guarded autosave first.
- Drop the dedicated Show in Explorer tile; it remains one click away under More actions.
- The note-mode segmented control and attachments toggle stay a separate floating pill above the
  note body rather than adopting caption styling. The modal detail dialog and macOS Focus keep the
  previous floating pill group unchanged.

### Consequences

- The Focus detail pane reads as one continuous title-bar surface with native-style navigation.
- Only one interaction language governs the top-right corner: caption tiles for window + navigation.
- Dialog and macOS presentations are untouched; platform-specific non-mac focus stays pill-based.

## DEC-051: Add a default Focus Index density

Date: 2026-08-09
Status: Accepted

### Context

The natural-height Visual rail preserves Kuskus's format-aware browsing, but it shows few items while
the adjacent detail pane already carries the complete preview. Sequential triage benefits from a
denser master list without removing the existing visual option or weakening mixed-format identity.

### Decision

- Add renderer-local `index` and `visual` Focus rail densities. Visual is the default for missing or
  invalid preferences; the selected density persists per device in a versioned localStorage key.
- Index uses text-first rows with a two-line title, independently spaced modified time and neutral
  type label, one line of format-appropriate supporting text, and useful details such as domain or
  image dimensions. Row height follows the title rather than forcing every item into one fixed size.
  It mounts no image or URL preview hooks; `content-visibility` still avoids unnecessary offscreen
  paint.
- Active detail and bulk selection remain separate semantic states through `aria-current` and
  `aria-pressed`. Index uses a calm active tint with a slim leading accent, while bulk selection uses
  a distinct inset outline. Visual retains its card treatment.
- The existing retrieval menu owns the density radio group. Capture, keyboard order, drag/drop,
  context menus, detail navigation, storage, IPC, and authoritative vault content remain unchanged.

### Consequences

- Focus Index supports recognition from titles and excerpts while Visual remains one menu choice away.
- The rail can represent large libraries without acquiring media previews for Index rows.
- No library migration, shared contract change, preload expansion, or new dependency is required.

## DEC-052: Replace structural CodeMirror live preview with a ProseMirror editor

Date: 2026-08-10
Status: Accepted

### Context

DEC-042 kept exact Markdown in CodeMirror and recreated rendered blocks with decorations. Lists,
tasks, wrapped lines, and active-line source reveal then required overlapping marker widgets and
layout exceptions. Dogfooding showed that fixing each combination moved another because CodeMirror's
flat editable lines do not provide the semantic list layout used by Read mode.

Gravity UI Markdown Editor was evaluated as the first packaged dual-mode candidate. Version 15.46.0
ships a 10.1 MB unpacked package, 48 direct dependencies, and mandatory Gravity UI, Diplodoc, and
Markdown-it peer stacks. Adopting a second UI system and document dialect to reuse its mode switch is
more coupling than implementing the application boundary with the underlying established engines.

A Milkdown 7.22.0 GFM round-trip against Markdown Lab confirmed the expected rich-editor trade-off:
lists and tables receive canonical formatting, reference links expand, and Kuskus wikilinks and math
need explicit schema support. Those transformations are acceptable only after a real rich edit;
unsupported syntax must never be silently serialized.

### Decision

- Use Milkdown's ProseMirror core for structured Read and Live surfaces. Integrate its core directly
  rather than `@milkdown/react`, whose current package also brings Crepe and the full kit.
- Keep the existing CodeMirror editor for exact Markdown and Split source.
- Keep Markdown as persisted authority. Opening, reading, and switching modes never serialize or
  save. A user-authored rich transaction may canonically format the editable Markdown body.
- Keep valid frontmatter byte-for-byte outside the rich document. Malformed frontmatter refuses rich
  editing and remains available in Markdown source.
- Add explicit Kuskus schema support for wikilinks, embeds, attachment targets, and math before those
  fixtures can enter rich editing.
- Retain `react-markdown` for note cards until measurements justify changing that lazy preview path.
- Remove the custom CodeMirror live decorations and their CSS after saved notes and capture complete
  the rich-editor acceptance fixtures. Do not preserve a fallback live renderer.

### Consequences

- Read and Live can share one semantic document tree and browser list layout instead of duplicating a
  renderer with line decorations.
- Rich and source modes keep separate selection, scroll, and undo histories and synchronize through
  Markdown only when ownership changes.
- Existing autosave, conflict detection, storage, IPC, attachment safety, and exact-source escape
  hatch remain unchanged.
- Rich editing is unavailable for malformed or not-yet-supported Markdown rather than risking data
  loss: such notes open in Markdown source automatically, with a non-blocking toast explaining why.
  CommonMark autolinks (`<https://…>`, `<mailto:…>`, `<user@…>`) are recognized as rich-editable
  since they round-trip byte-identically; raw HTML (including `<br />`) is never silently rewritten.

## DEC-053: Share a mode-agnostic note-editor seam across both note engines

Date: 2026-08-22
Status: Accepted

### Context

DEC-052 keeps the Milkdown rich editor for structured Read and Live while keeping CodeMirror for exact
Markdown and Split source, and lets the two synchronize through Markdown when ownership changes. The
detail dialog consequently addresses two different editor handles and branches on note mode to reach
the active one. The same mode-agnostic concerns — focusing the writing surface, capturing and restoring
the caret, and exposing a Vim mode contract — are re-wired twice against two engine-specific shapes,
and the split source + rich details stay coupled to whichever engine is mounted.

### Decision

Introduce one `NoteEditor` seam behind which both engines sit as adapters. The seam exposes only
mode-agnostic operations: `focus`, `getCursorOffset`/`setCursorOffset` (both defined as an offset into
the Markdown source string, which both engines already produce), and the single `NoteVimMode` +
`{ onModeChange, write, quit }` contract. The detail dialog owns one active adapter selected by note
mode and stops knowing which engine is mounted for those concerns.

Concerns that are inherently engine-specific stay local to their surface: split scroll synchronization
(which bridges the CodeMirror source scroller and the rendered preview), undo/redo, properties, inline
title editing, and conflict review are not moved behind the seam.

### Consequences

- The dialog wires focus, caret persistence, and Vim once instead of twice against two handle shapes.
- A later switch of either backing engine touches one adapter and leaves the dialog seam unchanged.
- Cursor persistence across note modes keeps its tested meaning: offsets are positions in the Markdown
  source string in both directions.
- Split scroll, undo/redo, and note-save behaviour remain unchanged.

## DEC-054: Keep provisional and persisted notes on one detail surface

Date: 2026-09-09
Status: Accepted

### Context

New Note used a dedicated creation header and editor, then replaced that tree with the saved-note
detail after the first meaningful edit. The replacement changed toolbar content, document padding,
rail presentation, focus ownership, and available keyboard commands at the moment the user began
writing. Creation errors inserted another layout-changing block above the editor.

### Decision

Render an ephemeral note through the normal saved-note `ItemDetailDialog` in Live Preview mode. Give
the existing autosave coordinator a creation-aware save function: its first non-empty save creates
and places the note, while later saves update the resulting item ID. Feed the persisted DTO back into
the same mounted detail instance and keep a same-size placeholder for saved-only actions until the
item exists. Stage pasted images before creation and use normal note-image import afterward.

The Focus rail uses its ordinary saved-note row or card for the ephemeral item. Autosave errors float
over the document instead of participating in its layout. `Ctrl+N` passes through the detail's flush
guard; it opens a fresh provisional note after meaningful content is durable and refocuses an
untouched provisional editor.

### Consequences

- The first keystroke no longer remounts the editor or changes the note-detail geometry.
- New notes inherit the saved editor's modes, find, formatting, undo/redo, Vim, and flush commands.
- Untouched notes still leave no vault item, while first-save failures retain the editable draft.
- General-file capture remains the separate Add Item workflow; New Note supports note text and
  embedded images through the same attachment path as saved notes.
