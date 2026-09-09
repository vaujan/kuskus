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

- On wide screens, the standard edge-aligned sidebar appears on the left at a 256-pixel initial
  width, can be resized from 208 to 384 pixels, and spans the full application height.
- The action toolbar and title bar begin to the right of the sidebar; the sidebar must not sit below them.
- Menu and Hide Sidebar controls remain accessible near the top.
- Inbox, All Items, nested folders, Archive, and Trash are displayed in the sidebar.
- The toolbar and content occupy the remaining width as one edge-to-edge surface. No hard border
  separates that surface from the sidebar.
- Narrow and medium sidebar flyouts use the floating sidebar surface and a short opacity transition.
  They do not shift, dim, or blur the canvas.

### Hidden sidebar

- The content area expands across the available width.
- Menu and Show Sidebar controls remain accessible from the active view's title bar.
- Masonry and Grid retain Search, Filter, New item, active context, and window controls. Focus keeps
  sidebar, active context, retrieval, and New item controls in its visual rail while window controls
  occupy the detail pane's upper-right corner.
- View and appearance preferences remain reachable by reopening the sidebar from its persistent
  toolbar trigger; they are not duplicated in the toolbar.
- Hiding the sidebar never changes the active collection.

Sidebar visibility and the most recently selected width should persist between launches. The resize handle supports pointer dragging and keyboard adjustment.

## Sidebar contents

- The current library is shown as context in the final row at the bottom of the sidebar. Clicking
  anywhere on that row opens **Open Another Library**, **Create New Library**, and **Copy Library
  Path** actions without presenting the identity row as a destination selector.
- A **Settings** row appears immediately above the library identity. It opens a floating,
  non-modal **Settings** panel at the right edge. The workspace remains visible and interactive so
  appearance changes can be judged against real content. The panel presents Appearance, Editing,
  and Capture groups in one scrollable column, remains open during workspace interaction, and
  closes from its close action or `Escape`.
- Appearance separates a curated color theme (**Kuskus**, **Graphite**, **Moss**, **Clay**,
  **Solarized**, **Catppuccin**, or **One Dark**) from color mode (**Light**, **Dark**, or
  **System**). Solarized uses its canonical paired schemes, Catppuccin pairs Latte with Mocha, and
  One Dark pairs with Atom's One Light colors. Every theme supplies both light and dark semantic
  tokens. A compact **Typography** matrix exposes primary and fallback choices for both **UI font**
  and **Code font**. Font pickers are searchable and preview every option in its own typeface.
  Bundled and generic choices are available immediately; **Use fonts from this computer…** requests
  local-font access only after explicit interaction, then adds installed font families to every
  picker. Generic `sans-serif` and `monospace` families always terminate their respective stacks.
  A live UI-and-code sample makes both changes observable even when the workspace has no code in
  view. Changes apply and persist immediately across the main workspace, detached note windows, and
  quick capture. Appearance also exposes interface scale, supported native window
  material, and a reset to the default Kuskus dark appearance with Inter.
- On Windows, Appearance includes **Translucent background**. It is enabled by default on Windows
  11 22H2 or newer, applies native Acrylic behind a visibly translucent, continuous toolbar/content
  material and a slightly heavier sidebar, and persists as app-local presentation state. Borders,
  cards, and sidebar interaction fills use restrained translucent semantic tokens; dialogs,
  popovers, inputs, and preview surfaces remain solid. When Windows Transparency effects are off,
  the checked preference remains stored but the control is disabled with guidance to Accessibility
  settings and the renderer becomes opaque. Older Windows versions show the platform requirement;
  non-Windows builds omit the control.
- Inbox is a primary destination, visually separate from user-created folders.
- The **Folders** heading's add action is revealed on hover or keyboard focus. Each folder shows its
  destination item count at rest. Its overflow action replaces that count only while the row is
  hovered, or while the action itself has keyboard-visible focus, and provides add-subfolder,
  change-icon, move, rename, and remove controls.

Minimum structure:

```text
Inbox
All Items

Collections
  Productivity SaaS
  Kettlebell Training
  + New collection

Archive
Trash
Settings
```

Requirements:

- The selected destination has a clear active state.
- Folder destinations use the same active and hover surface as the primary and lifecycle sidebar
  destinations; nesting does not add a second selected-state outline.
- Sidebar rows use a full-width, square-edged interaction surface. Selection adds a three-pixel blue
  rail at the sidebar edge plus a restrained semantic tint; hover uses only a weaker tint, and
  keyboard focus and drag-over retain separate inset rings.
- Navigation item counts use tabular numerals and reflect destination totals rather than active
  search or type filters. Folder counts include descendants, include zero, and update after moves.
- Collection actions are available from both the overflow control and a right-click context menu.
- Folder creation and rename open focused, name-only dialogs instead of editing inline in the
  sidebar. Both can be canceled without saving.
