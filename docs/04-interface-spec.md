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
- Errors appear inside the composer and do not erase its contents.

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

- `Escape` collapses an empty composer.
- Closing a composer containing an uncommitted note retains a draft or asks before discarding it.
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
- Enter opens the selected item or item detail, according to the final prototype decision.
- Space opens quick preview when implemented.
- Delete moves selected items to Trash after appropriate confirmation.
- Right-click and the overflow control expose the same context menu.

Minimum context menu:

- Open.
- Show in Explorer.
- Open source URL, when applicable.
- Move to collection.
- Rename or edit details.
- Copy path, when applicable.
- Copy source URL, when applicable.
- Move to Trash.

## Item detail

The MVP may use a side panel or focused dialog. It should expose:

- Larger preview when supported.
- Editable title and note.
- Source URL or stored filename.
- Collection.
- Created date.
- Open and Show in Explorer actions.

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
