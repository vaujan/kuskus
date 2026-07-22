# Interface Specification

Status: Draft v0.1  
Last updated: 2026-07-14

## Design intent

Kuskus is a visual layer over a user-controlled local library. It should feel calmer and more visual than a file manager while retaining familiar desktop behaviors.

Visual references:

- MyMind for format-aware cards, natural card heights, and a personal visual canvas.
- Are.na for content density, limited chrome, and mixed content presented without heavy containers.
- The project wireframes for the combined toolbar/title bar and expandable folder sidebar.

Kuskus should borrow interaction ideas, not reproduce another product's branding or social features.

## Application shell

The primary window contains:

1. A collapsible folder sidebar.
2. A combined action toolbar and draggable title-bar region.
3. A scrollable saved-content area.
4. Native window controls on Windows.

The shell supports two explicit states.

### Expanded sidebar

- Sidebar appears on the left at a 256-pixel initial width, can be resized from 208 to 384 pixels, and spans the full application height.
- The action toolbar and title bar begin to the right of the sidebar; the sidebar must not sit below them.
- Menu and Hide Sidebar controls remain accessible near the top.
- Inbox, collections, and Trash are displayed in the sidebar.
- The toolbar and content occupy the remaining width.

### Hidden sidebar

- The content area expands across the available width.
- Menu and Show Sidebar controls move into or remain accessible from the toolbar.
- Search, Filter, the New item action, active context, and window controls remain visible.
- View and appearance preferences remain reachable by reopening the sidebar from its persistent
  toolbar trigger; they are not duplicated in the toolbar.
- Hiding the sidebar never changes the active collection.

Sidebar visibility and the most recently selected width should persist between launches. The resize handle supports pointer dragging and keyboard adjustment.

## Sidebar contents

- The current library is shown as context in the final row at the bottom of the sidebar. Clicking
  anywhere on that row opens **Open Another Library**, **Create New Library**, and **Copy Library
  Path** actions without presenting the identity row as a destination selector.
- A **Settings** row appears immediately above the library identity. Its menu contains the persisted
  Masonry, Grid, and Table selection plus explicit Light and Dark appearance choices. System mode,
  accent color, and font controls may appear as clearly disabled future options until implemented.
- Inbox is a primary destination, visually separate from user-created folders.
- The **Folders** heading's add action is revealed on hover or keyboard focus. Each folder's overflow action follows the same behavior and opens a menu with change-icon, rename, and remove controls; removal is confirmed and permitted only for an empty folder.

Minimum structure:

```text
Inbox
All Items

Collections
  Productivity SaaS
  Kettlebell Training
  + New collection

Trash
Settings
```

Requirements:

- The selected destination has a clear active state.
- Item counts are optional and must not create visual noise.
- Collection rename and deletion are available from a context menu.
- Folder creation and rename open focused dialogs instead of editing inline in the sidebar. Both
  can be canceled without saving, and creation includes an optional icon button whose default is
  the standard folder glyph.
- A searchable dialog offers a curated, keyboard-accessible set of folder icons. Icon choices use
  the interface foreground colors rather than user-defined colors.
- Changing an icon persists immediately; a failed save leaves the previous icon intact and keeps
  the picker available for recovery.
- Deleting a non-empty collection requires a clear choice for its items.
- Nested collections are not required in the MVP.

## Toolbar

The toolbar contains, in responsive order:

- A left zone containing only Show or Hide Sidebar.
- A centered retrieval zone containing scoped Search and Filter.
- A right action zone containing New item and its retained-draft discard action when applicable.
- Windows minimize, maximize/restore, and close controls.

Rules:

- The three application zones share one continuous title-bar surface; native window controls remain
  separate operating-system chrome at the far edge.
- Search grows within a centered retrieval zone and names its active scope, for example
  **Search Inbox…**.
- Interactive controls must be excluded from the draggable title-bar region.
- The active context must remain understandable when the sidebar is hidden through the scoped
  search copy.