- Folder rows show a validated, user-selectable icon between the disclosure control and name without
  increasing the compact row height. Names, counts, and hierarchy remain visually primary.
- Deleting a folder with direct items clearly states that they move to Inbox. A folder with
  subfolders cannot be removed, and refusal happens before any item mutation.
- Nested collection rows form a semantic expandable tree, retain stable selection across folder
  renames, and use a separate keyboard-accessible chevron so selecting a folder never toggles it.
- Folder icons and names remain on one fixed alignment rail at every nesting depth. Disclosure
  controls overlay the leading utility gutter only for folders with children; faint guide lines and
  branch connectors communicate depth without shifting content and visually cap their offset after
  four levels.
- Folder branches start expanded, remember collapsed folder IDs per library as disposable local UI
  state, reveal the selected folder's ancestors, and select an active descendant's ancestor when
  that branch is collapsed.
- The Folders section action creates a root folder. Each folder menu exposes **Add subfolder**;
  successful child creation expands its parent but does not change the current destination.
- Selecting a folder displays its complete subtree while capture targets the exact selected folder.
- Item and multi-item drags may target Inbox or any folder. Folder drags reparent folders; dropping
  on the Folders section moves to the root. Invalid ancestry targets are refused without mutation.
- Item drags use a capped, elevated preview that preserves the pointer's grab offset. The source
  item remains in its layout position at reduced opacity; multi-item drags add restrained stacked
  depth and a count badge. Inbox and folder targets respond with a small lift plus an inset shadow.
- Move menus and dialogs preserve tree indentation and icons, identify the current destination, and
  disambiguate same-name folders in different branches.

The Capture group in Settings shows the **Global capture** shortcut and whether its system-wide
registration is checking, available, or unavailable. The registered key combination can be
recorded directly from the panel. A registration conflict keeps the previous shortcut and reports
the failure without closing Settings.

Settings has no Library category. Library layout and sorting stay in the library toolbar, Focus
rail density stays in the Focus toolbar, and note reading width and inline title stay in the note
View menu so their effects remain directly observable. **Show referenced attachments** lives in a
**Visibility** group in the Masonry/Grid toolbar Filter menu and Focus rail Filter menu. It is off by default so images already embedded by
notes do not duplicate the visual canvas. The preference persists per device, contributes to the
active-filter badge, applies in Masonry, Grid, and Focus, and resets with **Clear filters**.
An uninitialized vault uses a preview screen listing detected notes, images, files, folders, and the
exact Kuskus metadata changes. Schema-v1 libraries use a migration screen that explains the retained
sibling backup and reports completion or a recoverable failure.

If automatic legacy bookmark cleanup cannot safely distinguish generated metadata from user-authored
content, the workspace shows a persistent repair notice. It identifies the number of unchanged files
without exposing arbitrary native paths to renderer operations.

## Toolbar

Masonry and Grid use the complete retrieval toolbar. It contains, in responsive order:

- A left zone containing only Show or Hide Sidebar.
- A centered retrieval zone containing the global Search trigger and the combined Sort and Filter
  menu.
- A right action zone containing primary New note, secondary Add item, and the retained-capture
  discard action when applicable. `Ctrl+N` belongs to New note.
- Windows minimize, maximize/restore, and close controls.

Focus removes the global toolbar and starts both panes at the top of the window. One integrated rail
row contains Show or Hide Sidebar, a compact global Search trigger, the active destination label, a
combined Sort and Filter menu, New note, and Add item.
Windows controls occupy the detail pane's upper-right corner, or the full-width rail row during
narrow list-first navigation. Unoccupied pane chrome remains draggable.

Rules:

- The three application zones share one continuous title-bar surface; native window controls remain
  separate operating-system chrome at the far edge.
- On Windows, renderer-owned caption controls use the documented Segoe Fluent `ChromeMinimize`,
  `ChromeMaximize`, `ChromeRestore`, and `ChromeClose` glyphs. Their neutral hover and pressed fills
  follow the active light or dark appearance, and Close uses the standard Windows red states.
- The overview Search trigger grows within the centered retrieval zone, names its library-wide
  behavior, and shows `Ctrl+K` when space permits. The Focus rail uses an icon button so search does
  not compete with the item detail.
- Interactive controls must be excluded from the draggable title-bar region.
- The active context remains visible beside the compact Search trigger in Focus when the sidebar is
  hidden.
- Narrow layouts collapse the Filter label and Search shortcut hint before reducing the usable
  Search trigger width. New item may collapse to its accessible icon only after those secondary
  labels.
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
- Items retain source order across columns: each logical row fills from left to right before the
  next row, even when unequal card heights leave column bottoms uneven.
