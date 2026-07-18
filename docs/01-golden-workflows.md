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

## 2. Use the universal capture composer

### Scenario

The user wants one obvious place to add any supported kind of content without choosing its format first.

### Resting state

- **Add item** is the first card in the active content view.
- The compact card contains a prompt such as **Paste or start typing...**.
- The card remains in the first position while saved items flow after it.

### Flow

1. The user clicks **Add item**.
2. The card expands in place into a large editor and receives keyboard focus.
3. The surrounding saved-content canvas remains visible but is visually subdued so the capture surface is clear.
4. The user does one of the following without selecting a content type:
   - Pastes one URL.
   - Pastes an image from the clipboard.
   - Pastes or drops one or more files.
   - Types or pastes plain text or Markdown.
5. Kuskus detects the input type using the rules below and begins saving.
6. The expanded composer shows a visible saving or import state.
7. When the save succeeds, the composer resets to its compact state.
8. The new card is inserted immediately after the Add Item card, visually beside it when the layout has room.
9. Existing items reflow around the new card without navigating away or opening a separate result screen.

### Type-detection rules

- A single valid web URL with no other meaningful content becomes a URL item.
- Clipboard bitmap data or a pasted image file becomes an image item.
- Dropped or pasted files become one item per file.
- Plain text, Markdown, or mixed prose containing one or more links becomes a note; links inside it remain clickable.
- Ambiguous text defaults to a note so the user's original content is preserved.
- Detection failure leaves the content in the composer and explains what could not be saved.

### Commit behavior

- A recognized URL, clipboard image, or file import begins saving immediately after paste or drop.
- Typed notes maintain a recoverable draft while the composer is open.
- A note is committed with an explicit **Save** action or `Ctrl+Enter`.
- `Escape` collapses an empty composer. If it contains an uncommitted note, Kuskus retains the draft or asks before discarding it.
- After a successful commit, keyboard focus returns to the compact Add Item card unless the user has started another action.

### Destination and ordering

- In Inbox or a collection, the item is saved into that active context.
- From All Items, search results, or Trash, capture defaults to Inbox unless the user explicitly chooses a collection.
- Newly saved items appear immediately after the Add Item card, newest first.
- Metadata loading may continue after the initial card appears and must not change the item's position unexpectedly.

### Acceptance criteria

- The user never has to choose **URL**, **Image**, **File**, or **Note** before pasting.
- The expanded composer visibly communicates Markdown support and provides a keyboard-reachable picker for supported image files.
- Opening the composer does not navigate away from the current collection.
- At most one universal composer is expanded in a window.
- A successful save produces exactly one item per detected URL, image, note, or imported file.
- Repeated paste events cannot accidentally create duplicates because one event was handled twice.
- Failed input remains recoverable in the composer.
- The composer and new card work in Visual, Grid, and List views, even if their presentation differs.

## 3. Capture a URL

### Scenario

The user finds a useful webpage and copies its URL.

### Flow

1. The user expands the universal composer and pastes one URL, or pastes directly while the content view has focus.
2. Kuskus recognizes the clipboard value as a URL and immediately begins saving it.
3. A provisional URL card appears immediately after the Add Item card.
4. Kuskus retrieves the title, domain, favicon, description, and preview image in the background.
5. The provisional card progressively updates with available metadata without moving to a different position.

### Acceptance criteria

- Network or metadata failure does not prevent saving the URL.
- The original pasted URL is preserved exactly even while normalized data is used for display or duplicate checks.
- The card always shows at least the URL and domain.
- Double-clicking opens the URL in the default browser.
- **Open source URL** is available from the item menu.
- Opening the card shows its saved details; **Open link** launches the source in the default browser.
- Every saved item detail exposes **Show in Explorer** for its validated library copy or metadata file.
- The MVP saves a reference and metadata, not a guaranteed offline copy of the webpage.

## 4. Capture an image or screenshot

### Scenario

The user has an image in the clipboard or an image file on the desktop.

### Flow

1. The user expands the universal composer and pastes the clipboard image, or drops an image into the composer or content view.
2. The composer shows a preview and an import state.
3. Kuskus copies the image into the active library.
4. The composer collapses and a visual image card appears immediately after it.
5. The user may add a title, caption, or source URL later.

### Acceptance criteria

- The stored image is an ordinary file in the library.
- Kuskus does not modify the original source file.
- The card respects the image's natural aspect ratio in Visual view.
- Double-clicking opens a preview or the operating system's default image application.
- Opening the card shows a larger in-app image preview.
- **Show in Explorer** reveals the imported library copy without exposing an arbitrary renderer path.

## 5. Capture a local file

### Scenario

The user drags a PDF or another local file into Kuskus.

### Flow

1. The user drops or pastes one or more files into the expanded composer or content view.
2. The composer reports the number of detected files and shows import progress.
3. Kuskus copies each file into the active library.
4. Each file receives a separate item record and card immediately after Add Item.
5. Supported formats receive a preview; other formats receive a file-type card.

### Acceptance criteria

- The original file remains unchanged.
- Filename collisions do not overwrite existing content.
- An unsupported preview does not prevent importing or opening the file.
- Double-clicking opens the stored copy with the operating system's default application.
- Opening the card shows its available in-app preview and details.

## 6. Create a quick note

### Scenario

The user wants to save a short observation beside other project references.

### Flow

1. The user expands the universal composer.
2. The user types or pastes plain text or Markdown directly into it.
3. Kuskus maintains a recoverable draft while the user types.
4. The user commits with **Save** or `Ctrl+Enter`.
5. The composer collapses to its compact state.
6. A readable note card appears immediately after it in the current view.

### Acceptance criteria

- Notes use a durable, human-readable text format.
- Markdown is stored as entered; the card may render a safe preview without changing the source text.
- A note can be saved with only a body; a title may be derived from its first meaningful line.
- Editing does not require a rich-text editor in the MVP.
- Opening the card shows the full note in Kuskus.

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
3. The user browses in Visual, Grid, or List view.
4. The user optionally searches or filters the current context.
5. The user opens, previews, or reveals the desired item.

### Acceptance criteria

- The active collection is always visible in the content header or breadcrumb.
- Search covers at least title, note text, domain, and filename.
- Search and item-type filters combine within the active context and can be cleared without navigating away.
- `Ctrl+F` or `Ctrl+K` focuses the scoped search; `Escape` clears an active query before leaving search.
- Changing view does not change item order or selection.
- The most recently selected Visual, Grid, or List view is restored on the next launch.
- Hiding the sidebar gives the content area more space without hiding Search, Filter, or View.
- The standard keyboard zoom shortcuts resize the complete application interface, including the sidebar, toolbar, content, and dialogs, without adding permanent toolbar controls.
- The selected zoom level is restored on the next launch; `Ctrl+-`, `Ctrl++`, and `Ctrl+0` remain available as keyboard equivalents.

## 9. Delete and recover an item

### Scenario

The user removes an item accidentally or intentionally.

### Flow

1. The user selects **Move to Trash**.
2. Kuskus removes the item from Inbox or its collection and places it in the library's Trash.
3. From Trash, the user can restore or permanently delete it.

### Acceptance criteria

- Ordinary deletion is recoverable.
- Restoring returns the item to its previous collection when possible.
- Permanent deletion requires clear confirmation.
- Kuskus never deletes the original external file from which an item was imported.