- Narrow layouts collapse the Filter label and secondary search status before reducing the usable
  search width. New item may collapse to its accessible icon only after those secondary labels.
- Toolbar controls match the compact sidebar menu-row height and use the same theme radius token.
- Toolbar horizontal gutters match the saved-content workspace gutters at ordinary and large
  desktop widths.
- Standard keyboard zoom shortcuts resize the complete application interface in fixed steps from 80% to 125% without adding permanent toolbar controls.
- The selected zoom level persists between launches; `Ctrl+0` resets the interface to 100% without requiring a persistent percentage readout.
- `Ctrl+-`, `Ctrl++`, and `Ctrl+0` perform Zoom Out, Zoom In, and Reset Zoom respectively; the equivalent Command shortcuts work on macOS.

## Content views

### Masonry view - default

- Responsive masonry-style columns.
- Cards use natural heights and format-aware presentation.
- Recommended minimum card width: 240-280 pixels, subject to prototype evaluation.
- Column count follows available width rather than fixed breakpoints alone.
- Expanded sidebar will commonly show three columns; hidden sidebar may show three or four.

### Grid view

- Consistent card dimensions for faster comparison and denser scanning.
- Content uses `object-fit` or appropriate clipping without distorting previews.
- Additional text is truncated predictably.

### Table view

- Compact semantic table rows optimized for scanning saved items.
- Columns are Name, Type, and Added; sorting and row action menus are not required.
- Rows open the existing item detail and remain keyboard accessible.
- Horizontal overflow should be avoided at ordinary desktop widths.

Changing views must preserve scroll context where practical, item selection, filter state, and item ordering.

## New Item

A primary **New item** button appears in the toolbar's right action zone. The resting content canvas contains saved items only; activating the button summons one temporary draft card at the beginning of the active view.

### Toolbar state

- The action uses a plus icon and visible label at ordinary widths, collapsing to an accessible icon at narrow widths.
- When a hidden draft exists, the action reads **Continue draft**, shows a quiet indicator, and exposes explicit discard.
- Repeated activation scrolls to and focuses the existing card rather than creating another draft.

### Draft card

- Uses a normal Masonry or Grid card width and grows vertically to a capped editing height.
- Appears as a standalone full-width card above Table.
- Receives keyboard focus without dimming, blurring, or disabling the saved-content canvas.
- Accepts URLs, clipboard images, dropped or selected images, plain text, and Markdown without a type picker.
- Keeps the active destination visible; the current implementation saves to Inbox until collection item persistence is available.
- Uses a short interruptible opacity/scale entrance and an instant reduced-motion alternative.

### Detection and feedback

- A single URL shows a URL-saving state and may display the recognized domain.
- An image in an empty card shows an immediate local preview and saves as an image item.
- An image added after Markdown has begun is staged as a local note attachment, receives a collision-safe readable filename, and inserts a relative Markdown reference at the cursor.
- A URL added after Markdown has begun remains part of the note.
- Multiple files show the detected count and per-import or aggregate progress.
- Text remains editable as Markdown.
- Unsupported or ambiguous pasted text defaults to a note whenever preserving it is safe.
- Staged note images appear as compact thumbnails with progress, Retry, and Remove actions.
- Errors appear inside the card and do not erase its contents.

### Completion

- Recognized URLs, images, and files begin saving immediately after paste or drop.
- Notes expose **Save** and support `Ctrl+Enter`; typed content is retained as a draft until committed or discarded.
- On success, the draft cross-fades into the format-aware saved card in the same position.
- If retrieval filters exclude the new item, success remains visible briefly before the card dismisses with an explanation.
- Existing cards reflow without changing pages or losing the user's current scroll context.
- URL metadata can continue loading on the new card after the local URL record is safe.

### Direct capture

- Pasting while the content canvas has focus invokes the same detection and saving pipeline without requiring a preliminary click.
- Direct paste summons the draft card so its destination and progress are visible.
- Dragging valid files over the window reveals a clear drop target connected to New Item.
- Paste and drop events are ignored by the global capture handler when a different text field intentionally owns them.

