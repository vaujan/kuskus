# MVP Scope

Status: Draft v0.1  
Last updated: 2026-07-14

## Objective

Build the smallest reliable Windows desktop application that can serve as the creator's primary mixed-format reference library for one real project.

The MVP is a dogfooding milestone, not a public launch.

## Definition of done

The MVP is complete when all golden workflows work against a real local library and the application can be used for seven consecutive days without manual data repair.

## Must have

### Library

- Create a library in a user-selected local folder.
- Open an existing Kuskus library.
- Reopen the last valid library.
- Detect a missing or invalid library and offer recovery.
- Keep user-readable content authoritative.

### Organization

- Inbox.
- Collections.
- Create, rename, and delete collections.
- Move one or more items between Inbox and collections.
- Archive with unarchive to the previous location.
- Trash with restore and permanent deletion.
- Windows-style renderer-local item commands: `F2` for single-item rename and `Delete` for
  recoverable Trash or confirmed permanent deletion.

### Capture

- A primary New Item action in the Masonry and Grid toolbar and Focus item-rail header that summons
  one inline draft at the beginning of the active view.
- An in-app `Ctrl+N` equivalent that opens or refocuses the same card while workspace shortcuts are
  active.
- A fixed `Ctrl+Shift+Space` system-wide shortcut that, while Kuskus is running, opens the same
  recoverable Inbox composer in a singleton bottom-right quick-capture window without reading the
  clipboard or changing the main window.
- No permanent capture tile or modal capture dialog; the non-modal quick-capture window is the
  system-wide entry surface.
- Automatic input detection without requiring the user to choose a format first.
- URL capture by paste with explicit confirmation, followed by a provisional card and background
  metadata enrichment.
- Clipboard image capture through the same recoverable, explicitly committed draft card.
- Recoverable staged drag-and-drop or paste import for images, PDFs, and general files across
  inline/quick-capture handoff and restart.
- Plain-text or Markdown quick notes with text-and-image draft recovery and explicit commit.
- Obsidian-style live Markdown editing in capture and saved notes, with visible
  Read/Live/Markdown/Split switching, exact-source access, guarded autosave, keyboard emphasis
  shortcuts, and reviewable conflict detection.
- Local images embedded in notes as independently indexed sibling files with portable relative
  Markdown links. Existing Obsidian attachment layouts and legacy Kuskus `.assets` notes remain
  supported without migration.
- Clipboard images receive editable timestamp-based names before commit. Exclusive indexed sibling
  images follow moved notes; shared or separately organized images remain stable and use rewritten
  relative references.
- A draft card that morphs into the newly saved, newest-first card.
- Direct paste into the focused content view using the same detection and saving pipeline.
- Visible progress and failure feedback.
- Durable FIFO submission handoff so consecutive quick captures never wait for prior vault writes;
  pending work resumes after restart and failed work remains explicitly recoverable.
- Type-specific **Save image**, **Save link**, and **Save note** confirmation before authoritative
  item creation.

### Browsing

- Responsive Masonry view with format-aware cards and natural card heights.
- Uniform Grid view.
- Focus view with a resizable, responsive visual-card rail and the complete item detail beside it,
  adapting to list-first drill-in navigation when the content pane is narrow.
- Consistent selection-first, focused-item fallback for `F2` and `Delete` across Masonry, Grid, and
  Focus, including active-item fallback in Focus, suspended while editors, menus, details, or
  dialogs own the keyboard.
- Expandable and hideable folder sidebar.
- Persistent active-destination scope inside Search.
- Responsive column count based on available width rather than a fixed number.

### Retrieval

- Search by title, note text, URL/domain, and filename.
- Filter by item type.
- Hide referenced attachments by default and expose their per-device visibility in the Filter menu.
- Sort by date added, title, or item type.
- Open an item using its primary action.
- Open a URL in the default browser.
- Open saved links in the default browser and show item details in Kuskus.
- Copy a file path or source URL where applicable.

### Reliability

- Persist content across restarts.
- Avoid overwriting content during filename collisions.
- Preserve the original external file during import and deletion.
- Make generated previews and indexes safe to rebuild.
- Present actionable errors instead of silently failing.
- Inspect Markdown references before image deletion, reject stale reviews, and offer safe unused-image
  cleanup when a note is permanently deleted.

## Should have after the core is reliable

- Browser extension.
- Multiple library support.
- Tags.
- PDF first-page previews and page count.
- Keyboard navigation and Space quick preview.
- Duplicate detection by file content.
- Import progress for large batches.

## Explicitly deferred

- User accounts.
- Cloud backup or synchronization.
- Collaboration and shared collections.
- Mobile applications.
- AI features and semantic search.
- Offline full-page web snapshots.
- OCR.
- Rich-text or block editor.
- Table view while its retrieval model and toolbar behavior are reconsidered.
- Plugin-specific Obsidian syntax beyond core properties, wikilinks, aliases, headings, and embeds.
- Smart collections and advanced rules.

## Vault-native scope amendment (2026-07-29)

- Open and initialize an existing ordinary vault without changing `.obsidian`.
- Recursively index supported Markdown, images, PDFs, and general files.
- Treat root files as Inbox and nested ordinary folders as nested collections.
- Store readable files in place with stable hidden records, visible Archive, and hidden Trash.
- Render core Obsidian links and embeds safely; expose unresolved or ambiguous targets visibly.
- Watch and reconcile external edits, while refusing destructive repair of malformed or conflicting data.
- Migrate schema-v1 libraries through a verified sibling conversion and permanent user-owned backup.
- Keep normal Markdown free of Kuskus properties; save web bookmarks as Windows `.url` Internet
  Shortcuts and reconcile identity through hidden paths, filesystem identities, and fingerprints.
- Preserve `.obsidian` byte-for-byte and support root, sibling, shared, and nested Obsidian attachment
  paths without using `.obsidian` as Kuskus configuration.
- Public publishing.
- Plugin marketplace.

## Initial content types

| Type         | Stored content                         | Default card                      | Primary action     |
| ------------ | -------------------------------------- | --------------------------------- | ------------------ |
| URL          | Metadata plus source URL               | Preview, title, domain            | Open in browser    |
| Image        | Copied image file plus metadata        | Natural-ratio thumbnail           | Preview/open image |
| Note         | Human-readable text file plus metadata | Readable excerpt                  | Edit note          |
| PDF          | Copied PDF plus metadata               | First-page preview when available | Open PDF           |
| General file | Copied file plus metadata              | File-type card                    | Open file          |

## Quality bar

- Ordinary capture should complete or visibly enter progress within one second.
- Capturing a URL must succeed even when metadata retrieval fails.
- No supported action may silently lose user content.
- The user must be able to copy the complete library folder as a backup.
- The app must remain usable at its current minimum window size.
- Visual presentation should favor content over decorative interface chrome.

## Scope control rule

A new feature enters the MVP only if it is required to complete a golden workflow or fixes repeated, high-friction dogfooding evidence. Interesting capabilities belong in the deferred list until then.
