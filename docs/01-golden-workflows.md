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
- A valid rebuildable library snapshot may paint immediately while Kuskus reconciles external edits
  in the background. Cached state must never suppress a later watcher, focus, or startup repair.
- At the 5,000-item performance fixture, cached state is returned within 500 ms, an unchanged focused
  vault reconciles within 300 ms, search computation stays within 50 ms, and durable capture
  acceptance stays within one second on the reference Windows SSD environment.

## Note authoring contract

- `Ctrl+N` always opens one canonical full-detail note editor, regardless of whether the current
  library view is Masonry, Grid, or Focus. It never opens or converts into mixed-content capture.
- Before the first meaningful edit, the note is ephemeral and appears as a selected **Untitled
  note** entry in the rail. Leaving an untouched note removes it silently and restores the previous
  view, selection, detail, and scroll context.
- The ephemeral note uses the same rail row, detail toolbar, Live Preview editor, document geometry,
  and keyboard commands as a saved note from its first frame. Creating the backing file updates that
  surface in place; it never replaces or remounts the editor, moves the canvas, or introduces a
  creation-only header.
- Non-whitespace Markdown or an embedded attachment is meaningful. Whitespace, caret movement,
  formatting controls, and menu activity are not.
- The first meaningful edit creates the local note and normal note autosave takes over. A lone URL
  remains note content; it is never promoted into a link item.
- `Ctrl+N` flushes an edited note and opens a fresh ephemeral note. If the current ephemeral note is
  still untouched, the shortcut only refocuses its editor.
- Creation and autosave failures retain the editable draft and use an overlaid recovery notice, so
  Retry and Restore never change the document's layout.
- The first human-readable Markdown line supplies the title. It keeps tracking that line until an
  explicit rename makes the title custom; **Use first line as title** restores automatic tracking.

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
- Opening an ordinary folder shows an initialization preview before adding `.kuskus/`; Markdown
  and `.obsidian` remain untouched. An existing visible Archive folder must be explicitly adopted.
- Opening schema v1 starts guided conversion, verifies a sibling vault, and retains the original as
  a timestamped sibling backup before reopening schema v2 at the original path.
- External filesystem edits appear after the debounced watcher, focus reconciliation, or restart.
- From an open workspace, the library actions allow creating or opening another library.
- A library switch keeps library-scoped note drafts and is unavailable while a save or image import has transient in-memory work.

## 2. Use the summoned New Item card

### Scenario

The user wants one obvious place to add any supported kind of content without choosing its format first.

### Resting state

- A primary **New item** action remains available in the Masonry and Grid toolbar and in the Focus
  item-rail header.
- The content canvas contains saved items only; no permanent capture tile consumes its first slot.
- A retained draft is indicated by the active view's New item action and can be continued or
  explicitly discarded.

### Flow

1. The user clicks **Add item**. From another application, the user may press
   `Ctrl+Shift+Space` while Kuskus is running.
2. In-app capture appears as a normal-width draft card at the beginning of the active content view.
   Global capture appears as the same composer in a focused bottom-right Inbox popup without
   restoring or changing the main window.
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
- Quick capture hides as soon as the submission is durably accepted. Its authoritative write may
  continue in a FIFO background queue without blocking a fresh composer session. For note drafts,
  **Continue in editor** or `Ctrl+Shift+Enter` waits for the note, reveals the main window, and opens
  its live editor instead.
- After a successful inline commit, keyboard focus returns to **New item** unless the user has started another action.

### Destination and ordering

- In Inbox or a collection, the item is saved into that active context.
- From All Items, Archive, or Trash, capture defaults to Inbox unless the user explicitly chooses a collection.
- Under the default newest-first sort, newly saved items appear first. With another sort active,
  the saved item joins its sorted position and is scrolled into view.
- Metadata loading may continue after the initial card appears and must not change the item's position unexpectedly.

### Acceptance criteria

- The user never has to choose **URL**, **Image**, **File**, or **Note** before pasting.
- The draft card visibly communicates Markdown support and provides a keyboard-reachable picker for supported image files.
- An empty wrapping prompt is presentation only and never creates overflow chrome, clipped fragments,
  or a multi-line caret.
- Opening the card does not navigate away from the current collection.
- One library-scoped capture session is shared by the inline card and quick-capture popup, with only
  one surface accepting edits at a time.
- Opening the draft in the other surface during staging or submission waits for that transient work
  and transfers editing ownership automatically when it finishes; the user does not need to summon
  the composer again, and a hidden destination does not take ownership later.
