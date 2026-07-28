# Golden Workflows

Status: Draft v0.1  
Last updated: 2026-07-14

These workflows define the behavior Kuskus must preserve as its implementation evolves. They describe user outcomes rather than internal architecture.

## Shared rules

- Capture must not require an account.
- Inbox is the default destination when no collection is selected.
- Optional metadata must never block saving.
- A saved item must survive an application restart.
- Failures must be visible and recoverable; Kuskus must not silently discard content.
- Files controlled by Kuskus remain ordinary, user-readable files in the selected library.

## 1. Create or open a library

### Scenario

The user launches Kuskus for the first time.

### Flow

1. Kuskus explains that a library is a local folder containing the user's content.
2. The user chooses **Create library** or **Open existing library**.
3. For a new library, the user chooses a parent folder and library name.
4. Kuskus creates and validates the library structure.
5. Kuskus opens Inbox.
6. On later launches, Kuskus reopens the most recently used library when it is available.

### Acceptance criteria

- The selected location is shown before creation.
- Kuskus never overwrites a non-Kuskus folder without explicit confirmation.
- A missing, moved, or unreadable library produces a recovery screen rather than an empty library.
- The library can be copied as one folder for backup.
- From an open workspace, the library actions allow creating or opening another library.
- A library switch keeps library-scoped note drafts and is unavailable while a save or image import has transient in-memory work.

## 2. Use the summoned New Item card

### Scenario

The user wants one obvious place to add any supported kind of content without choosing its format first.

### Resting state

- A primary **New item** action remains available in the toolbar.
- The content canvas contains saved items only; no permanent capture tile consumes its first slot.
- A retained draft is indicated by the toolbar action and can be continued or explicitly discarded.

### Flow

1. The user clicks **New item**.
2. A normal-width draft card appears at the beginning of the active content view and receives keyboard focus.
3. The surrounding saved-content canvas remains visible and interactive.
4. The user does one of the following without selecting a content type:
   - Pastes one URL.
   - Pastes an image from the clipboard.
   - Pastes or drops one or more files.
   - Types or pastes plain text or Markdown.
5. Kuskus detects the input type using the rules below and stages it for confirmation.
6. The draft card shows saving, staging, retry, or recovery state in place.
7. When the save succeeds, the draft card morphs into the saved format-aware card.
8. Existing items reflow around the new card without navigating away or opening a separate result screen.

### Type-detection rules

- A single valid web URL with no other meaningful content becomes a URL item.
- Clipboard bitmap data or a pasted image file in an empty card becomes an image item.
- An image pasted after note text has begun becomes a local Markdown attachment.
- Dropped or pasted files become one item per file.
- Plain text, Markdown, or mixed prose containing one or more links becomes a note; links inside it remain clickable.
- A URL pasted after note text has begun remains part of the Markdown note.
- Ambiguous text defaults to a note so the user's original content is preserved.
- Detection failure leaves the content in the composer and explains what could not be saved.

### Commit behavior

- Recognized URLs and clipboard images remain recoverable library-scoped drafts until confirmed.
- Typed notes and their staged local images maintain the same recoverable draft behavior.
- The detected item is committed with **Save link**, **Save image**, or **Save note**, or with
  `Ctrl+Enter`.
- `Escape` hides the card and retains unfinished content; discard is a separate explicit action.
- After a successful commit, keyboard focus returns to **New item** unless the user has started another action.

### Destination and ordering

- In Inbox or a collection, the item is saved into that active context.
- From All Items, search results, Archive, or Trash, capture defaults to Inbox unless the user explicitly chooses a collection.
- Under the default newest-first sort, newly saved items appear first. With another sort active,
  the saved item joins its sorted position and is scrolled into view.
- Metadata loading may continue after the initial card appears and must not change the item's position unexpectedly.

### Acceptance criteria

- The user never has to choose **URL**, **Image**, **File**, or **Note** before pasting.
- The draft card visibly communicates Markdown support and provides a keyboard-reachable picker for supported image files.
- Opening the card does not navigate away from the current collection.
- At most one New Item card exists in a window.
- A successful save produces exactly one item per detected URL, image, note, or imported file.
- Repeated paste events cannot accidentally create duplicates because one event was handled twice.
- Failed input remains recoverable in the card.
- The draft and saved item work in Masonry, Grid, and Table views, even if their presentation differs.

## 3. Capture a URL

### Scenario

The user finds a useful webpage and copies its URL.

### Flow

1. The user summons New Item and pastes one URL, or pastes directly while the content view has focus.
2. Kuskus recognizes the clipboard value as a URL and keeps it editable in the draft card.
3. The user confirms with **Save link** or `Ctrl+Enter`.
4. The draft becomes a non-editable saving card in the same position while the authoritative URL
   record is created.
