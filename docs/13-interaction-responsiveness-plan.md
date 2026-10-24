# Interaction Responsiveness Plan

Status: Active; builds on `11-performance-improvement-plan.md` and
`12-in-app-performance-optimization-plan.md`, which are implemented.

## Objective

Make ordinary interaction feel smooth in the packaged app: typing in the note editor, typing in the
search box, rapid keyboard input anywhere, and open-the-vault-first-time. The existing throughput and
bundle budgets are kept; this plan adds **interactivity** as a first-class measured axis.

The existing harness measures cold-start cost, main-process mutation cost, bundle bytes, memory, and
passive long tasks. It does **not** measure keystroke-to-paint latency, dropped frames, or total
blocking time during typing. Those are exactly the numbers behind the current "not very smooth"
feeling, so no optimization here is accepted without an interactivity measurement gate.

## Completed

- **First-open indexing is now explained to the user.** Initializing a large existing vault triggers a
  one-time full scan and cache build (`.kuskus/index/library-v1.json`). A Sonner loading toast
  ("Indexing your vault…") now explains the one-time cost during initialization instead of showing a
  bare "Working…" button.
  - `src/renderer/src/lib/notify.tsx` — `notifyVaultIndexingStarted` / `dismissVaultIndexing`
  - `src/renderer/src/features/library/setup-screen.tsx` — `prepareSelectedVault`

- **Search typing no longer queries per keystroke or blanks the list.** The search box was the worst
  offender. Each keystroke fired an IPC `queryItems` full-body scan, and the list emptied between
  results.
  - Debounced commit (150 ms, instant on clear): `use-library-retrieval.ts:61-68`.
  - Progressive refinement — last resolved results stay visible while the next query resolves:
    `use-library-retrieval.ts:108-110`.