- Add item opens or refocuses that card without changing the `Ctrl+N` note-authoring contract.
- A successful save produces exactly one item per detected URL, image, note, or imported file.
- Reopening quick capture immediately after Save presents a fresh editable session even while one
  or more accepted submissions are still being written.
- Accepted submissions survive restart, preserve submission order and time, and never reuse the
  mutable staged assets of a later draft. Each submission also retains the final note and image
  destinations resolved when it was accepted, so a delayed retry cannot drift to another folder.
- Background failures remain recoverable without replacing or disabling the fresh composer.
- Repeated paste events cannot accidentally create duplicates because one event was handled twice.
- Failed input remains recoverable in the card.
- The draft and saved item work in Masonry, Grid, and Focus views, even if their presentation differs.
- In Focus, New item appears as the temporary first rail entry in the active Index or Visual
  density, and the recoverable composer uses the detail pane. Hiding it retains the shared draft;
  successful capture activates the saved item at its sorted position.
- The global shortcut opens or focuses one taskbar-hidden composer popup on the pointer's monitor
  without restoring, navigating, searching, filtering, or changing selection in the main window.
- After the popup hides, opening New item in the main window continues the exact same draft inline.
- A retained library-scoped draft is reopened rather than replaced. Active saves, imports, item
  details, and dialogs are not discarded, closed, or force-saved by the shortcut. Escape and
  ordinary popup focus loss hide and retain the draft.
- A shortcut registration conflict is visible in the Settings dialog and through one non-blocking
  notice per app run. The shortcut is unavailable after Kuskus exits.
- A second Kuskus launch focuses the existing process so only one process owns the shortcut and
  active library.
- When no ready library exists, the shortcut reveals the main setup, migration, or recovery flow
  instead of accepting temporary capture content.

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
- The authoritative bookmark is a readable Windows `.url` Internet Shortcut. Double-clicking it in
  Explorer opens the validated HTTP or HTTPS destination in the default browser.

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
2. The user types or pastes plain text or Markdown into a live-preview editor that keeps the exact
   Markdown source authoritative.
3. Kuskus maintains a recoverable draft while the user types.
4. The user commits with **Save** or `Ctrl+Enter`.
5. The draft card morphs into a readable note card in the current view.
6. Opening the saved note shows a visible icon control for Read, Live, Markdown, and Split.
   `Ctrl+E` switches Read and Live, `Ctrl+Alt+E` toggles Markdown source, and `Ctrl+Shift+E` toggles
   Split and returns to the previous single-pane mode.
7. Live edits the authoritative Markdown with syntax markers revealed on the active line. Markdown
   exposes exact source in a syntax-highlighted monospace editor. Both autosave approximately 800 ms
   after typing stops, while Split edits the same source beside its live Read preview.

### Acceptance criteria

- Notes use a durable, human-readable text format.
- Markdown remains the authoritative format and is saved exactly as entered. Opening a note or
  switching modes never normalizes its source. Local pasted images use portable relative references
  and render inline.
- A newly created note with images remains an ordinary readable `.md` file plus independently
  indexed image files in the same folder. It uses URL-encoded relative Markdown embeds such as
  `![Sketch](./Sketch.png)`; existing vault attachment paths and legacy `.assets` folders remain
  unchanged.
- A clipboard image is staged with a local-time `image-YYYY-MM-DD-HHmmss.<ext>` name, immediately
  focuses its selected filename stem for optional replacement, and uses an empty generated alt such
  as `![](./image-2026-08-03-143052.png)`. Enter or blur accepts the current value, Escape retains
  the default, and the validated extension is not editable.
- A note can be saved with only a body. Its title comes from the first human-readable Markdown line,
  ignoring image-only embeds and structural syntax; an image-only note uses the first image's
  filename stem before falling back to **Untitled note**.
- Saved-note and capture editing use GFM-aware CodeMirror editors without block handles, slash
  commands, selection toolbars, or a proprietary document model. Live Preview uses decorations only;
  highlighting, widgets, hidden markers, and heading scale never change the saved Markdown bytes.
- Raw HTML remains editable as source but is not executed by the rendered reading mode.
- Opening the card shows the full note in Kuskus with headings, lists, tables, code, blockquotes,
  links, local images, and math rendered from Markdown.
- Saved-note editing preserves existing attachments and writes through a validated item-ID operation.
- Read renders the current draft; Live edits it with inactive syntax markers hidden; Markdown exposes
  the same draft as exact source; Split shows source and Read with proportional linked scrolling.
  `Ctrl+Enter` flushes autosave immediately from Live, Markdown, or Split, and the mode control visibly
  presents all four choices.
