# Technical Decisions

Status: Living record  
Last updated: 2026-07-14

This file records decisions that constrain implementation. New entries are append-only; superseded decisions remain for context and link to their replacements.

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
Status: Accepted

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
Status: Accepted

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
- Note status is visible as Saved, Saving, invalid, failed, or conflicted without Save/Cancel chrome.
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