- Recommended minimum card width: 240-280 pixels, subject to prototype evaluation.
- Column count follows available width rather than fixed breakpoints alone.
- Expanded sidebar will commonly show three columns; hidden sidebar may show three or four.
- Large result sets mount in ordered pages of approximately 100 cards. Additional pages load before
  the scroll position reaches the end, without changing the established sort order or selection.

### Grid view

- Consistent card dimensions for faster comparison and denser scanning.
- Content uses `object-fit` or appropriate clipping without distorting previews.
- Additional text is truncated predictably.

### Table view

- Table is unavailable while its retrieval model and toolbar behavior are reconsidered. Its retained
  renderer implementation is not reachable from Settings, and persisted Table or legacy List
  preferences resolve to Masonry.
- Compact semantic table rows optimized for scanning saved items.
- Columns are Name, Type, and Added; sorting and row action menus are not required.
- Rows open the existing item detail and remain keyboard accessible.
- Horizontal overflow should be avoided at ordinary desktop widths.

### Focus view

- A responsive item rail sits beside the complete item detail surface for sequential triage,
  reading, and editing. The rail starts at 420 pixels, resizes from 320 to 720 pixels without
  exceeding 45 percent of the content pane, and persists its width and selected density per device.
  Index is the first-use default; Visual remains available from the combined retrieval menu.
- Normal activation updates the detail and clears bulk selection. Ctrl-click, Cmd-click, and
  Shift-click retain the existing multi-selection without changing the active detail; active and
  selected rows use distinct accessible states.
- Index presents one minimum-height 88-pixel text-first row per item with a title of up to two lines,
  a compact metadata line containing relative modified time, a secondary Note, URL, Image, or File
  badge, and optional domain, dimensions/format, or file-extension detail, followed by one truncated
  supporting-text line. It renders no thumbnails or replacement type icons and acquires no media
  previews; Visual remains the media-rich density.
- Active and bulk-selected Index rows use the same full-width semantic tint. The active detail row
  alone retains a three-pixel leading accent and `aria-current`; bulk selection retains
  `aria-pressed` without adding a border, halo, check icon, or text indentation. Hover, keyboard
  focus, dragging, context menus, and the 40-pixel trailing action target remain distinct.
- Visual reuses the natural-height compact Masonry cards and ordered multi-column rail. Active and
  bulk-selected cards use the same wrapper tint with no leading accent, selection border, halo, or
  check icon, while `aria-current` and `aria-pressed` remain distinct. Masonry and Grid retain their
  existing selection treatment. Up, Down, Home, and End follow the shared logical item order in both
  Focus densities.
- One rail row contains the sidebar trigger, destination-scoped Search, the combined Sort and Filter
  menu, New note, and Add item. `Ctrl+K` and `Ctrl+F` focus Search; `Ctrl+N` opens the full note editor.
- Search, filters, and sorting do not forcibly close an active detail. Destination, view, library,
  item, and window-close transitions flush guarded note work before leaving.
- At content widths below 760 pixels, Focus becomes list-first drill-in navigation. Activating an
  item replaces the list with detail, while New item remains in the list. Continuing a captured note
  in the editor drills into its saved detail, and a visible Back action returns to the preserved list
  state.
- The list and detail own independent scroll areas. A keyboard-operable vertical separator adjusts
  the rail at wide widths.

Changing views must preserve scroll context where practical, item selection, filter state, and item ordering.

As the saved-content viewport scrolls beneath the fixed toolbar, its top edge uses a subtle
gradient mask that grows with the scroll offset up to 24 pixels. The mask is absent at the scroll
origin, applies consistently across Masonry, Grid, and each Focus scroll owner, and does not fade the scrollbar.

## New Note

- `Ctrl+N` and the primary **New note** action open the same full-detail editor from every library
  view, preserving the previous workspace state for Back or empty Escape.
- An ephemeral selected **Untitled note** rail entry anchors the editor before persistence. It
  disappears silently when abandoned without a meaningful edit.
- The ephemeral entry uses the active density's normal saved-note row or card, and the detail pane
  starts in the normal Live Preview note surface. The mode controls, title region, canvas padding,
  and toolbar geometry remain identical when the first edit creates the backing file; saved-only
  actions reserve their normal space until they become available.
- Non-whitespace Markdown and embedded attachments create the note. A single URL remains Markdown
  note content. The body receives initial focus; there is no required title field or Save button.
- `Ctrl+N` opens a fresh note after flushing meaningful edits, but only refocuses an untouched
  ephemeral note. Normal note-mode, formatting, find, undo/redo, Vim, and explicit flush shortcuts
  apply before and after persistence.
- Creation failures appear in the normal overlaid note recovery notice with Retry and Restore. The
  notice never pushes, resizes, replaces, or remounts the editor.
- The first human-readable line derives the title and continues to track edits. Explicit rename
  switches to a custom title; **Use first line as title** restores derived behavior.

## New Item