- Live Preview renders headings, emphasis, links, lists, tasks, quotes, fenced code, rules, local
  images, math, and core wikilinks in place. Moving the caret onto a construct reveals its Markdown;
  task widgets update the authoritative text and Ctrl-click follows supported links.
- Capture Live Preview uses the same compact Markdown typesetting preset as saved note cards. Saved
  Live mode uses the same reading preset as Read, including body size, heading hierarchy, weight,
  leading, links, inline code, quotes, rules, and image treatment. Editor-only markers and widgets do
  not create a separate document style. Lists retain the rendered indentation, marker hierarchy, and
  item rhythm, and a wrapping empty-state prompt never enlarges the body-text caret.
- Routine autosave has no Saved, Saving, or pending-save indicator. Invalid drafts, write failures,
  and external-edit conflicts remain persistently visible with recovery actions.
- Headings support bold, italic, inline-code, and strikethrough styling consistently across cards
  and Read. Unformatted headings use regular weight, while nested bold uses a 700 weight.
- Opening any item detail leaves the Windows title-bar controls reachable without making the
  underlying application toolbar interactive.
- Clicking an active item's visible detail title edits it in place for notes, images, links, and
  files. Enter or blur saves, Escape cancels, failures preserve the draft, and Trash titles remain
  read-only. A note's pending Markdown save must finish successfully before its file is renamed.
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
- New collections use the default folder icon and may receive another validated icon from the
  folder menu. Icons remain subordinate to folder names and disclosure controls.
- The folder sidebar presents vault nesting as an expandable tree and remembers collapsed branches
  separately for each library. Selecting a folder reveals its ancestors; collapsing the active
  folder's ancestor selects that ancestor so the active destination remains visible.
- Hover, focus, selection, and drop feedback span the full folder row at every nesting depth while
  disclosure controls, icons, and names remain indented. At most one transient folder drop target
  is highlighted, and its highlight clears after a drop or cancelled drag.
- The root Add Folder action creates a root folder. **Add subfolder** on a folder creates an
  ordinary child directory inside that validated vault folder without navigating away.
- Selecting a parent folder browses the items in its complete subtree; its count reflects that same
  aggregate scope, while capture still saves into the exact selected folder.
- Items and multi-selections can be dragged onto Inbox or a folder. Internal drags never invoke the
  external file-import drop path, and collapsed folder targets expand after a short hover.
- A folder can be moved to the root or another folder through its menu or by drag and drop. Moving
  preserves folder and item identities, refuses ancestry cycles, and updates visible paths safely.
- Removing a folder with subfolders is refused before any item moves. Removing a folder with direct
  items states that those items will move to Inbox before confirmation.
- Moving an item preserves its stable identity and metadata.
- Moving files must not create duplicate content unless explicitly requested.
- An interrupted move must not lose the item.

## 8. Browse and retrieve references

### Scenario

The user returns to a project and wants to rediscover a saved reference.

### Flow

1. The user selects a collection in the sidebar.
2. Kuskus displays mixed-format items together.
3. The user browses in Masonry, Grid, or Focus view. Table remains unavailable while its product
   direction is reconsidered.
4. The user optionally opens global search or filters the current context.
5. The user opens, previews, or reveals the desired item.

### Acceptance criteria

- `Ctrl+K` opens library-wide search from Overview, Focus, and item details without changing the
  workspace underneath it. `Ctrl+F` remains local find inside an open note.
- Empty search shows up to eight recently opened items. Typed search covers at least title, complete
  note text, domain/URL, and filename; all query terms must match, with title matches ranked first.
- Search results identify their item type and real collection path. On wide layouts, search and
  results remain in the left pane while the right pane displays the highlighted item's complete
  read-only content directly rather than wrapping it in another card. Moving the highlight never
  navigates. `Escape` restores the untouched workspace.
- Opening a result navigates to its real destination, selects it, and opens its normal detail.
- Item-type filters and **Show referenced attachments** remain scoped to the active context and do
  not constrain global search. Referenced files are hidden from search and from ordinary views by
  default; the visibility filter persists per device and contributes to the Filter badge.
- `Ctrl+A` selects every item matching the current destination and item-type filters when
  focus is outside a text field or editor. All Items does not cross into Archive or Trash.
- `F2` opens the existing rename dialog for the sole selected item, or the focused visible card or
  table row when nothing is selected. Multiple selections and Trash leave rename unchanged.
- `Delete` moves the selected visible items, or the focused visible item, to Trash. In Trash it
  opens the existing permanent-delete confirmation instead.