5. The saving card changes to **Preparing preview** while Kuskus retrieves the title, domain,
   favicon, description, and preview image through the main process.
6. The saving card morphs once into the enriched URL card, a metadata fallback, or a provisional
   card after a bounded wait. Background enrichment may continue without moving the item.

### Acceptance criteria

- Network or metadata failure does not prevent saving the URL.
- After authoritative creation, the link is registered in its destination immediately but is shown
  only through the saving card until that intermediary state releases its slot.
- The saving state lasts at least 500 ms after a successful confirmation and yields to a provisional
  card after 12 seconds; creation failures restore the editable URL draft without delay.
- The original pasted URL is preserved exactly even while normalized data is used for display or duplicate checks.
- The card always shows at least the URL and domain.
- Single-clicking the card opens its saved details.
- **Open source URL** is available from the item menu and confirms when the URL is handed to the default browser.
- **Open link** in the detail launches the source in the default browser with the same feedback.
- Every saved item detail exposes **Show in Explorer** for its validated library copy or metadata file.
- The MVP saves a reference and metadata, not a guaranteed offline copy of the webpage.

## 4. Capture an image or screenshot

### Scenario

The user has an image in the clipboard or an image file on the desktop.

### Flow

1. The user summons New Item and pastes the clipboard image, or drops an image into the card or content view.
2. The draft card validates and stages the image, then shows a recoverable preview.
3. The user confirms with **Save image** or `Ctrl+Enter`.
4. Kuskus copies the staged image into an authoritative item in the active library.
5. The draft morphs into a visual image card.
6. The user may add a title, caption, or source URL later.

### Acceptance criteria

- The stored image is an ordinary file in the library.
- Kuskus does not modify the original source file.
- The card respects the image's natural aspect ratio in Masonry view.
- Single-clicking the card opens a larger in-app image preview.
- **Show in Explorer** reveals the imported library copy without exposing an arbitrary renderer path.

## 5. Capture a local file

### Scenario

The user drags a PDF or another local file into Kuskus.

### Flow

1. The user drops or pastes one or more files into the New Item card or content view.
2. The card reports the number of detected files and shows import progress.
3. Kuskus copies each file into the active library.
4. Each file receives a separate item record and newest-first card.
5. Supported formats receive a preview; other formats receive a file-type card.

### Acceptance criteria

- The original file remains unchanged.
- Filename collisions do not overwrite existing content.
- An unsupported preview does not prevent importing or opening the file.
- Single-clicking the card shows its available in-app preview and details.

## 6. Create a quick note

### Scenario

The user wants to save a short observation beside other project references.

### Flow

1. The user summons the New Item card.
2. The user types or pastes plain text or Markdown directly into it.
3. Kuskus maintains a recoverable draft while the user types.
4. The user commits with **Save** or `Ctrl+Enter`.
5. The draft card morphs into a readable note card in the current view.
6. Opening the saved note shows rendered Markdown and a visible icon control for Read, Markdown,
   and Split. `Ctrl+E` switches Read and Markdown; `Ctrl+Shift+E` toggles Split and returns to the
   previous single-pane mode.
7. Markdown exposes the authoritative source in a syntax-highlighted monospace editor and autosaves
   approximately 800 ms after typing stops. Split edits the same source beside its live Read preview.

### Acceptance criteria

- Notes use a durable, human-readable text format.
- Markdown remains the authoritative format and is saved exactly as entered. Opening a note or
  switching modes never normalizes its source. Local pasted images use portable relative references
  and render inline.
- A note with images remains an ordinary `note.md` plus an `assets/` folder.
- A note can be saved with only a body; a title may be derived from its first meaningful line.
- Saved-note editing uses a GFM-aware source editor without block handles, slash commands, selection
  toolbars, or a proprietary document model. Highlighting and heading scale are presentational only.
- Raw HTML remains editable as source but is not executed by the rendered reading mode.
- Opening the card shows the full note in Kuskus with headings, lists, tables, code, blockquotes,
  links, local images, and math rendered from Markdown.
- Saved-note editing preserves existing attachments and writes through a validated item-ID operation.
- Read renders the current Markdown draft; Markdown exposes the same draft as source; Split shows
  both with proportional linked scrolling. `Ctrl+Enter` flushes autosave immediately from Markdown
  or Split, and the mode control visibly presents all three choices.
- Routine autosave has no Saved, Saving, or pending-save indicator. Invalid drafts, write failures,
  and external-edit conflicts remain persistently visible with recovery actions.