A secondary **Add item** button appears in the Masonry/Grid toolbar's right action zone and as an icon
action in the Focus rail header. The resting content canvas contains saved items only; activating the
button summons one temporary draft at the beginning of the active view.

### Toolbar state

- The action uses a plus icon and visible label at ordinary widths, collapsing to an accessible icon at narrow widths.
- When a hidden draft exists, the action reads **Continue draft**, shows a quiet indicator, and exposes explicit discard.
- Repeated activation scrolls to and focuses the existing card rather than creating another draft.
- Add item remains available independently of `Ctrl+N`; the global capture shortcut remains
  `Ctrl+Shift+Space`.

### Draft card

- Uses a normal Masonry or Grid card width and grows vertically to a capped editing height.
- Appears as a standalone full-width card above Table.
- Appears as a temporary first card in the Focus rail and leaves the current detail visible. Index
  density gives the card the full rail width above its compact rows.
- Receives keyboard focus without dimming, blurring, or disabling the saved-content canvas.
- Accepts URLs, clipboard images, dropped or selected images, plain text, and Markdown without a type picker.
- Keeps the active destination visible; inline capture snapshots the exact active collection, while
  quick capture and non-collection contexts target Inbox.
- Uses a short interruptible opacity/scale entrance and an instant reduced-motion alternative.
- Its empty prompt is overlaid independently from CodeMirror's measured document, so wrapping prompt
  text cannot create a scrollbar, scrollbar buttons, clipped text fragments, or an oversized caret.

### Detection and feedback

- A single URL remains editable, is recognized as a link, and may display the recognized domain.
- An image in an empty card is validated into controlled temporary storage, shows an immediate
  preview, and remains an image draft until confirmed.
- An image added after Markdown has begun is staged as a local note attachment, receives a
  collision-safe readable filename, and inserts a URL-encoded relative Markdown reference at the
  cursor. On save it becomes an independently browsable sibling file, hidden by the referenced-file
  filter by default.
- A pasted clipboard image immediately focuses a selected timestamp filename stem while showing its
  fixed detected extension. Typing replaces the default; Enter or blur accepts the value, Escape
  keeps the default, and focus returns to the preserved note position. Generated Markdown uses an
  empty alt (`![](…)`); later renames remain available from the note's Attachments panel.
- A URL added after Markdown has begun remains part of the note.
- Multiple files show the detected count and per-import or aggregate progress.
- Text remains editable as Markdown.
- Unsupported or ambiguous pasted text defaults to a note whenever preserving it is safe.
- Staged note images appear as compact thumbnails with inline filename editing, progress, Retry,
  and Remove actions.
- Errors appear inside the card and do not erase its contents.

### Completion

- Recognized URLs and images expose **Save link** or **Save image** and support `Ctrl+Enter`.
- Notes expose **Save note** and support `Ctrl+Enter`; in Focus and Quick Capture,
  **Continue in editor** or `Ctrl+Shift+Enter` commits the draft, selects the resulting note, and
  opens its normal live-autosaving editor. Quick Capture reveals the main window only for this
  explicit handoff. All detected content remains a recoverable draft until committed or discarded.
- Notes and images cross-fade directly into their format-aware saved cards. Links first replace the
  composer with a same-size, non-editable saving card.
- The link saving card uses **Saving link** while creating the local record and **Preparing preview**
  while attempting initial metadata and thumbnail retrieval. It is calm, centered, `aria-busy`, and
  preserves the final URL card footprint.
- A successful link saving state remains visible for at least 500 ms and yields after 12 seconds to
  the normal provisional card so slow networks cannot trap capture.
- If retrieval filters exclude the new item, success remains visible briefly before the card dismisses with an explanation.
- Existing cards reflow without changing pages or losing the user's current scroll context.
- URL metadata can continue loading on the new card after the local URL record is safe.

### Direct capture

- Pasting while the content canvas has focus invokes the same detection and saving pipeline without requiring a preliminary click.
- Pressing `Ctrl+Shift+Space` while Kuskus is running opens or focuses the shared composer in a
  singleton bottom-right Inbox popup without reading the clipboard. The main window retains its
  visibility, destination, retrieval, selection, detail, and dialog state unless the user explicitly
  chooses **Continue in editor**.
- The popup and inline card share one revisioned library-scoped session. Summoning global capture
  transfers editing ownership to the popup without replacing the draft or allowing duplicate saves.
- If the current owner is staging or accepting a submission, the requested surface shows a neutral
  waiting state and becomes editable automatically when that transient work ends. Hiding the waiting
  surface cancels its retry so it cannot reclaim the draft later.
- Direct paste summons the populated draft card so its destination, detected type, and confirmation
  action are visible; it does not bypass explicit commit.