### Cancellation and draft safety

- `Escape` and Close hide the card when no save, stage, or import is active.
- Hidden Markdown and staged local images remain recoverable per library across card reopen and app restart.
- Discard is explicit and removes both the renderer-local text and controlled staged assets.
- A failed import remains visible with Retry and Remove actions.
- Changing collections while a draft or import is active must resolve, preserve, or explicitly cancel that work; it must not silently lose it.

## Card anatomy

All cards may include:

- Primary preview or content excerpt.
- Title or filename.
- Lightweight type/source indicator.
- Optional overflow menu.
- Selected, focused, loading, failed, and missing-content states.

Masonry and Grid cards use a preview-first hierarchy:

- The shared outer frame is transparent; media previews and text excerpts are the visible surfaces.
- Image and URL titles appear in compact captions below their previews, with source metadata kept quiet.
- Note excerpts retain a restrained text surface so they remain readable beside media.
- Masonry view preserves natural content heights. Grid view aligns type-specific preview surfaces without distorting media.
- Hover, press, and keyboard focus feedback apply to the visible surface rather than adding permanent chrome around the full item.
- Loading, failed, and missing-content placeholders preserve the expected surface dimensions.

Type-specific rendering:

| Type         | Masonry content                          | Supporting information    |
| ------------ | ---------------------------------------- | ------------------------- |
| URL          | Page image or neutral fallback           | Title, domain, favicon    |
| Image        | Natural-ratio thumbnail                  | Optional title or caption |
| Video URL    | Page/video thumbnail with play indicator | Title and source domain   |
| Note         | Readable text excerpt                    | Optional derived title    |
| PDF          | First page when available                | Filename and page count   |
| General file | File preview or type icon                | Filename, extension, size |

Metadata should remain subordinate to the content in Masonry view.

## Card interactions

- Single-click selects.
- Ctrl-click toggles an item in multi-selection.
- Shift-click selects a range where ordering is stable.
- Double-click performs the primary action.
- Enter opens the selected item's focused detail dialog.
- Space opens quick preview when implemented.
- Delete moves selected items to Trash after appropriate confirmation.
- Right-click and the overflow control expose the same context menu.

Minimum context menu:

- Open.
- Open source URL, when applicable.
- Move to collection.
- Rename or edit details.
- Copy path, when applicable.
- Copy source URL, when applicable.
- Move to Trash.

## Item detail

The MVP uses one focused, read-only dialog rather than a permanent application side panel. The
dialog uses most of the available window so content remains the dominant surface without squeezing
the library canvas between two sidebars.

The dialog has no dedicated header. Previous, next, and close actions use a compact floating
control group in its upper-right corner while retaining 40-pixel desktop hit areas.

At ordinary desktop widths, images and URLs use two panes:

- A flexible preview pane for the large image or URL preview.
- A compact right inspector containing the title, a borderless property list, and the available
  primary action. Property rows use field-specific icons with aligned label and value columns;
  image format and dimensions remain separate, independently scannable fields.

Notes use a single, centered reading pane without a right inspector or nested card surface. Their
accessible dialog title remains available to assistive technology without adding visible chrome.

Below the two-pane breakpoint, the preview and inspector stack vertically inside one scrollable
dialog. The inspector is not manually collapsible and its visibility is not persisted.

The detail dialog exposes:

- Larger preview when supported.
- The complete rendered note body without card-style clipping, plus a compact selector for Read,
  Edit, and Source. Read and Edit share one WYSIWYG Markdown canvas; `Ctrl+E` toggles only those two
  modes and returns Source to Read without entering Source.
- Edit keeps Markdown markers hidden, provides contextual formatting and slash controls, and
  autosaves a valid changed note approximately 800 ms after typing stops.
- Source exposes the raw Markdown in a monospace text editor and uses the same autosave, validation,
  conflict, restore, and immediate-flush behavior as Edit. Unsupported raw HTML remains available
  in Read and Source while Edit is disabled.
