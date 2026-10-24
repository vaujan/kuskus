# Kuskus UI Audit

Status: Implementation-ready audit
Audited: 2026-07-15
Scope: Current loading, setup, workspace, capture, note, and image interfaces; forward standards for the remaining MVP
Foundation: Electron 39, React 19, Tailwind CSS 4, shadcn `base-vega`, Base UI, Lucide, Inter Variable

## Executive summary

The current interface already has a coherent restrained desktop direction, semantic theme tokens, a secure application shell, and good use of the installed shadcn primitives. The strongest parts are the persistent sidebar model, inline capture concept, compact visual language, local-library context, and initial reduced-motion support.

The next UI pass should not be a redesign. It should first protect capture work, then make the minimum window usable, then establish one content-led card and canvas system. The audit found **2 P0**, **7 P1**, **9 P2**, and **2 P3** items.

The supplied 1918×1015 dark-theme screenshot confirms the main visual issue: shell chrome, context header, Add Item, and saved cards have similar weight while the wide canvas remains mostly empty. Source inspection also shows that the current “Visual” view is an auto-fill grid rather than the specified natural-height masonry presentation.

### Priority model

| Priority | Meaning                                                           |
| -------- | ----------------------------------------------------------------- |
| **P0**   | Blocks capture safety, recovery, or a required accessibility path |
| **P1**   | Materially harms a golden workflow or ordinary usability          |
| **P2**   | Visible inconsistency or polish problem                           |
| **P3**   | Optional refinement with low workflow impact                      |

## Evidence and coverage

### Baseline matrix

| Surface or state           | Dark                | Light               | Minimum 680×500        | Default 1120×720 | 1440×900      | Wide screenshot | Evidence status            |
| -------------------------- | ------------------- | ------------------- | ---------------------- | ---------------- | ------------- | --------------- | -------------------------- |
| Loading                    | Token/source review | Token/source review | Source review          | Source review    | Source review | —               | Implemented                |
| First-run setup            | Token/source review | Token/source review | Source review          | Source review    | Source review | —               | Implemented                |
| Unavailable library        | Token/source review | Token/source review | Source review          | Source review    | Source review | —               | Implemented                |
| Empty Inbox                | Token/source review | Token/source review | Source review          | Source review    | Source review | —               | Partial: Add Item only     |
| Populated Inbox            | Visual + source     | Token/source review | Responsive calculation | Source review    | Source review | Supplied image  | Implemented                |
| Search / no results        | Token/source review | Token/source review | Source review          | Source review    | Source review | —               | Implemented                |
| Compact composer           | Visual + source     | Token/source review | Responsive calculation | Source review    | Source review | Supplied image  | Implemented                |
| Expanded note composer     | Token/source review | Token/source review | Responsive calculation | Source review    | Source review | —               | Implemented                |
| Image import progress      | Token/source review | Token/source review | Responsive calculation | Source review    | Source review | —               | Implemented                |
| Import failure             | Token/source review | Token/source review | Source review          | Source review    | Source review | —               | Partial: global error only |
| Missing note/image content | Token/source review | Token/source review | Source review          | Source review    | Source review | —               | Implemented                |
| Sidebar shown/hidden       | Visual + source     | Token/source review | Responsive calculation | Source review    | Source review | Supplied image  | Implemented                |
| Active drag/drop           | —                   | —                   | Source review          | Source review    | Source review | —               | Missing visual state       |

“Token/source review” means the state was verified against its rendered classes, semantic tokens, and control logic. Only the user-supplied populated dark workspace was available as direct visual evidence; the remaining cells define the required screenshot regression matrix for the implementation pass and must not be treated as visually signed off.

### Supplied screenshot annotations

| Region                 | Evidence                                                                                    | Interpretation                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **A — left 0–320px**   | Sidebar includes disabled All Items, Collections action, Trash, Settings, and roadmap prose | Unavailable destinations read as broken product UI and pull attention from working capture behavior             |
| **B — top 0–60px**     | Search, disabled Filter, one-option Visual selector, and window controls share a dense row  | Search has room at this width, but the fixed controls cannot fit beside the 16rem sidebar at the 680px minimum  |
| **C — content header** | Inbox/count/path and “Newest First” sit below toolbar controls                              | Active context is understandable, but sort is presented as passive text and hierarchy is split across two bands |
| **D — first card**     | Add Item is 368×240px with most of its area empty                                           | Capture is obvious but louder and taller than a visually quiet compact entry point needs to be                  |
| **E — note cards**     | Type/title/action header and divider consume roughly half of short-note cards               | Repeated titles and chrome outweigh the saved content                                                           |
| **F — canvas**         | Four fixed columns occupy the first row while most vertical space is unused                 | The layout reads as a uniform grid, not a mixed-format visual library                                           |