- **Note autosave no longer rebuilds the library.** `updateNote` returns the updated note DTO from the
  in-memory record snapshot and writes the cached index once, instead of calling `buildLibraryDto`
  (full visible-file walk + per-file stat + DTO rebuild). Newly committed items (a note's attachments)
  are reconciled into the cached library by `updateLibraryDto`, which only rebuilds changed/missing
  records.
  - `library-service.ts` — `refreshChangedItem`; call sites in `updateNote`, `createNote`,
    `commitCaptureSubmission`.
  - `library-store.ts` — `updateLibraryDto` appends records missing from the cached library.

- **One renderer library update per save.** The autosave `onSaved` result is the single owner for
  app-owned note writes; the vault watcher ignores the note's own path for a short window after an app
  write, so it no longer broadcasts a second, full `refreshVault` → `setLibrary`.
  - `library-service.ts` — `markAppOwnedWrite` / `isAppOwnedWrite`, checked in the watcher callback.

- **Typing interactivity is now measured.** The packaged runner drives real input (5-char search then
  clear, 10-key note-editor burst) and reports keystroke-to-paint, dropped frames, long tasks,
  `queryItems`/`updateNote` IPC round-trips, and full-vault-scan count, with p95 budgets asserted in
  `scripts/measure-packaged-performance.cjs --typing`.
  - `performance-log.ts` — shared NDJSON writer + IPC round-trip timing hook.
  - `performance-reporter.ts` — typing instrumentation (per-key keystroke-to-paint via rAF, dropped
    frames, long tasks), scenario driver (focus → settle → warm-up key → measured burst), and
    first-card dedupe.
  - `library-store.ts` / `library-service.ts` — env-gated full-scan counter.
  - `scripts/measure-packaged-performance.cjs` — `--typing` mode aggregates medians/p95 across runs
    and exits nonzero when a budget regresses or a scenario does not reach an interactive workspace.

## Validation notes

The harness was validated against the packaged build on the development machine (2,000-item fixture).
Two separate conclusions follow from the runs, and they must not be conflated:

- **Cold-start cost is machine-bound.** First card took 16–25 s, the first `getOverview` 16–21 s. Disk
  and fixture-build work like this does not transfer to a normal desktop, so absolute cold-start
  numbers here are not a fair gate.
- **Note-editor keystroke-to-paint is app-side, not machine-bound.** At steady state each keystroke
  in Markdown source mode blocked the renderer for roughly one second (10-key burst: 11.2 s → 0.97 s
  per key). The renderer on this machine demonstrably can run at 60 FPS (rAF fired 1,100+ times per
  phase), and comparable Electron note apps (Obsidian) type smoothly here. Typing in our editor does
  far more per keystroke than an editor alone should: it re-runs several O(doc) scans and reconciles
  the whole detail-dialog tree. A slow machine magnifies that cost, but the cost is ours to remove.
  **Phase 3 is therefore warranted, not merely gated.**

What the runs confirm, architecture-wise:

- `updateNote` IPC dropped from the 16–21 s full rebuild to **~120–140 ms** per save.
- `getOverview` right after a save returns in ~1 ms (no rescan).
- **`autosaveScans` = 0** during the note-typing burst: the autosave performs no full vault scan.
- `queryItems` returns in ~6 ms after the debounce.
- Search keystroke-to-paint p95 settled at ~190 ms (down from ~370 ms as the scenario stabilized),
  which is close to the 150 ms search debounce plus render cost — see Phase 4.

## Reference architectures

The goal is Obsidian-like smoothness. The three mature designs that matter here:

- **Joplin (Markdown source editor + separate preview).** Typing touches _only_ the CodeMirror 6
  editor: the parser is incremental and only viewport lines render. The preview pane lives in its own
  iframe/webview and receives HTML via `setHtml`; it is _decoupled_ from typing, so a heavy preview
  never blocks a keystroke. Joplin also fixed (issue #9891) that a _hidden_ preview pane must not
  re-render at all — hiding a pane used to cost seconds on long notes because the viewer stayed
  mounted.
- **Obsidian (CodeMirror 6 "live preview").** One editor renders the document with decorations
  (replace widgets for rendered math/images/tasks, mark decorations for styling); only the active
  line reveals raw syntax, and decoration state fields use narrow invalidation so editing costs
  O(change), not O(doc).
- **SiYuan / Anytype (block editors).** ProseMirror-style block models; editing re-renders only the
  edited block, never the document.

Common thread: **the editor itself is the typing surface and everything else is either out of the
per-keystroke path or rendered incrementally.** Our note editor violates this twice — the whole
dialog re-renders per keystroke, and the react-markdown preview re-parses the whole document per
keystroke when visible. Phase 3 closes that gap using the Joplin model, which fits our existing
four-mode architecture; it does not require building Obsidian's in-editor live preview.

## Current evidence

Observation on the current tree (Windows, 5,000-item vault):

- Quick Capture (a small isolated window) is responsive under rapid keys; the main workspace is not.
  This isolates the problem to main-workspace renderer/main-process churn, not global input handling.
- The search box lagged far more than the note editor. Root cause was per-keystroke IPC + list
  blanking; addressed above.

Confirmed hot paths that remain:

1. ~~**Note autosave rebuilds the whole library every ~800 ms of typing.**~~ Implemented (above).
2. ~~**Each save causes two renderer `setLibrary` calls.**~~ Implemented (above).
3. **The note editor re-runs O(doc) work and re-renders the whole dialog per keystroke** (rich
   support scan, frontmatter parse, hidden panes, and — when a preview is visible — a full
   react-markdown + KaTeX re-parse). Phase 3.
4. ~~**Interactivity is unmeasured.**~~ Implemented (Phase 0, above).
5. ~~**The library list renders a full document per note card.**~~ Resolved. `get-overview` ships
   `previewMarkdown` (bounded) instead of full `body`, and cards render a plain-text snippet
   (`note-card-snippet.ts`). Scrolling no longer re-parses whole documents. The remaining list cost is
   mounting the full result set — Phase 4, step 3 (windowing).

## Performance contract

Extend the packaged scenario runner (see Phase 0). Report medians and p95 from at least three clean
packaged runs. Use the deterministic fixtures from the prior plans.

### New primary budgets (interactivity)

| Scenario                                              |                                                 Budget |
| ----------------------------------------------------- | -----------------------------------------------------: |
| Note editor keystroke to committed paint              |                         p95 ≤ 100 ms, no task > 100 ms |
| Rapid key burst (10 keys, any surface) in main window |                        no long task > 100 ms during it |
| Scroll through 100 mixed cards                        |              ≥ 55 FPS p95, no task > 100 ms (existing) |
| Search keystroke to settled results at 5,000 items    | p95 ≤ 100 ms of render + IPC after the 150 ms debounce |
| Autosave commit while typing a note                   |                    no task > 100 ms, zero vault rescan |
| Open vault for the first time (5,000 items)           |                        toast shown; no frozen UI frame |

The search row is measured as the latency _after_ the 150 ms debounce commits (typing latency itself
stays ≤ 100 ms p95). A "keystroke → settled results" budget below the debounce is not physically
meaningful; Phase 4 addresses the render cost that sits on top of it.

### Guardrails

- No authoritative file, autosave, recovery, reference, or security behavior may weaken.
- Autosave correctness and conflict handling are unchanged; only the work performed per save shrinks.
- A change that does not improve its target metric is reverted.
- Cached launch must not wait for reconciliation (existing).
- No new dependency (state library, worker, profiler, search/indexing package, virtualization
  library) until the native/simple path misses a measured budget.

## Phase 0 — Extend the measurement loop with typing ✅

Implemented. `performance-reporter.ts` now instruments keystroke-to-paint, dropped frames, and long
tasks in the renderer, drives a scripted search + note-editor burst via `webContents.sendInputEvent`,
and `scripts/measure-packaged-performance.cjs --typing` asserts the interactivity budgets.

- `performance-log.ts` — shared NDJSON writer + IPC round-trip timing hook.
- `performance-reporter.ts` — typing instrumentation and scenario driver (focus → settle → warm-up
  key → measured burst; first-card dedupe).
- `library-store.ts` / `library-service.ts` — env-gated full-scan counter.
- `scripts/measure-packaged-performance.cjs` — `--typing` mode aggregates medians/p95 and exits
  nonzero when a checked budget regresses or a scenario does not reach an interactive workspace.

Remaining work: none; see Validation notes above for the machine-sensitivity caveat.

## Phase 1 — Remove the full-library rebuild from note autosave ✅

Implemented. `updateNote` returns the updated note DTO from the in-memory record snapshot and writes
the cached index once via `updateLibraryDto`; it never scans the vault or rebuilds every DTO.
Reference metadata stays in sync through the bounded DTO build (no full vault walk).

Checks:

- an autosave performs no visible-file walk and no full DTO rebuild (measured: `autosaveScans` = 0);
- autosave conflict, recovery, and reference behavior are unchanged (existing test suite);
- cached restart reflects the saved note (cached index written once per save).

## Phase 2 — Stop the double `setLibrary` per save ✅

Implemented. App-owned note writes are ignored by the vault watcher for a short window
(`markAppOwnedWrite` / `isAppOwnedWrite`, watcher stays active for real external edits), so the
autosave `onSaved` result is the single renderer update per save.

Checks:

- typing a note produces at most one renderer library update per autosave;
- external edits still reconcile and refresh immediately;
- search, selection, and focus behavior are unchanged while editing.

## Phase 3 — Decouple per-keystroke work from typing in the note editor ✅

Warranted by measurement (see Validation notes): in Markdown source mode each keystroke blocked the
renderer ~1 s on the validation machine, and the work is app-side. Adopt the Joplin model — the
CodeMirror editor is the typing surface; everything else leaves the per-keystroke path.

Implemented:

- **Preview and rich-support decision run on a deferred draft.** `useTrailingValue` (200 ms) in
  `NoteCanvas` (`item-detail-dialog.tsx`) feeds `MarkdownPreview`, `partitionRichMarkdownSource`, and
  `supportsRichMarkdown`; react-markdown + KaTeX and the O(doc) rich scan run at most ~every 200 ms
  while typing, never per keystroke. The source editor stays the only thing that sees every
  keystroke.
- **No hidden panes.** `NoteDocumentBlocks` and the preview render only in the modes that show them;
  in Markdown source mode the hidden preview `ScrollArea`s are empty shells (the Joplin #9891 trap is
  closed).
- **Stable deferred callbacks.** `onOpenLink`/`onOpenVaultLink`/`onChange` are `useCallback`d via refs
  so `MarkdownPreview`'s `memo` holds and the deferred value skips re-parsing between keystrokes.
- **The dialog no longer rebuilds the workspace per keystroke.** `onDraftChange` only feeds the
  coordinator; the workspace `item` updates at save cadence via the coordinator's `onSaved` instead of
  replacing the library state (and re-filtering/sorting every item) on every key.
- **No full-doc stringify in the CodeMirror value-sync path.** A `publishedRef` records changes the
  editor published itself so the sync effect skips the `toString()` comparison
  (`markdown-editor.tsx`).

Validation (packaged `--typing`, A/B against `HEAD~2` on the dev machine):

- Note-editor keystroke p95 collapsed from ~7,130 ms (first key) / ~933 ms (draining) to **~15–30 ms**,
  flat across the burst.
- Search keystroke p95 ~120 ms → ~61 ms.
- `autosaveScans` = 0 and `vaultScans` = 0 during the note-typing burst.

Checks (remaining work: none; re-validate on a fast desktop per the Performance contract):

- typing in Markdown source / live / split performs no O(doc) scan and no react-markdown parse per
  keystroke (verified via `--typing` before/after);
- preview correctness, task toggling, and split-scroll sync are unchanged;
- switching modes still shows a correct preview within ~250 ms of settling.

Not in scope: building Obsidian-style in-editor live preview. The existing Milkdown (ProseMirror)
live mode already renders incrementally per block; the fix above makes Markdown source and split match
its typing behavior.

## Phase 4 — Bound library list rendering (cards and search)

The library list has two compounding renderer costs, both O(result-set) today:

- **Every note card parses and mounts its full document.** (Resolved.) `get-overview` now ships each
  note's `previewMarkdown` (first 2,400 chars, `library-service.ts` `toOverviewState`) rather than the
  full `body`, and each near-viewport card renders a bounded text snippet instead of the entire
  react-markdown + KaTeX pipeline (`note-card-snippet.ts` + `note-item-card.tsx`). A card is O(snippet).
- **The results list mounts every filtered item** (no windowing), so settling a query on a 2,000–5,000
  item result set reconciles thousands of card DOM trees at once. (Resolved.) The library view already
  paged; the focus rail now bounds its mount count with the same pattern (`focus-item-list.tsx`):
  an initial page of 50 with an IntersectionObserver sentinel that grows the page as the view
  approaches the end, plus a reveal rule that mounts through the active item so keyboard/focus
  navigation still shows its row. Only the mounted page is reconciled at settle.

Adopt the Obsidian/Joplin card model: a card preview shows a small excerpt, never a full-document
render, and full content loads only when the item is opened.

Implementation:

1. **Snippet cards.** ✅ Done. Card previews truncate the note body to ~800 chars after the frontmatter
   (`note-card-snippet.ts`) and render as a plain-text excerpt (`note-item-card.tsx`). No card parse
   ever touches more than the snippet.
2. **Defer full content to open time.** ✅ Already satisfied. `get-overview` ships `previewMarkdown`
   (no full `body`); the full body is fetched via `get-item-detail` only when a note is opened. Search
   runs in the main process over content, so the renderer never holds every note's full text resident.
   Remaining: confirm offline-from-cache behavior on open after the overview no longer ships full
   bodies (existing `bodyTruncated` → `getItemDetail` path covers it).
3. **Bound the item list so render cost is not O(results).** ✅ Done. The library view already paged
   (workspace.tsx `ITEM_PAGE_SIZE` + sentinel); the focus rail now applies the same paging
   (`focus-item-list.tsx`, `FOCUS_PAGE_SIZE = 50`): a sentinel grows the mounted page as the scroll
   end approaches, `pageKey` resets the page when the query changes, and the mounted window extends
   through the active item so keyboard and focus navigation keep the active row in view. This keeps
   the first paint and each settle bounded to a page instead of the full result set, with no new
   dependency (adding one would modify the release-prep package.json). A scroll-window virtualizer
   that unmounts scrolled-past rows remains a possible refinement if paging proves insufficient.
4. **Keep previous results visible while a query settles** (already done via progressive refinement).
5. **Push destination/type/reference filters into the main-process query** only if windowing leaves
   the post-debounce render over budget.
6. Do not add a search/indexing package until normalized in-memory search misses the target; it does
   not today.

Checks:

- no library list render ever parses a full note document (card parse is bounded by the snippet);
- `get-overview` no longer transfers full note bodies; opening a note fetches its content and works
  offline from the cache;
- search typing p95 (post-debounce render + IPC) ≤ 100 ms at 5,000 items, with no long task > 100 ms;
- result count, ordering, selection, and drag behavior unchanged with windowing;
- first paint of a cold search result set is bounded (no thousands of cards mounted at once).

Likely files:

- `src/renderer/src/features/items/focus-item-list.tsx`
- `src/renderer/src/features/items/note-item-card.tsx`
- `src/renderer/src/features/items/markdown-preview.tsx`
- `src/renderer/src/features/library/use-library-retrieval.ts`
- `src/main/library/library-service.ts` (overview DTO shape) and `src/main/ipc/library-handlers.ts`

## Delivery order

Land one independently measured change at a time, each with before/after medians and p95:

1. typing scenario + interactivity budgets in the packaged runner; ✅
2. note autosave fast path (no full rebuild); ✅
3. single renderer library update per save; ✅
4. decouple note-editor per-keystroke work from typing (Phase 3); ✅
5. bound library list rendering — snippet cards, deferred bodies, and bounded list mounting done
   (Phase 4).

Run after each phase:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm perf:budget
pnpm perf:benchmark
pnpm perf:packaged
```

## Completion criteria

- all existing budgets still pass;
- typing in the note editor and search box keeps p95 keystroke-to-paint ≤ 100 ms with no task
  > 100 ms at 5,000 items, and no O(doc) scan or preview re-parse runs per keystroke ✅ (re-validate on
  > a fast desktop);
- no library card render ever parses a full note document ✅, and the overview no longer ships every
  note body (full content loads at open time) ✅;
- search results settle within 100 ms (post-debounce) and never mount the full result set at once ✅
  (bounded paging in the library view and focus rail; re-validate on a fast desktop);
- note autosave never triggers a full vault scan or a second renderer library swap ✅;
- first-open indexing shows the toast and never freezes a frame ✅;
- every retained optimization has a measured user-facing benefit.
