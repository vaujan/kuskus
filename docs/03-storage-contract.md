# Storage Contract

Status: Accepted v2
Last updated: 2026-08-02

## Core guarantees

1. A Kuskus library is an ordinary local folder that can also be opened as an Obsidian vault.
2. User-visible files and directories are authoritative. Hidden records, indexes, previews, and caches must never be the only readable copy of user content or organization.
3. Imported content is copied into the vault; the external source is never modified or deleted.
4. Item IDs survive filename and folder changes. The renderer addresses native operations by ID, never by an arbitrary path.
5. Unsupported or malformed data is preserved for repair. Kuskus does not silently reinterpret a newer schema, invalid YAML, duplicate identity, or an ambiguous binary match.

## Schema-v2 layout

```text
Vault/
  Quick thought.md
  screenshot.png
  Product research/
    Competitors/
      Acme.md
  Archive/
  .obsidian/                 # ignored; never modified
  .kuskus/
    library.json
    collections/<id>.json
    records/<id>.json
    trash/<id>/
    thumbnails/<id>/
    temp/
```

Loose root files are Inbox. Ordinary folders are nested collections. The configured visible Archive folder is visible to other vault clients. Dot-folders, including `.obsidian` and `.kuskus`, are not indexed as active content.

## Markdown and bookmarks

Notes retain their readable filenames and contain no Kuskus-owned frontmatter. Existing YAML,
comments, ordering, aliases, and user properties remain user-authored content. Editing note text never
derives or changes the filename.

URL captures are Windows Internet Shortcuts named `<title>.url`. Their visible content is the
standard `[InternetShortcut]` section and a validated HTTP or HTTPS `URL=` entry, so Explorer opens
them in the default browser. Enrichment data remains in the hidden record and may rename a
provisional shortcut once only when it has not been externally renamed. Standard Markdown links and
Obsidian wikilinks, aliases, headings, note embeds, and image embeds remain supported in notes.

New note attachments are independent files in the note's folder and use URL-encoded relative
Markdown links such as `![Sketch](./Sketch.png)`. Each receives its staged attachment UUID as its
stable item ID and an ordinary image record. Existing relative embeds, Obsidian wikilinks, root
images, shared or nested attachment folders, and legacy Kuskus `<note-name>.assets/` layouts are
indexed without automatic reorganization. Referenced image and file records remain indexed but
their standalone cards are hidden by default; the per-device Filter preference can show them.
Scanning and presentation share a balanced Markdown-image parser, so URL-encoded or angle-bracketed
destinations and legacy generated paths containing spaces, escaped characters, or nested
parentheses resolve consistently. Parser-safe presentation repair is renderer-only and never
rewrites an existing authoritative Markdown file.

All new attachment placement goes through one main-process resolver. Its validated inputs are the
vault, final note path, candidate filename, and a placement policy. The absent policy resolves to
`same-folder`, which is the only implemented policy. The boundary can later support `vault-root`,
`specific-folder`, or `note-subfolder` without changing renderer capture requests or note schemas;
no setting field or attachment-location UI is part of this contract version. Kuskus never reads or
modifies `.obsidian` to determine placement.

## Binary and collection identity

Imported binaries retain a safe version of the source filename; clipboard captures receive readable
local-time `image-YYYY-MM-DD-HHmmss.<ext>` names when staged, with collision suffixes and an optional
validated user replacement before commit. `.kuskus/records/<id>.json` stores identity, timestamps, fingerprints, optional
filesystem identity, last known relative path, reference state, and recovery location for every item.
A file is reconciled by exact path, then unique filesystem identity, then unique content fingerprint.
Ambiguous duplicate fingerprints create new identities rather than stealing an existing record.

Folder names and nesting are authoritative collection organization. `.kuskus/collections/<id>.json` keeps only stable identity and Kuskus presentation metadata such as an icon. Creating, renaming, moving, or deleting a collection performs the corresponding validated folder operation. Moving refuses ancestry cycles, preserves collection IDs, and updates descendant collection and item paths with rollback on an in-process failure.

## Scanning, safety, and conflicts

The main process recursively scans supported Markdown, images, PDFs, and general files on startup, window focus, and debounced filesystem change. Filesystem links are not followed. Every resolved source and destination must remain within the canonical vault or the controlled hidden trash.

Malformed legacy metadata, invalid Internet Shortcuts, incompatible schema versions, external
note-edit conflicts, read-only paths, invalid hidden records, and ambiguous identity recovery produce
an error, repair state, or read-only state. They never trigger destructive normalization. Temporary
writes and moves live under `.kuskus/temp/` and use staging plus rollback where a multi-path
operation cannot be atomic.

Durable capture submissions snapshot their active collection, then reserve and persist the resolved
note and attachment destinations before finalization. Finalization writes attachment files and
records first and the note last, and recovery resumes idempotently from those stored destinations.
Hidden attachment metadata may retain any validated vault-contained relative path and stable ID, but
the authoritative reference relationship is always derived from Markdown. Schema-v1 staged capture
aliases under `./assets/` are normalized when read and again during finalization; recovered captures
therefore produce independent sibling images and current relative embeds without losing draft text.

## Archive and Trash

Archive is a configurable visible folder. If `Archive` already exists during initialization, the
preview must make adoption explicit or allow another name. Trash lives at `.kuskus/trash/` and
retains the exact previous relative path plus source-location metadata for restore. Moving active or
archived notes also moves an indexed sibling image when all of its inbound notes participate in the
same move. Shared, missing, untracked, and separately organized images remain in place and the moved
note embeds are rewritten. Moving or renaming an attachment outside Trash rewrites all inbound Markdown references with rollback; moving it to Trash
leaves Markdown unchanged after a revision-checked warning. Permanent note deletion may separately
move confirmed, currently unreferenced images to Trash. Permanent deletion affects only controlled
vault copies and derived caches after confirmation. Permanently deleting a referenced attachment
requires the same revision-checked reference confirmation and identifies every affected note before
commit. Legacy `.assets` companions remain coupled to their note for lifecycle compatibility.

## Initialization

Opening an uninitialized folder first reports the supported files, nested folders, existing Archive
collision, and planned mutations. Commit creates `.kuskus/` and indexes visible files without
rewriting Markdown. `.obsidian` is never read as content or modified.

## Visible-metadata cleanup

The first compatible launch detects legacy Kuskus YAML. Before changing any safe candidate it keeps
a checksummed, path-preserving recovery copy under `.kuskus/migrations/`. It removes only
Kuskus-owned identity properties and preserves user YAML text. Blank generated bookmark Markdown is
converted to `.url`. A bookmark containing user properties or body text remains unchanged and is
reported as a repair conflict. Staged cleanup is verified as one transaction and rolls back from the
retained recovery copy on failure.

## Schema-v1 migration

Migration builds a complete sibling v2 vault, converts UUID packages to clean readable Markdown,
Windows `.url` bookmarks, and named folders, retains IDs, attachments, lifecycle locations, and
metadata, then verifies counts, content, references, and reopen behavior. Only after verification is
the original renamed to a timestamped sibling backup and the converted vault placed at the original
path. A failed swap restores the original name. Backups are never overwritten or automatically deleted.
