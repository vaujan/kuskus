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
- Trash with restore and permanent deletion.

### Capture

- A primary New Item toolbar action that summons one inline draft card at the beginning of the active content view.
- No permanent capture tile or separate capture dialog.
- Automatic input detection without requiring the user to choose a format first.
- URL capture by paste, with a provisional card followed by background metadata enrichment.
- Clipboard image capture through the same draft card.
- Drag-and-drop or paste import for images, PDFs, and general files.
- Plain-text or Markdown quick notes with text-and-image draft recovery and explicit commit.
- Local images embedded in notes as relative Markdown assets.
- A draft card that morphs into the newly saved, newest-first card.
- Direct paste into the focused content view using the same detection and saving pipeline.
- Visible progress and failure feedback.

### Browsing

- Responsive Masonry view with format-aware cards and natural card heights.
- Uniform Grid view.
- Compact Table view with Name, Type, and Added columns.
- Expandable and hideable folder sidebar.
- Active collection title or breadcrumb.
- Responsive column count based on available width rather than a fixed number.

### Retrieval

- Search by title, note text, URL/domain, and filename.
- Filter by item type.
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

## Should have after the core is reliable

- Global capture shortcut.
- Browser extension.
- Multiple library support.
- Tags.
- Sorting by added date, title, and file type.
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
- Nested collections.
- Smart collections and advanced rules.
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