## Findings

### Capture safety and recovery

| ID    | Priority | Screen / source                                                    | Evidence and rationale                                                                                                                                                                                                                            | Before                                                                                                     | After                                                                                                                                                                                                                                         |
| ----- | -------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI-01 | **P0**   | Expanded composer; `App.tsx:270–305, 376–384`                      | Draft state is component-local. Escape only closes an empty composer, while the close button silently does nothing for a non-empty draft. There is no retained draft or discard confirmation, violating the draft-safety golden workflow.         | A non-empty composer cannot be closed and gives no explanation; a reload loses the draft.                  | Persist the draft for the active destination and let Close/Escape collapse while retaining it, or show an `AlertDialog` with **Keep editing** and **Discard**. Restore the draft on reopen and clear it only after save or confirmed discard. |
| UI-02 | **P0**   | Failed image import; `App.tsx:307–338, 390–401`                    | The `File` is held only in the async function. On failure, the preview URL remains but there is no recoverable file reference, Retry, or Remove action; the error is rendered outside the composer. Clipboard content may no longer be available. | Failed import leaves a preview labelled “Importing image…” plus a global alert, with no valid next action. | Store an import attempt object containing the `File`, preview URL, name, and status. Render the error inside the composer with **Retry** and **Remove**. Revoke the URL and clear state only on success or removal.                           |
| UI-03 | **P1**   | Successful note/image capture; `App.tsx:287–297, 331–338, 350–365` | Collapsing mounts a new compact Add Item button, but no ref or focus restoration is provided. Keyboard focus can fall back to the document after commit.                                                                                          | Save/import collapses the composer without a deterministic focus destination.                              | Give compact Add Item a stable ref and focus it after successful commit, removal, or empty Escape; announce success through a restrained live region or toast only when needed.                                                               |
| UI-04 | **P1**   | Direct drag/drop; `App.tsx:742–780, 833–846`                       | Drag-over only calls `preventDefault`; no state is tracked and no visible drop target is rendered. Direct import also lacks the inline preview/progress used by composer paste.                                                                   | Files can be dropped on an apparently unchanged canvas and saving happens without visible progress.        | Track `isDragging` and the active import attempt. Show a clear canvas drop target visually connected to Add Item, then route drop and paste through the same composer import state. Clear drag state on leave/drop.                           |
| UI-05 | **P1**   | Expanded composer; `App.tsx:842–846`                               | The backdrop is `pointer-events-none`, so saved cards and toolbar controls remain clickable while capture is expanded. Navigation or open actions can interrupt an unresolved draft/import.                                                       | The canvas looks subdued but remains fully interactive behind the composer.                                | Keep the active context visible, but prevent pointer interaction with the saved-content region while expanded. Leave only explicitly safe shell actions enabled and resolve active work before navigation.                                    |

### Responsive shell and hierarchy