- Headings support bold, italic, inline-code, and strikethrough styling consistently across cards
  and Read. Unformatted headings use regular weight, while nested bold uses a 700 weight.
- Opening any item detail leaves the Windows title-bar controls reachable without making the
  underlying application toolbar interactive.
- The detail scrim dims the complete application window without blur, and detail content uses the
  same accessible scrollbar treatment as the saved-item library.
- Text selection uses the same native selection color and shape in the Markdown source and the
  rendered preview, so split view never shows two different selection treatments.
- While item details are open, workspace shortcuts are suspended so Markdown commands such as
  `Ctrl+B` and `Ctrl+I` remain local to the note and wrap or unwrap the current selection without
  opening a toolbar.
- Closing or navigating away flushes the latest draft first and remains on the note if saving fails.
- A note changed outside Kuskus is not silently overwritten. The user reviews a side-by-side source
  diff before explicitly choosing the local draft or disk version.

## 7. Organize Inbox

### Scenario

The user has captured several items without organizing them.

### Flow

1. The user opens Inbox.
2. The user selects one or more items.
3. The user moves them to an existing collection or creates a collection.
4. The items disappear from Inbox and appear in the destination collection.

### Acceptance criteria

- Capture never requires choosing a collection first.
- A new collection may use the default folder icon or an optional chosen icon.
- The user can search for and change a collection icon later without changing its identity or name.
- Invalid or unavailable icon metadata falls back to the default folder icon without hiding the collection.
- Moving an item preserves its stable identity and metadata.
- Moving files must not create duplicate content unless explicitly requested.
- An interrupted move must not lose the item.

## 8. Browse and retrieve references

### Scenario

The user returns to a project and wants to rediscover a saved reference.

### Flow

1. The user selects a collection in the sidebar.
2. Kuskus displays mixed-format items together.
3. The user browses in Masonry, Grid, or Table view.
4. The user optionally searches or filters the current context.
5. The user opens, previews, or reveals the desired item.

### Acceptance criteria

- The active destination remains visible as a persistent scope label inside Search, including when
  the sidebar is hidden and while a query is entered.
- Search covers at least title, note text, domain, and filename.
- Search and item-type filters combine within the active context and can be cleared without navigating away.
- `Ctrl+F` or `Ctrl+K` focuses the scoped search; `Escape` clears an active query before leaving search.
- `Ctrl+A` selects every item matching the current destination, search, and item-type filters when
  focus is outside a text field or editor. All Items does not cross into Archive or Trash.
- Select All through `Ctrl+A` or `Cmd+A` is a snapshot: later filter changes prune hidden selections
  but do not silently select newly revealed or newly created items. `Escape` clears the item selection.
- Changing view does not change item order or selection.
- The current context can be sorted by newest or oldest first, by title, or grouped by item type;
  the chosen order applies equally to Masonry, Grid, Table, keyboard focus order, range selection,
  and detail navigation.
- Changing the sort preserves the item selection, and the most recently selected sort is restored
  on the next launch.
- Selected items remain unmistakable over every preview type in Masonry, Grid, and Table through a
  checked marker plus a high-contrast accent treatment that does not rely on color alone.
- The most recently selected Masonry, Grid, or Table view is restored on the next launch.
- Hiding the sidebar gives the content area more space without hiding Search or Filter. View and
  appearance preferences remain reachable by reopening the sidebar from the persistent toolbar
  trigger.
- The expanded sidebar can be resized from 208 to 384 pixels with a pointer or keyboard, and its width is restored on the next launch.
- The standard keyboard zoom shortcuts resize the complete application interface, including the sidebar, toolbar, content, and dialogs, without adding permanent toolbar controls.
- The selected zoom level is restored on the next launch; `Ctrl+-`, `Ctrl++`, and `Ctrl+0` remain available as keyboard equivalents.

## 9. Archive, delete, and recover an item

### Scenario

The user hides an inactive item or removes one accidentally or intentionally.

### Flow

1. The user may select **Archive** to hide retained content from active views.
2. Unarchive returns the item to its previous Inbox or collection location when possible.
3. The user selects **Move to Trash** for intended deletion; this works from active views or Archive.
4. From Trash, the user can restore to the immediately previous location or permanently delete.

### Acceptance criteria

- Ordinary deletion is recoverable.
- Archive is distinct from Trash and is excluded from All Items.
- Archive and Move to Trash provide a short-lived Undo action backed by the persisted operation, exposed as a toast button and as Ctrl+Z while the Undo toast is visible.
- Restoring returns the item to its previous collection when possible.
- Missing previous collections fall back to Inbox with visible feedback.
- Permanent deletion requires clear confirmation.
- Kuskus never deletes the original external file from which an item was imported.
