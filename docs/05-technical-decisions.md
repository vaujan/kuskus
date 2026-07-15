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