- Headings render uniformly at their default bold weight. Nested bold, italic, inline-code, and
  strikethrough markers remain in the source but add no visual heading treatment, and their toolbar
  actions are omitted when a WYSIWYG selection intersects a heading.
- The insertion caret and contextual-control focus indicators maintain at least 3:1 contrast in
  light and dark themes. Selecting text opens a compact icon toolbar with accessible names,
  pressed states, and delayed tooltips; `Alt+F10` moves focus into it and `Escape` returns focus to
  the canvas. Activating Link dismisses this toolbar before Milkdown's focused link input opens, so
  the two editor overlays never compete for the same selection.
- Typing `/` at the end of an otherwise active text block opens one grouped command list for Text,
  Lists, and Advanced blocks. Continued typing filters without moving focus from the canvas;
  arrows, Home/End, Enter, and Escape operate only while the list is open.
- `Ctrl+Enter` flushes autosave immediately. The header announces Saved, Saving, failure, blank,
  and conflict states; a failed or blank draft can restore the last saved body.
- Close or previous/next navigation flushes pending work before leaving. External-edit conflicts
  retain the draft and offer a side-by-side Markdown diff before the user explicitly chooses a version.
- The detail surface begins below the application title bar, while a standard-strength, blur-free
  backdrop dims the complete window. Dialog-owned Windows minimize, maximize/restore, and guarded
  close controls remain above it while all other underlying toolbar actions and workspace keyboard
  shortcuts stay modal.
- Note bodies and responsive image and URL details use the shared shadcn ScrollArea treatment; the
  note mode header and floating detail controls remain fixed outside their scroll owner.
- Source URL or stored filename.
- Added date for image and URL items.
- Dimensions and media format for images.
- A validated **Open link** action for URL items. Pressing `Ctrl+Enter` while a URL detail is open
  performs the same action, and the button displays the shortcut beside its label.
- A compact, icon-led **Show in Explorer** action for every item. The action reveals local content when present and falls back to the authoritative item metadata for links or missing content.
- Previous and next controls that follow the current visible, filtered item order without wrapping.

`Left Arrow` and `Right Arrow` perform the same previous and next actions. `Escape` closes the
dialog and focus returns to the card that opened it. Missing local content remains openable: the
preview shows an explicit warning. Healthy availability and metadata states are implicit; the
interface only presents a status message when something is missing or unavailable.

The detail interface must not become a general-purpose knowledge-management property editor.

## Search and filtering

- Search is scoped to the active context by default.
- The interface makes the scope visible.
- Search covers title, note text, domain/URL, and filename.
- Filter initially supports item type.
- Clearing search and filters returns to the previous collection view.
- Empty results distinguish "no saved items" from "no matches."

## States

Required states include:

- First-run library setup.
- Empty Inbox.
- Empty collection.
- Active drag-and-drop.
- Import in progress.
- URL metadata loading.
- Metadata unavailable.
- Missing local content.
- Read-only or unavailable library.
- No search results.
- Trash and permanent-delete confirmation.

## Accessibility and keyboard behavior

- Every action is keyboard reachable.
- Focus indicators are visible in light and dark themes.
- Icon-only buttons include accessible names and tooltips.
- Tooltips open after a short hover delay and use a simple arrowless surface.
- Color is not the only indication of selection, error, or item type.
- The content collection uses predictable focus movement.
- Reduced-motion preferences are respected.
- Contextual editor controls preserve the document selection during pointer use and expose their
  expanded, active, and selected states to assistive technology.

## Visual constraints

- Dark and light themes are supported; dark may remain the initial default.
- Dark mode uses a cool-ink canvas with subtly stepped sidebar, card, and popover surfaces rather than pure black backgrounds.
- Content previews receive more visual weight than borders and panels.
- Rounded cards and spacing should be restrained enough to preserve useful density.
- Social metrics, follower actions, recommendations, and promotional surfaces are absent.