- Item shortcuts are suspended while text editing, menus, item details, or dialogs own the keyboard,
  and modified Delete variants do nothing.
- Opening an item context or overflow menu from a selected item preserves the complete visible
  selection. Opening one from an unselected item replaces the selection with that item.
- Move, Archive, Unarchive, Move to Trash, Restore, and permanent deletion from an item menu apply
  to the complete selection; Open, Open source URL, Rename, and Show in Explorer apply only to the
  item whose menu was opened. Multi-item menus label both scopes explicitly; single-item menus use
  the ordinary compact action layout without redundant scope labels.
- Select All through `Ctrl+A` or `Cmd+A` is a snapshot: later filter changes prune hidden selections
  but do not silently select newly revealed or newly created items. `Escape` clears the item selection.
- Changing view does not change item order or selection.
- The current context can be sorted by newest or oldest first, by title, or grouped by item type;
  the chosen order applies equally to Masonry, Grid, Focus, keyboard focus order, range selection,
  and detail navigation.
- Changing the sort preserves the item selection, and the most recently selected sort is restored
  on the next launch.
- Selected items remain unmistakable in Masonry and Grid through the existing checked marker and
  high-contrast accent. Focus uses a quieter semantic tint for every active or bulk-selected item
  while preserving distinct accessible states.
- Focus defaults to a single-column Index rail of compact 52-pixel, text-first rows for sequential
  scanning beside the complete detail. Index shows relative time, a secondary Note, URL, Image, or
  File badge, and optional domain, dimensions/format, or file-extension detail without acquiring
  thumbnails; the Visual density remains the media-rich browsing option.
- The Focus retrieval menu also offers the previous natural-height Visual card rail. The selected
  density persists per device. Active and bulk-selected items share the same calm tint without
  selection borders or check icons; Index alone retains a three-pixel leading accent for the active
  detail item.
- The most recently selected Masonry, Grid, or Focus view is restored on the next launch. Persisted
  Table or legacy List preferences fall back to Masonry while Table is unavailable.
- Hiding the sidebar gives the content area more space without hiding Search or Filter. View and
  appearance preferences remain reachable by reopening the sidebar from the persistent toolbar
  trigger.
- The expanded sidebar can be resized from 208 to 384 pixels with a pointer or keyboard, and its width is restored on the next launch.
- The standard keyboard zoom shortcuts resize the complete application interface, including the sidebar, toolbar, content, and dialogs, without adding permanent toolbar controls.
- The selected zoom level is restored on the next launch; `Ctrl+-`, `Ctrl++`, and `Ctrl+0` remain available as keyboard equivalents.
- On Windows 11 22H2 or newer, the application uses native Acrylic by default when Windows
  Transparency effects are available. **Translucent background** in the Settings dialog can disable
  it immediately and restores the chosen state on restart. Reduced-transparency and unsupported
  systems use the opaque presentation without discarding the saved preference.
- The toolbar and workspace read as one continuous, visibly translucent material. The sidebar uses
  a slightly heavier tint. Borders, cards, and sidebar hover/active fills use restrained translucent
  tokens, while dialogs, popovers, inputs, and preview surfaces stay solid.
- Folder rows use the same hover and selected-state fill, typography, and focus treatment as Inbox,
  All Items, Archive, and Trash without an additional selected-state ring.
- Reduced-transparency, increased-contrast, and forced-color preferences keep the shell surfaces
  opaque even when the stored translucency preference remains enabled.

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
- Moving or archiving notes also moves indexed sibling images when every inbound reference belongs
  to the moving note set. Shared, missing, untracked, and separately organized images stay in place
  while the moved notes' relative embeds are rewritten. Feedback reports both outcomes.
- Explicitly renaming, moving, archiving, or collision-restoring an image rewrites every inbound
  reference transactionally and reports the number of notes updated.
- Moving a referenced image to Trash first warns with affected note names and requires a current
  reference review. Confirmed deletion leaves the Markdown unchanged so the note shows a
  missing-image warning; restoring to the original path repairs it without rewriting.
- Permanently deleting notes offers an unchecked **Also move unused images to Trash** option only
  for images with no remaining references from active, archived, or trashed notes.
- Legacy companion `.assets` directories retain their existing note-coupled move and delete behavior.
- Rename and deletion commands expose their `F2` and `Delete` equivalents in item overflow and
  context menus across Masonry, Grid, and Focus.
- Item overflow and context menus apply lifecycle actions to the complete selection and preserve the
  same Undo, reference-warning, and permanent-delete confirmation safeguards as the bulk toolbar.
- Kuskus never deletes the original external file from which an item was imported.