- Dragging a supported image over the window reserves the first New Item slot with a static neutral
  silhouette instead of covering the canvas. Visual and Grid use a shadow card, Table uses a
  shadow row, and Focus reserves the capture-card slot in the rail without replacing the detail. On
  drop, the silhouette cross-fades into the existing confirmation composer; an open
  draft remains mounted and unchanged beneath the temporary silhouette.
- Unsupported-only file drags do not reserve a slot. Dropping them preserves the existing visible
  error behavior, and dropping a valid image still requires explicit **Save image** confirmation.
- Paste and drop events are ignored by the global capture handler when a different text field intentionally owns them.

### Quick-capture window

- The frameless, non-resizable window is 416 pixels wide when space allows, has no taskbar button,
  and sits 16 pixels from the bottom-right work-area edges on the pointer's monitor. Its direct
  composer height is validated and capped at approximately 70 percent of that work area.
- Inbox remains the implicit fixed destination without a visible destination label or selector.
  The popup has no header or visible window actions.
- The universal composer fills the rounded BrowserWindow as one continuous surface. It has no
  transparent gutter, external border, edge ring, shadow, or separately painted nested card or
  input panel. The save action always displays its `Ctrl+Enter` cue in this surface.
- Windows 11 22H2 and newer use native Acrylic beneath a 38-percent composer tint when Windows
  Transparency effects are available. Windows owns the outer rounded clipping so renderer material
  cannot bleed through square corners. Unsupported Windows versions, macOS, and Linux use the same
  rounded shape with an opaque CSS-clipped surface and no simulated desktop blur. Reduced-
  transparency, increased-contrast, and forced-color modes also paint an opaque accessible surface;
  forced colors may add an inset system outline.
- The renderer applies no opacity, scale, or position animation. Windows may use its native show
  animation while providing anti-aliased system corners.
- Escape or ordinary focus loss hides the window and retains unfinished content. Native
  file selection temporarily suppresses focus-loss dismissal.
- Save durably hands the current content and staged assets to an independent FIFO submission, resets
  the shared session, and hides the popup immediately after acceptance. The full vault write and URL
  enrichment may continue independently.
- The shortcut may immediately reopen a fresh editable composer while earlier submissions remain
  pending. Pending submissions never set the shared session's editing lock.
- A compact issue banner appears only when background captures fail. It opens the main-window
  recovery view without replacing the fresh draft.
- After the popup hides, opening New item in the main window continues the exact shared session in
  the inline composer.
- When no usable library is configured, the shortcut opens the main setup or recovery surface.

### Cancellation and draft safety

- `Escape` hides the card when no save, stage, or import is active.
- Hidden text, links, and staged local images remain recoverable per library across card reopen,
  library switches, and app restart.
- Discard is explicit and removes both the renderer-local text and controlled staged assets.
- A failed import remains visible with Retry and Remove actions.
- A failed accepted submission retains its immutable content and staged assets until the user
  retries it, restores it into an empty composer, or explicitly discards it.
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
- The overflow action is hidden at rest, appears on card hover or keyboard focus, and remains visible
  while its menu is open even when the pointer leaves the card.
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

URL and video preview surfaces place a compact source badge at the lower-right. Video previews add
an optically centered play indicator. Preview bytes come from the validated local cache rather than
remote renderer requests.

## Card interactions

- Single-click opens the item's focused detail dialog without leaving it selected after the dialog closes.
- Ctrl-click or Cmd-click toggles an item in multi-selection without opening it.
- Shift-click selects a range where ordering is stable without opening an item.
- Ctrl+A or Cmd+A selects every item matching the current destination and filters when
  focus is outside a text field or editor. The selection is a snapshot rather than a live query.
- Enter opens the selected item's focused detail dialog.
- Space opens quick preview when implemented.
- Escape clears the current item selection after any open contextual menu handles it first.
- `F2` renames the sole selected item, or the focused visible card or row when no selection exists.
  It is a quiet no-op for multiple selections and in Trash.
- `Delete` moves selected items, or the focused visible card or row, to Trash and exposes Undo.
  Referenced images first open a warning listing up to five affected note names plus a remaining
  count and require confirmation against the inspected reference revision. In Trash it opens
  permanent-delete confirmation. Modified variants such as `Shift+Delete` do nothing.
- `F2` and `Delete` are renderer-local and are suspended while text editing, menus, item details, or
  dialogs own the keyboard.
- Right-click and the overflow control expose the same context menu. Opening either menu on a
  selected item preserves the complete visible selection; opening it on an unselected item replaces
  the selection with that item.
- When more than one item is selected, the menu separates **This item** actions from a count-labelled
  **N selected** group. A single-item menu omits both scope labels and uses the ordinary compact
  action layout. Open, Open source URL, Rename, and Show in Explorer affect only the item whose menu
  was opened. Move,
  Archive, Unarchive, Move to Trash, Restore, and permanent deletion affect every selected item.
  Their concise action labels do not repeat the count already shown by **N selected**. Move evaluates
  the current locations of the complete selection.