| ID    | Priority | Screen / source                                                                         | Evidence and rationale                                                                                                                                                                                                         | Before                                                                                                      | After                                                                                                                                                                                                                                                                              |
| ----- | -------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI-06 | **P1**   | Expanded sidebar at 680×500; `sidebar.tsx:24–28`, `App.tsx:795–831`, `index.ts:175–178` | The 16rem sidebar leaves 424px. Toolbar minimums require roughly 160px search + Filter + Visual + 144px window controls before gaps/padding, so the row cannot fit. The interface spec requires core actions at narrow widths. | Labels and fixed minimum widths overflow or squeeze the search at the supported minimum window.             | Below a shell breakpoint based on available inset width, collapse Filter/View to icon-only tooltips, remove the search `min-w-40`, and automatically use the sidebar sheet/off-canvas behavior. Keep window controls fixed and preserve active-context text in the content header. |
| UI-07 | **P2**   | Workspace shell; `App.tsx:795–860`                                                      | Search/filter/view occupy the toolbar while title/count/path/sort occupy a second band. “Newest First” looks interactive but is plain text; the path receives stronger prominence than useful content metadata.                | Two bands compete without a clear distinction between actions, context, and passive metadata.               | Treat the title bar as global actions, and the content header as active context plus actual sort/filter state. Keep path subordinate and expose its full value via tooltip/copy action rather than visual prominence.                                                              |
| UI-08 | **P2**   | Sidebar; `App.tsx:665–704`                                                              | Disabled roadmap controls and explanatory prose expose implementation status in the product surface. They look unavailable rather than intentionally deferred.                                                                 | All Items, New Collection, Trash, and Settings are visible but disabled; Collections contains roadmap copy. | Render only working destinations in dogfooding builds. Add each destination when its workflow exists; use a product empty state such as “No collections yet” only once collection creation is enabled.                                                                             |
| UI-09 | **P2**   | Empty and search states; `App.tsx:849–900`                                              | Empty Inbox has no dedicated message, while no-results says “No Matching Notes” even though image titles participate in search. Count and sort still describe the unfiltered library.                                          | Empty Inbox is only an Add Item card; search terminology and counts are note-specific or ambiguous.         | Distinguish **Empty Inbox** from **No matching items**. Keep Add Item first, add a quiet first-use explanation, use item-neutral copy, and show result count/filter state when searching.                                                                                          |

### Visual canvas and card anatomy

| ID    | Priority | Screen / source                                         | Evidence and rationale                                                                                                                                                                                     | Before                                                                                  | After                                                                                                                                                                                                                                                                             |
| ----- | -------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI-10 | **P1**   | Visual view; `App.tsx:877–891`, `main.css:90–94`        | CSS Grid auto-fill aligns items into rows and cannot pack following items beneath shorter cards. Note cards also have a fixed minimum height. This does not meet the accepted responsive masonry decision. | “Visual” is a uniform row grid with `minmax(17rem, 1fr)` and large dead zones.          | Implement Visual as responsive masonry-style columns with a 15–17rem evaluated minimum and natural heights. Preserve source order, keyboard order, scroll context, and Add Item as the first logical/visual item. Reserve the existing uniform row behavior for future Grid view. |
| UI-11 | **P2**   | Compact Add Item; `App.tsx:350–365`, `main.css:284–297` | The 12rem minimum height and bottom-anchored label leave excessive empty space. The nested rounded icon surface uses a radius similar to its parent rather than a concentric relationship.                 | A large dashed card competes with saved items and uses an accent-tinted custom surface. | Use the same compact rhythm as an ordinary short card, reduce vertical dead space, keep the prompt visible, and use semantic Card/Button treatment. If retaining the inset icon surface, calculate its outer/inner radii concentrically.                                          |
| UI-12 | **P2**   | Note cards; `App.tsx:490–534`                           | Type, title, explorer action, divider, and body create two equally weighted regions. Short notes repeat their derived title in the header and body.                                                        | Card chrome can occupy more space than the note itself.                                 | Lead with the note excerpt/heading, place type and overflow/reveal actions in a lightweight metadata row, suppress duplicated first-line titles in the excerpt, and remove depth borders that do not communicate structure.                                                       |
| UI-13 | **P2**   | Image cards; `App.tsx:579–617`                          | Images have no neutral inset outline. Loading and missing states use different visual structures and the missing state has no recovery/reveal action near the message.                                     | Preview edges can disappear into card backgrounds; loading/error layouts shift.         | Add a 1px inset pure-black/10 outline in light mode and pure-white/10 in dark mode. Reserve preview geometry with a Skeleton and keep title/actions stable across loading, ready, and missing states.                                                                             |

### Accessibility and interaction semantics

