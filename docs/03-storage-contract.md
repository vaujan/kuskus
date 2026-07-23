# Storage Contract

Status: Proposed v0.1  
Last updated: 2026-07-14

This document defines user-facing storage guarantees. Exact internal filenames may evolve, but an implementation must not weaken these guarantees without an explicit recorded decision and migration plan.

## Core guarantees

1. A Kuskus library is a local folder chosen by the user.
2. The library can be backed up or transferred by copying that folder while Kuskus is closed.
3. Imported files are copied into the library for the MVP; originals remain untouched.
4. Notes and metadata use documented, human-readable formats.
5. Generated indexes, thumbnails, and caches are disposable and rebuildable.
6. Kuskus must not require a proprietary remote service to read or recover a library.
7. Every item has a stable identifier that does not depend on its filename or collection.
8. Schema changes require versioning and migration; Kuskus must never silently reinterpret incompatible data.

## Proposed library layout

```text
Kuskus Library/
  library.json
  inbox/
    <item-id>/
      item.json
      content.ext
  collections/
    <collection-id>/
      collection.json
      items/
        <item-id>/
          item.json
          content.ext
  archive/
    <item-id>/
      item.json
      content.ext
  trash/
    <item-id>/
      item.json
      content.ext
  .kuskus/
    index.sqlite
    thumbnails/
      <item-id>/
        preview.ext
        favicon.ext
    temp/
```

The layout is a proposal to validate during implementation. The contract matters more than the exact directory names.

## Source of truth

Authoritative:

- `library.json`.
- Collection metadata.
- Item metadata.
- Imported content files.
- Note files.

Derived and safe to delete:

- Search database.
- Thumbnails and preview images generated from local content.
- Temporary downloads.
- Cached URL metadata that is also represented in authoritative item metadata.

If `.kuskus/index.sqlite` is missing or corrupt, Kuskus must be able to rebuild it by scanning authoritative files.

## Library metadata

Proposed minimum `library.json`:

```json
{
  "schemaVersion": 1,
  "id": "stable-library-id",
  "name": "My Kuskus Library",
  "createdAt": "2026-07-14T12:00:00Z"
}
```

## Collection metadata

Proposed minimum `collection.json`:

```json
{
  "schemaVersion": 1,
  "id": "stable-collection-id",
  "name": "Productivity SaaS",
  "icon": "rocket",
  "createdAt": "2026-07-14T12:00:00Z"
}
```

Collection folder names may include stable IDs so renaming a collection does not require unsafe path assumptions.
`icon` is an optional stable key from Kuskus's documented curated icon set. Missing or unknown
keys render as the default folder icon without invalidating or rewriting the collection.

## Item metadata

Proposed common fields:

```json
{
  "schemaVersion": 1,
  "id": "stable-item-id",
  "type": "url",
  "title": "Example page",
  "createdAt": "2026-07-14T12:00:00Z",
  "updatedAt": "2026-07-14T12:00:00Z",
  "sourceUrl": "https://example.com",
  "sourceFilename": null,
  "contentFilename": null,
  "note": "",
  "originalCollectionId": null,
  "titleSource": "derived",
  "trashedFrom": null
}
```

Rules:

- Item IDs are generated once and remain stable after moves and renames.
- The authoritative parent directory determines the current item location.
- `originalCollectionId` records the active collection used when an archived item is unarchived.
- `trashedFrom` records whether a trashed item came from Inbox, a collection, or Archive.
- `titleSource: "custom"` prevents note edits or URL enrichment from replacing a manual title.
- Type-specific fields may be added, but unknown fields should be preserved during compatible updates.
- Paths stored in metadata should be relative to the library whenever possible.
- Absolute external paths must not be required to open a copied item.

## Content rules by type

### URL

- `item.json` stores the source URL and available metadata.
- Remote preview URLs remain metadata only. Validated preview and favicon bytes are disposable cache
  files under `.kuskus/thumbnails/<item-id>/` and are exposed to the renderer only through an
  item-ID-and-kind operation.