Minimum context menu:

- Open.
- Open source URL, when applicable.
- Move to collection.
- Archive or Unarchive when applicable.
- Rename or edit details, with `F2` shown for Rename.
- Copy path, when applicable.
- Copy source URL, when applicable.
- Move to Trash, with `Delete` shown.
- Restore or permanently delete when viewing Trash, with `Delete` shown for permanent deletion.

Selecting more than one item reveals a compact contextual action toolbar centered above the bottom
edge of the content pane. A single selected item retains selection feedback but does not reveal or
reserve layout space for the bulk toolbar. The toolbar floats independently of the saved-content scroll viewport,
uses the same translucent material as popup menus, and does not shift the item layout. Its actions
match the active destination, remain keyboard accessible, and collapse from icon-and-label controls
to icon-only controls with accessible names and tooltips when space is constrained. The scroll
viewport reserves enough bottom space while the toolbar is visible for the final item row to remain
fully reachable.

Selected cards use a high-contrast outer accent halo, a restrained accent wash, and a persistent
checked badge at the upper-left. Selected table rows use the same checked marker with an
accent-tinted background and inset leading edge. These indicators remain distinct from hover and
keyboard focus in both themes and stay legible over bright, dark, and missing-content previews.

The saved-content canvas begins directly below the toolbar without a separate destination header.
Search keeps the active destination visible in a persistent, truncated scope label, including while
a query is entered or the sidebar is hidden. `Ctrl+A` or `Cmd+A` remains the Select All equivalent
and selects all matching items, not only items currently inside the scroll viewport.

## Item detail

Masonry and Grid use one focused detail dialog. Focus reuses the same complete detail body
as a persistent application pane, including note editing, guarded autosave, conflicts, attachments,
and item actions. The dialog uses most of the available window so content remains dominant; the
Focus pane instead shares the workspace with its compact item rail.

The dialog uses a compact utility row for note modes, navigation, reveal, item actions, and close
while retaining 40-pixel desktop hit areas. Focus instead uses one compact 40-pixel caption header:
The current item title remains geometrically centered, and a single note-mode menu plus More sit
immediately before the renderer-owned minimize, maximize or restore, and close controls. Focus
exposes no Back or Forward caption controls; Left Arrow and Right Arrow item navigation remain
available. The note identity stays with the document rather than the caption.

At ordinary desktop widths, images and URLs use two panes:

- A flexible preview pane for the large image or URL preview.
- A compact right inspector containing the title, a borderless property list, and the available
  primary action. Property rows use field-specific icons with aligned label and value columns;
  image format and dimensions remain separate, independently scannable fields.

Notes use a single reading pane without a right inspector or nested card surface. The note canvas
defaults to a centered 48-rem comfortable document measure with responsive gutters. A persistent
toolbar toggle lets the user expand the shared header, editor, and preview measure to the available
pane width. The item-identity header rests directly on that canvas without a nested card surface, so
the note reads as one continuous surface.
The compact editable title remains visually subordinate to headings authored inside the Markdown
document.
Note cards and the Read canvas use the same semantic Markdown typesetting rules so headings,
prose, lists, quotes, links, code, tables, math, and images retain one visual hierarchy across both
surfaces. Cards use a compact 15-pixel preset; the reading pane uses a 16-pixel preset.
The capture Live Preview consumes the compact preset, and saved Live mode consumes the reading
preset. Markdown source and the source side of Split remain monospace rather than inheriting the
rendered-document typeface.

Below the two-pane breakpoint, the preview and inspector stack vertically inside one scrollable
dialog. The inspector is not manually collapsible and its visibility is not persisted.

The detail dialog exposes:

- A compact, fixed utility row in the detail dialog. Focus removes that row and uses a single
  cross-platform caption header: the current item title occupies the true center, and a compact
  note-mode menu plus More sit beside the native window controls at the trailing edge. Back and
  Forward controls are omitted. Empty caption space remains draggable and macOS reserves its
  traffic-light inset.
- At desktop split widths, an available note shows **Expand note** at the caption's leading edge.
  Expanding enters a transient Zen presentation: the application sidebar, mounted item rail, and
  rail resize divider are hidden; the detail fills the workspace; and the document identity and
  metadata header are omitted. The sidebar and rail leave over the shared short spatial transition
  while the document settles into the expanded canvas; reduced motion makes the change immediate.
  Restoring the item rail also restores the sidebar to its prior state.
  The caption title, note-mode and More menus, window controls, document canvas, attachments, and
  critical save or conflict feedback remain available. The control becomes **Restore item rail**;
  `Escape` also restores the rail unless an editor, menu, popover, or dialog owns the key. Expansion
  survives previous or next navigation between notes, but resets for non-note items, capture,
  leaving Focus, or crossing below the split breakpoint. The rail retains its width, scroll, and
  selection while hidden, and the expansion preference is not persisted across app restarts.
