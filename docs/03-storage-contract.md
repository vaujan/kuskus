# Storage Contract

Status: Accepted v2
Last updated: 2026-07-29

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

New note attachments use `<note-name>.assets/` and portable relative Markdown links. Existing attachment paths are not reorganized. Referenced image and file records remain indexed but their standalone cards are hidden by default; the presentation preference can show all files.

## Binary and collection identity

Imported binaries retain a safe version of the source filename; clipboard captures receive readable
timestamped names. `.kuskus/records/<id>.json` stores identity, timestamps, fingerprints, optional
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

## Archive and Trash

Archive is a configurable visible folder. If `Archive` already exists during initialization, the preview must make adoption explicit or allow another name. Trash lives at `.kuskus/trash/` and retains source-location metadata for restore. Permanent deletion affects only the controlled vault copy and derived caches after confirmation.

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
