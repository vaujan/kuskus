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

- Sidebar appears on the left at a stable, resizable or fixed initial width and spans the full application height.
- The action toolbar and title bar begin to the right of the sidebar; the sidebar must not sit below them.
- Menu and Hide Sidebar controls remain accessible near the top.
- Inbox, collections, and Trash are displayed in the sidebar.
- The toolbar and content occupy the remaining width.

### Hidden sidebar

- The content area expands across the available width.
- Menu and Show Sidebar controls move into or remain accessible from the toolbar.
- Search, Filter, View, active context, and window controls remain visible.
- Hiding the sidebar never changes the active collection.

Sidebar visibility should persist between launches.

## Sidebar contents

- The current library is shown as non-interactive context at the top of the sidebar. A separate overflow action provides **Open Another Library**, **Create New Library**, and **Copy Library Path** without presenting the identity row itself as a selector.
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
- Folder creation includes an optional icon button. The default remains the standard folder glyph.
- A searchable dialog offers a curated, keyboard-accessible set of folder icons. Icon choices use
  the interface foreground colors rather than user-defined colors.
- Changing an icon persists immediately; a failed save leaves the previous icon intact and keeps
  the picker available for recovery.
- Creating a folder can be canceled without saving its entered name.
- Deleting a non-empty collection requires a clear choice for its items.
- Nested collections are not required in the MVP.

## Toolbar

The toolbar contains, in responsive order:

- Menu/application actions.
- Show or Hide Sidebar.
- Active collection title or breadcrumb.
- Search.
- Filter.
- View selection.
- Windows minimize, maximize/restore, and close controls.

Rules:

- Search may grow to consume available width.
- Interactive controls must be excluded from the draggable title-bar region.
- The active context must remain understandable when the sidebar is hidden.
- Narrow layouts may collapse labels into icons with tooltips, but core actions remain reachable.
- Standard keyboard zoom shortcuts resize the complete application interface in fixed steps from 80% to 125% without adding permanent toolbar controls.
- The selected zoom level persists between launches; `Ctrl+0` resets the interface to 100% without requiring a persistent percentage readout.
- `Ctrl+-`, `Ctrl++`, and `Ctrl+0` perform Zoom Out, Zoom In, and Reset Zoom respectively; the equivalent Command shortcuts work on macOS.

## Content views

### Visual view - default

- Responsive masonry-style columns.
- Cards use natural heights and format-aware presentation.
- Recommended minimum card width: 240-280 pixels, subject to prototype evaluation.
- Column count follows available width rather than fixed breakpoints alone.
- Expanded sidebar will commonly show three columns; hidden sidebar may show three or four.

### Grid view

- Consistent card dimensions for faster comparison and denser scanning.
- Content uses `object-fit` or appropriate clipping without distorting previews.
- Additional text is truncated predictably.

### List view

- Compact rows optimized for filenames, domains, dates, paths, and bulk operations.
- Columns may include Type, Title, Collection, Added, and Size.
- Horizontal overflow should be avoided at ordinary desktop widths.

Changing views must preserve scroll context where practical, item selection, filter state, and item ordering.

## Add Item

The first position in the active content view contains a visually quiet **Add item** card. It is a universal inline composer, not a launcher for separate content-type forms.

### Compact state

- Occupies the first item position.
- Shows a prompt such as **Paste or start typing...**.
- Uses the dimensions of an ordinary compact card and does not dominate saved content.
- Remains visible when saved items are present.

### Expanded state

When activated:

- The card expands in place into a large writing and paste surface anchored to its original area.
- Keyboard focus enters the editor immediately.
- The saved-content canvas remains visible behind it but is dimmed or softly blurred to emphasize capture.
- The composer accepts URLs, clipboard images, dropped or pasted files, plain text, and Markdown through the same surface.
- The composer does not ask the user to select an item type before entry.
- At most one composer is expanded in the window.

The expanded surface should be large enough for comfortable note writing but must not appear to be a separate page. The active collection remains visible or otherwise understandable.

### Detection and feedback

- A single URL shows a URL-saving state and may display the recognized domain.
- An image shows an immediate local preview before or during import.
- Multiple files show the detected count and per-import or aggregate progress.
- Text remains editable as Markdown.
- Unsupported or ambiguous pasted text defaults to a note whenever preserving it is safe.
- Errors appear inside the composer and do not erase its contents. Failed image imports retain the selected file for explicit **Retry** or **Remove** actions during the session.

### Completion

- Recognized URLs, images, and files begin saving immediately after paste or drop.
- Notes expose **Save** and support `Ctrl+Enter`; typed content is retained as a draft until committed or discarded.
- On success, the composer collapses and clears its committed content.
- The saved card is inserted immediately after Add Item, visually beside it when space allows.
- Existing cards reflow without changing pages or losing the user's current scroll context.
- URL metadata can continue loading on the new card after the local URL record is safe.

### Direct capture

- Pasting while the content canvas has focus invokes the same detection and saving pipeline without requiring a preliminary click.
- Direct paste may briefly expand or highlight the composer so the destination and progress are visible.
- Dragging valid files over the window reveals a clear drop target connected to Add Item.
- Paste and drop events are ignored by the global capture handler when a different text field intentionally owns them.

### Cancellation and draft safety

- `Escape` and Close collapse the composer when no save or import is active.
- Closing a composer containing an uncommitted note retains the draft per library across composer reopen and app restart. The compact Add Item card indicates that a draft is waiting.
- A failed import remains visible with Retry and Remove actions.
- Changing collections while a draft or import is active must resolve, preserve, or explicitly cancel that work; it must not silently lose it.

In List view, Add Item may render as a full-width composer row rather than a card, but it follows the same lifecycle and detection rules.

## Card anatomy

All cards may include:

- Primary preview or content excerpt.
- Title or filename.
- Lightweight type/source indicator.
- Optional overflow menu.
- Selected, focused, loading, failed, and missing-content states.

Visual and Grid cards use a preview-first hierarchy:

- The shared outer frame is transparent; media previews and text excerpts are the visible surfaces.
- Image and URL titles appear in compact captions below their previews, with source metadata kept quiet.
- Note excerpts retain a restrained text surface so they remain readable beside media.
- Visual view preserves natural content heights. Grid view aligns type-specific preview surfaces without distorting media.
- Hover, press, and keyboard focus feedback apply to the visible surface rather than adding permanent chrome around the full item.
- Loading, failed, and missing-content placeholders preserve the expected surface dimensions.

Type-specific rendering:

| Type         | Visual content                           | Supporting information    |
| ------------ | ---------------------------------------- | ------------------------- |
| URL          | Page image or neutral fallback           | Title, domain, favicon    |
| Image        | Natural-ratio thumbnail                  | Optional title or caption |
| Video URL    | Page/video thumbnail with play indicator | Title and source domain   |
| Note         | Readable text excerpt                    | Optional derived title    |
| PDF          | First page when available                | Filename and page count   |
| General file | File preview or type icon                | Filename, extension, size |

Metadata should remain subordinate to the content in Visual view.

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
- The complete read-only note body without card-style clipping.
- Source URL or stored filename.
- Added date for image and URL items.
- Dimensions and media format for images.
- A validated **Open link** action for URL items.
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
- Color is not the only indication of selection, error, or item type.
- The content collection uses predictable focus movement.
- Reduced-motion preferences are respected.

## Visual constraints

- Dark and light themes are supported; dark may remain the initial default.
- Content previews receive more visual weight than borders and panels.
- Rounded cards and spacing should be restrained enough to preserve useful density.
- Social metrics, follower actions, recommendations, and promotional surfaces are absent.