| ID    | Priority | Screen / source                                                                                   | Evidence and rationale                                                                                                                                                                                          | Before                                                                                                                    | After                                                                                                                                                                                                                                           |
| ----- | -------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI-14 | **P1**   | Image card keyboard path; `App.tsx:571–617`                                                       | A focusable `div` behaves like an action without button/link semantics or an accessible name. Enter on the nested Explorer button bubbles to the card key handler, potentially triggering both Reveal and Open. | Screen readers receive a generic group; keyboard Enter on a child action can invoke two actions.                          | Use a semantic primary-action button/link overlay or an explicit `role="button"` only if native composition is impossible. Give it an accessible name, isolate nested actions, and stop child key events from invoking the card primary action. |
| UI-15 | **P1**   | Toolbar, cards, alerts; `App.tsx:376–387, 603–616, 646–648, 798–800, 866–873`; `button.tsx:24–32` | Several important controls use 24px or 32px boxes. The dense-desktop quality target is 40×40px, and icon-only controls are inconsistent about tooltips.                                                         | Close, reveal, sidebar, and dismiss actions have small targets; some rely on accessible names without visible hover help. | Preserve compact 16px icons but provide non-overlapping 40×40px targets. Add tooltips to non-standard icon actions; keep Windows controls at their native 48px width and accessible labels.                                                     |
| UI-16 | **P2**   | Content canvas; `App.tsx:833–841`                                                                 | `main tabIndex={0}` creates an unlabeled extra Tab stop solely to receive global paste. It has no visible focus treatment or instructions.                                                                      | Keyboard users land on a generic main region with no indicated action.                                                    | Handle paste at the workspace/document level while excluding owned text inputs, or label the focusable region and provide a visible focus treatment plus capture instruction. Avoid a silent generic Tab stop.                                  |
| UI-17 | **P2**   | Markdown preview; `App.tsx:461–487`                                                               | Markdown headings are rendered as `<p>`, and layout uses `space-y-2`, contrary to the established gap-based composition rule. Long UI prose does not consistently use pretty wrapping.                          | Visual weight suggests headings without semantic structure; spacing relies on sibling margins.                            | Render safe semantic heading/list structures where appropriate, use flex/grid with `gap-*`, apply `text-balance` to short headings and `text-pretty` to short descriptions. Do not apply wrapping utilities to long note bodies.                |

### Motion, primitives, and visual-system consistency

| ID    | Priority | Screen / source                                                     | Evidence and rationale                                                                                                                                                                              | Before                                                                           | After                                                                                                                                                                                                                                                                                                 |
| ----- | -------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI-18 | **P2**   | Shared primitives; `button.tsx:7`, `badge.tsx:8`, `sidebar.tsx:281` | Shared wrappers contain `transition-all`; buttons use a 1px translate press while Add Item uses only hover lift. Broad transitions monitor unrelated properties and interaction feedback varies.    | Motion behavior is inconsistent and can animate unintended style/layout changes. | Replace `transition-all` with explicit color, box-shadow, opacity, transform, or dimension properties. Standardize eligible button press feedback at interruptible `scale(0.96)`; provide a static escape hatch for window controls and spatially sensitive actions. Retain reduced-motion overrides. |
| UI-19 | **P3**   | Global typography; `main.css:224–248`                               | Inter is applied globally, but font smoothing is not applied and headings/descriptions lack a consistent wrapping policy.                                                                           | Rendering weight can vary on macOS and short text can orphan.                    | Apply antialiased font smoothing once at the root, balance short headings, pretty-wrap short descriptions, and retain tabular numerals for changing counts.                                                                                                                                           |
| UI-20 | **P3**   | Responsive CSS; `main.css:319–336`                                  | The `.desktop-sidebar`, `.nav-label`, and `.sidebar-button` selectors are not used by the current shadcn Sidebar implementation. The media query gives a false impression of narrow-layout support. | Dead responsive rules obscure the actual 680px behavior.                         | Remove the unused selectors after implementing responsive behavior through Sidebar state/data attributes and the toolbar’s actual component classes.                                                                                                                                                  |

## Implementation waves

### Wave 1 — Capture safety and shared foundations

1. Implement recoverable note drafts and the discard/retain decision.
2. Model image imports as explicit idle/importing/failed/saved attempts with Retry and Remove.
3. Restore focus after capture and provide scoped status announcements.
4. Update Button/Badge/Sidebar transition properties, press behavior, hit areas, root smoothing, and wrapping utilities.

Acceptance: UI-01, UI-02, UI-03, UI-15, UI-18, and UI-19 pass in both themes with keyboard-only and reduced-motion testing.

### Wave 2 — Shell and navigation

1. Extract an application-level toolbar boundary so responsive label collapse is isolated from window controls.
2. Make the shell fit at 680×500 with sidebar shown and hidden.
3. Remove disabled roadmap navigation from the working product surface.
4. Clarify context, search scope, results, sort, and empty-state language.