- A URL item does not promise an offline webpage copy in the MVP.
- Failure to retrieve metadata leaves a valid item containing the original URL.
- A missing or corrupt URL preview cache is rebuilt when the network is available and never changes
  the validity of the bookmark.
- URL item details are presented in Kuskus; the source URL remains available to open in the default browser.

### Image, PDF, and general file

- The original is copied into the item's directory.
- The stored copy keeps a recognizable extension.
- The original filename is retained in metadata even if the stored filename must be made unique or safe.
- Deleting the Kuskus item never deletes the external source file.
- Image details are presented in Kuskus with a larger preview when content is available.

### Note

- The note body is stored as `note.md` or another documented UTF-8 text filename.
- Local images embedded in Markdown are copied into an `assets/` directory beside `note.md` and referenced with portable relative paths.
- `item.json` may contain an additive attachment manifest with stable IDs, safe filenames, media type, dimensions, and original filename.
- Metadata may store derived title and timestamps but must not be the only copy of the note body.
- Note details are presented in Kuskus.
- Saved note text may be edited and autosaved in Kuskus through a validated item-ID operation. Every
  update compares the last confirmed Markdown baseline with the current `note.md` before replacing it.
  A conflict returns the authoritative disk snapshot for explicit comparison and resolution.
- A missing attachment produces an inline missing-image state without making the remaining note unreadable.

Uncommitted capture images are staged under `.kuskus/temp/note-draft/` with a rebuildable manifest.
The legacy directory name remains for draft compatibility. A single image with no text may be
finalized as an image item; images combined with text are finalized as `note.md`, assets, and
`item.json`. Staged images are not authoritative items. Successful commit or explicit discard
removes the staged bundle; a failed commit retains it for recovery.

## Import safety

- Copy into a temporary location inside the library, verify completion, then atomically finalize the item when supported.
- Do not create a completed item record before its required content is safely stored.
- Never overwrite an existing item because of a filename collision.
- Interrupted imports must be recoverable or safely removable on the next launch.
- Large files should expose progress and cancellation without leaving a misleading complete card.

## Moves and renames

- Moving an item changes its collection location but not its item ID.
- A move must not be represented as delete-then-copy without recovery protection.
- Batch moves stage complete directories under `.kuskus/temp/` and recover interrupted transactions
  before scanning the library.
- Renaming a title never renames the physical content file.
- External manual edits should be detected on refresh or the next launch where practical.
- If content is missing, retain the item metadata and show a missing-content state rather than silently deleting it.

## Archive, Trash, and permanent deletion

- Archive moves the complete item directory into `archive/` and remembers its previous active location.
- Archived items remain authoritative but are excluded from All Items.
- Ordinary deletion moves the complete item directory into the library's Trash.
- Metadata records the immediately previous location so restoration can return there when possible.
- A missing previous collection falls back to Inbox.
- Permanent deletion removes the library copy and generated derivatives only after confirmation.
- Permanent deletion first stages the selected Trash directories as one recoverable batch.
- Permanent deletion never targets an external import source.

## In-app item details

Cards open an in-app detail view. Image and URL details are read-only; note details allow rendered
WYSIWYG Markdown edits while preserving existing attachments. Note autosaves stage a complete replacement
before swapping it into place, recover an interrupted swap, and refuse to overwrite a `note.md` that
changed after the editor opened it. URL details expose a validated **Open link** action. Every item
detail exposes **Show in Explorer** through an item-ID-based main-process operation; local content is
revealed when present, otherwise Kuskus reveals the item's authoritative `item.json`. Missing content
remains visible as a Kuskus warning rather than being silently removed.

## Migration policy

- Every library and item declares a schema version.
- A migration creates a backup or recovery checkpoint before modifying authoritative content.
- Migration failure must leave the original data readable.
- Newer unsupported schema versions must open read-only or show a clear incompatibility message; they must not be rewritten.

## Open storage decisions

- Final physical layout for items that appear in multiple collections, if that capability is ever added.
- Whether URL metadata should also be exported as a Markdown bookmark file.
- How external edits are watched without excessive filesystem overhead.
- Whether linking files in place should be offered after the copied-library workflow is reliable.