- A quiet item identity immediately above the note content, with the editable title stacked above
  interactive metadata: active Inbox or folder context opens the existing move destination menu;
  Updated opens a Created and Updated timestamp popover; and the attachment count opens a bounded
  list with Rename, Show in Explorer, and Manage attachments actions. Metadata triggers and their
  dropdowns size to their content within bounded maximum widths. Archive and Trash context remains
  informational so moving cannot bypass restore semantics. The identity and its subtle bottom
  divider use the same comfortable or wide document frame as the note body. Read, Live, Markdown,
  and each Split pane share that responsive frame.
- Larger preview when supported.
- A directly editable visible title for every active item type. Clicking the title edits the same
  typography in place without field borders, backgrounds, controls, or other editing indicators.
  Enter or blur submits a non-empty change, Escape restores the current title, and a failed rename
  leaves the draft and error visible. Trash titles are not interactive.
- The complete rendered note body without card-style clipping, plus a compact four-icon segmented
  control for Read, Live, Markdown, and Split in the dialog utility row. Focus collapses those choices
  into one 40-pixel menu trigger whose icon reflects the active mode; the menu exposes all four modes,
  shortcuts, and the reading-width toggle. Every choice remains named for assistive technology.
- `Ctrl+E` toggles Read and Live and returns Markdown or Split to Live. `Ctrl+Alt+E` toggles Markdown
  source and Live. `Ctrl+Shift+E` toggles Split and returns to the previous single-pane mode.
- Live edits the authoritative source in one Obsidian-style CodeMirror canvas. Heading, emphasis,
  strikethrough, code, link, list, task, quote, fenced-code, rule, local-image, math, and wikilink
  decorations render in place. Markdown markers reappear on every line touched by the selection;
  decorations never modify, normalize, or independently persist document text. Its body and semantic
  decorations derive from the same 16-pixel typesetting preset as Read, so revealing markers does not
  resize the surrounding content. Read and Live also share responsive document gutters and list
  indentation, marker columns, foreground hierarchy, and vertical rhythm.
- Task widgets toggle `[ ]` and `[x]` through normal undoable editor transactions. Ctrl-click follows
  supported HTTP links and vault links without taking ordinary click-to-edit behavior away.
- Markdown exposes the authoritative source in a borderless, GFM-aware CodeMirror editor and
  autosaves a valid changed note approximately 800 ms after typing stops. Syntax color and heading
  scale are presentational; opening or switching modes never rewrites or normalizes the source.
  Every committed editor change updates the shared draft and Split preview immediately; the debounce
  delays disk persistence only.
- Split shows independently scrollable source and live sanitized preview panes. Scrolling either pane
  proportionally aligns the other, and the actively scrolled or edited pane remains the driver while
  content height or pane width changes. Both panes use the shared scrollbar treatment. Below 860
  pixels, Split remains selected but shows Markdown only.
- Raw HTML remains editable and persistable in Markdown but is not executed by Read.
- Headings support nested bold, italic, inline-code, and strikethrough treatment in cards and the
  Read canvas. Unformatted headings use a 400 weight and nested bold uses a 700 weight.
- The insertion caret follows the normal foreground color, and mode-control focus indicators maintain
  at least 3:1 contrast in light and dark themes. Selecting text never opens contextual UI. `Ctrl+B`
  and `Ctrl+I` wrap or unwrap the selection with GFM emphasis markers; an empty selection inserts
  paired markers around the caret.
- Selecting text already visible in the note or switching among Read, Live, Markdown, and Split preserves
  source selection and pane positions. The source selection highlight uses the shared neutral
  selection color only while the editor is focused; the logical selection remains after focus moves.
  Extending a selection beyond the viewport edge may still scroll intentionally.
- Typing `/` inserts an ordinary slash; the editor has no slash menu, block handles, drag controls,
  floating formatting toolbar, or fixed formatting toolbar.
- `Ctrl+Enter` flushes autosave immediately from Live, Markdown, or Split without adding routine save chrome. The header does not
  show Saved, Saving, or pending-save states; write failures and conflicts remain persistently visible
  and exposed to assistive technology. Empty content is a quiet temporary editing state and is not
  written over a previously populated note.
- Close, previous/next navigation, item changes, destination changes, and window close flush pending
  work before leaving. If a previously populated note was cleared, leaving moves its last persisted
  version to Trash and offers Undo. Notes that were already empty when opened, including external
  Obsidian vault files, remain unchanged. External-edit conflicts retain the draft and offer a
  side-by-side Markdown diff before the user explicitly chooses a version.