Acceptance: no horizontal clipping at supported sizes; active context remains clear with the sidebar hidden; all visible controls are enabled or explain a real unavailable state.

### Wave 3 — Universal capture presentation

1. Make compact Add Item shorter and quieter without moving it from first position.
2. Use one inline composer state machine for click, direct paste, and drop.
3. Add the active drag target and prevent unsafe behind-composer interaction.
4. Keep errors and progress inside the composer without erasing content.

Acceptance: compact, expanded, importing, failed, retrying, saved, retained-draft, and discarded states are visibly distinct and content-safe.

### Wave 4 — Cards and Visual canvas

1. Introduce shared item-card anatomy for preview, content, lightweight metadata, status, and actions.
2. Implement true Visual masonry behavior; retain uniform layout for the future Grid mode.
3. Correct image-card semantics and nested-action event handling.
4. Standardize loading, missing-content, selection, focus, and reveal behavior.

Acceptance: mixed natural heights pack without visual row gaps; DOM/keyboard order remains stable; every card has one unambiguous primary action and equivalent context-menu access when implemented.

### Wave 5 — Remaining MVP checkpoints

| Future surface          | Required audit checkpoint                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| URL cards               | Provisional and metadata-failed cards retain the original URL, stable position, domain, Open URL, and Show in Explorer                   |
| PDF/general files       | Stable preview geometry, type/size metadata, missing-preview fallback, Open, Reveal, and progress for large imports                      |
| Collections             | Empty/active states, rename/delete menus, safe draft resolution before navigation, and clear item destination                            |
| Selection/context menus | Selected, focused, hover, and multi-selected states are distinct without color alone; right-click and overflow expose equivalent actions |
| Filter and sort         | Use real controls only when functional; expose scope and active values; clearing restores the prior collection view                      |
| Grid/List               | Preserve ordering, selection, search/filter state, and scroll context; List avoids ordinary-width horizontal overflow                    |
| Item detail             | Use a titled `Sheet` or focused `Dialog`; keep editing limited to title, note, source/file, collection, date, Open, and Reveal           |
| Trash                   | Distinguish recoverable move, restore, and permanent deletion; use a titled `AlertDialog` for permanent deletion                         |
| Read-only/unavailable   | Explain whether browsing, copying, reveal, or repair remains available; never present a writable-looking composer                        |

## Regression checklist

### Visual and responsive

- Capture dark and light screenshots at 680×500, 1120×720, 1440×900, and the wide reference size.
- Test sidebar shown/hidden at each size and verify no horizontal clipping.
- Compare empty, populated mixed-format, expanded composer, importing, failed, missing-content, and no-results states.
- Verify card preview/title/action geometry does not jump between loading, ready, and error states.

### Keyboard and accessibility

- Traverse all enabled controls in DOM order with visible focus in both themes.
- Verify `Ctrl+B`, Escape, `Ctrl+Enter`, Enter on cards, and Enter on nested actions have exactly one outcome.
- Verify successful save, import, discard, and error dismissal place focus predictably.
- Confirm every icon-only action has an accessible name and, when not a native window convention, a tooltip.
- Confirm error, selection, missing content, and item type are not communicated by color alone.

### Capture and state safety

- Create a note, retain/discard a draft, restart with a retained draft, and retry/remove a failed image import.
- Paste an image into the composer and focused canvas; drop an image; ensure one event creates exactly one item.
- Verify import errors keep usable content and are rendered in the composer.
- Verify opening or hiding the sidebar never changes the active context.

### Engineering gates

- Run `pnpm typecheck`.
- Run `pnpm lint`.
- Run `pnpm build`.
- Re-run focused storage tests whenever capture-state changes touch the preload or main process, although this audit recommends no IPC or storage-contract changes.

## Constraints retained

- Keep Base UI-backed shadcn wrappers, Lucide, Tailwind 4 semantic tokens, Inter, and the existing theme mechanism.
- Add no motion or styling dependency; use interruptible CSS transitions.
- Do not change preload, IPC, storage, or shared domain contracts solely for visual polish.
- Prefer installed primitives. Use `Alert`, `Empty`, `Sheet`, `ToggleGroup`, `Tooltip`, `Skeleton`, and `Spinner` rather than custom substitutes, and use `AlertDialog` when destructive confirmation is implemented.
- Keep imported content local, preserve external sources, and never let presentation work weaken capture or recovery guarantees.