- Empty and whitespace-only notes render as identifiable **Empty note** cards with their stored title
  in Visual, Grid, and visual-density Focus rails rather than collapsing into blank surfaces.
- The detail surface begins below the application title bar, while a standard-strength, blur-free
  backdrop dims the complete window. Dialog-owned Windows minimize, maximize/restore, and guarded
  close controls remain above it while all other underlying toolbar actions and workspace keyboard
  shortcuts stay modal.
- Note bodies and responsive image and URL details use the shared shadcn ScrollArea treatment. The
  dialog utility row and integrated Focus caption remain fixed outside their scroll owner rather than
  floating over the scroll surface.
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

- `Ctrl+K` or either toolbar trigger opens one modal search surface from Overview, Focus rail, or an
  open item detail. Search is library-wide and independent of the active destination and filters.
- Opening search with an empty query shows up to eight recently opened items in recency order.
- Search covers title, note text, domain/URL, and filename.
- Every query term must match somewhere in the item. Exact, prefix, and partial title matches rank
  ahead of matches found only in supporting content.
- Full-note matching uses the main-process library index; card payloads need only bounded Markdown
  previews. Out-of-order search responses never replace results for newer input.
- Results use a compact text-first list with type and collection context. On wide layouts, the
  search field and result list occupy the left pane while the right pane presents the highlighted
  item's complete read-only content directly, without nesting another card surface. Truncated note
  summaries resolve to the complete note for this preview. Both panes use the shared ScrollArea
  treatment, and the preview identifies the item in one compact header row. Referenced note
  attachments remain hidden.
- Highlighting or moving through results never changes the workspace beneath the modal. `Escape`
  closes search with destination, selection, detail, and scroll context untouched.
- Opening a result closes search, selects the item's real Inbox, collection, Archive, or Trash
  destination, and opens its normal detail surface. Active type filters clear so the chosen item is
  present in its destination.
- Filter supports item type and a Visibility group for referenced attachments. Non-default type or
  visibility values activate the Filter badge and **Clear filters** resets both.
- Sorting offers newest first, oldest first, title A–Z, title Z–A, and grouping by item type within
  the active context. Sorting lives with item-type filtering in the retrieval zone's Filter menu,
  and an active non-default sort is visible on that control at rest.
- The selected sort persists between launches, applies to every view, and never changes the item
  selection.
- Closing search returns to the untouched workspace. Clearing filters preserves the current
  destination.
- Empty filter results distinguish "no saved items" from "no matches"; empty global search results
  remain inside the modal.
- Empty capture destinations (All Items, Inbox, and collections) offer a primary **New item**
  action and a quiet hint of capture methods, including the global capture shortcut when it is
  registered. Archive and Trash keep explanatory copy without capture actions.
- No-results states expose **Remove type filters** only when type filtering is active.

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
- No global search results.
- Referenced-image Trash review, missing-image warnings, and a distinct referenced-attachment
  warning within permanent-delete confirmation. The warning names affected notes and explains that
  Trash restore will no longer be available. Eligible note deletion also offers an unchecked
  **Also move unused images to Trash** option.
- Note detail exposes an attachment-count control and side panel with thumbnail, filename, relative
  path, shared count, Rename, and Show in Explorer. Invalid or conflicted note drafts guard rename.

## Accessibility and keyboard behavior

- Every action is keyboard reachable.
- Item menu commands publish matching `aria-keyshortcuts` values for `F2` and `Delete`.
- Focus indicators are visible in light and dark themes.
- Icon-only buttons include accessible names and tooltips.
- Tooltips open after a short hover delay and use a simple arrowless surface.
- Color is not the only indication of selection, error, or item type.
- The content collection uses predictable focus movement.
- Reduced-motion preferences are respected.
- Reduced-transparency, increased-contrast, and forced-color preferences replace translucent shell
  tokens with their opaque theme equivalents without changing the stored user preference.
- Sidebar visibility uses the shared short spatial transition whether triggered by its control or
  shortcut, while pointer resizing tracks directly without interpolation. Shortcut-driven search,
  selection, editor-overlay, item-detail, and dialog state changes are instantaneous. Dialog
  backdrops dim without blurring the workspace. Tooltips, capture transitions, Zen mode, and
  drag-over feedback use the shared motion timings; reduced motion removes positional and scale
  movement while retaining brief opacity or color feedback where it aids comprehension.
- Contextual editor controls preserve the document selection during pointer use and expose their
  expanded, active, and selected states to assistive technology.

## Visual constraints

- Dark and light themes are supported; dark may remain the initial default.
- Dark mode uses a cool-ink canvas with subtly stepped sidebar, card, and popover surfaces rather than pure black backgrounds.
- Content previews receive more visual weight than borders and panels.
- Rounded cards and spacing should be restrained enough to preserve useful density.
- Social metrics, follower actions, recommendations, and promotional surfaces are absent.
