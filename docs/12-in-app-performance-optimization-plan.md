# In-App Performance Optimization Plan

Status: Implemented; packaged benchmark command added

## Objective

Make Kusu remain responsive during ordinary use with large vaults. Optimize measured interaction
latency and frame stability first; treat bundle size and code shape only as supporting signals.

This plan starts after the image, preview-cache, idle-window, and editor-loading work in
`11-performance-improvement-plan.md`.

## Current evidence

Measured on the current tree on Windows, using `pnpm perf:benchmark -- --sizes=100,1000,5000
--binary-mb=0`:

| Items | Cold rebuild | Cached initialize | Cached state | Search loop |    RSS |
| ----: | -----------: | ----------------: | -----------: | ----------: | -----: |
|   100 |       301 ms |             18 ms |         0 ms |        0 ms | 150 MB |
| 1,000 |     3,060 ms |             42 ms |         0 ms |        2 ms | 183 MB |
| 5,000 |    15,829 ms |             78 ms |         0 ms |       11 ms | 300 MB |

These numbers identify cold rebuild cost, but they are not an in-app release baseline:

- the benchmark runs `LibraryService` in Node, not packaged Electron;
- its “search” measurement filters an already-built array instead of calling `queryItems` through
  IPC;
- RSS includes the benchmark process and TypeScript transpilation;
- it does not measure rendering, input latency, scrolling, detail opening, or mutations;
- its external-edit result includes the intentional watcher debounce.

Current production build signals:

- main static renderer graph: 1,666,958 bytes of JavaScript;
- Quick Capture graph: 929,525 bytes;
- Markdown preview chunk: 622,061 bytes;
- rich Markdown editor chunk: 1,316,120 bytes;
- the existing bundle and font budgets pass.

The largest unverified risks in the current flow are:

1. many item mutations return and install a complete `LibraryDto`;
2. full rebuilds read note bodies during reference scanning and again during DTO construction;
3. card pages can mount 100 Markdown renderers, each using the full Markdown/GFM/math pipeline;
4. masonry relayout reads and writes every rendered card when observed card heights change;
5. no packaged scenario runner currently records process memory or interaction timings, despite the
   requirement in the previous plan.

These are candidates, not conclusions. Each implementation phase below has a measurement gate.

## Performance contract

Use a packaged build and report medians from at least three clean runs. Record p95 as well when a
scenario contains repeated interactions.

### Primary budgets

| Scenario                                           |                                    Budget |
| -------------------------------------------------- | ----------------------------------------: |
| Cached launch to first usable card                 |              p50 ≤ 750 ms, p95 ≤ 1,200 ms |
| Search keystroke to settled results at 5,000 items |                              p95 ≤ 100 ms |
| Destination/filter/sort change to settled list     |                              p95 ≤ 100 ms |
| Open already-visible item detail                   |                              p95 ≤ 150 ms |
| Move, archive, restore, trash, or rename one item  |                              p95 ≤ 250 ms |
| Scroll through 100 mixed cards                     |            ≥ 55 FPS p95, no task > 100 ms |
| Hidden Quick Capture after 60 seconds              |         no Quick Capture renderer process |
| Media browsing preview cache                       | ≤ 32 MB decoded estimate and ≤ 64 entries |

### Guardrails

- No authoritative file, autosave, recovery, reference, or security behavior may weaken.
- Full-resolution image detail remains unchanged.
- Cached launch must not wait for reconciliation.
- Renderer work must stay bounded by visible or near-visible content.
- A change that does not improve its target metric is reverted.
- Do not add a state library, virtualization library, worker, profiler dependency, or image package
  until native code misses a measured budget.

## Fixtures and scenarios

Keep fixtures deterministic and outside the user's real vault:

1. **Text 5k:** 4,500 notes and 500 files, with short, medium, and long Markdown bodies.
2. **Markdown 1k:** headings, lists, tables, tasks, code, links, and 10% math-heavy notes.
3. **Media 500:** mixed JPEG/PNG/WebP images, including 50 images above 10 megapixels and notes with
   local attachments.
4. **Collections 5k:** 500 nested collections and 5,000 mixed items.
5. **Dogfood vault:** reality check only, never a release gate.

For each fixture, run:

1. cached launch and first card;
2. type a fixed five-character search, clear it, change type filter, sort, and destination;
3. scroll through 100 cards in visual and grid views;
4. open/close a note, image, URL, and file detail;
5. rename, move, archive, restore, trash, and undo one item;
6. edit and autosave a note;
7. make one external note edit and wait for reconciliation;
8. open/hide Quick Capture and sample again after 60 seconds.

## Phase 0 — Build the measurement loop

Do this before optimization.

- Add one packaged-only scenario mode controlled by an environment variable or command-line switch.
- Use Electron's existing `app.getAppMetrics()` and `process.getProcessMemoryInfo()` APIs for process
  memory; do not add a dependency.
- Reuse the existing `performance.mark()` calls and add marks only at scenario boundaries.
- Collect renderer long tasks with the native `PerformanceObserver` API.
- Record scripted scenario results as newline-delimited JSON under a temporary output directory.
- Run three iterations and summarize medians/p95 in the benchmark script.
- Correct the existing benchmark so search calls `LibraryService.queryItems`; add explicit timings for
  one rename and one move after the initial build.

Likely files:

- `scripts/benchmark-performance.cjs`
- one small packaged scenario script under `scripts/`
- `src/main/index.ts`
- `src/renderer/src/main.tsx`
- `package.json`

Exit criteria:

- one command produces comparable packaged results for all primary budgets;
- the command exits nonzero when a checked budget regresses;
- normal application startup contains no benchmark behavior;
- three unchanged runs vary by less than 10% for latency medians.

## Phase 1 — Remove full rebuilds from ordinary mutations

This is the likely highest-impact interaction change.

Today many service mutations call `buildLibraryDto()`. A full build scans the vault, reconstructs all
DTOs, writes the full cached index, serializes the full result through IPC, and replaces renderer
library state. At 5,000 items, the measured cold version of that path takes about 15.8 seconds.
Measure mutations first, then fix the shared post-mutation path rather than individual UI callers.

Preferred shape:

- update the in-memory scan snapshot and `librarySnapshot` from the successful store transaction;
- rebuild only changed item DTOs and affected reference metadata;
- write the cached index once after the mutation;
- return the current overview or a minimal changed-item/removal result instead of a full body-bearing
  `LibraryDto`;
- preserve full reconciliation as the fallback only for unknown external filesystem changes, not
  ordinary app-owned mutations.

Start with the most-used single-item operations: rename, move, archive/restore, and trash/undo. Extend
that same concrete path to bulk operations only after it works end to end.

Likely files:

- `src/main/library/library-service.ts`
- `src/main/library/storage/library-store.ts`
- `src/main/ipc/library-handlers.ts`
- `src/shared/library-contract.ts`
- `src/preload/index.ts`
- `src/renderer/src/features/library/workspace.tsx`

Checks:

- each app-owned mutation performs no visible-vault scan;
- one changed item does not recreate every unchanged renderer item object;
- references and locations remain correct after move/archive/trash/restore;
- cached restart reflects the mutation;
- external edits still trigger authoritative reconciliation.

Stop gate: do not introduce patch DTOs if returning the already-bounded overview meets the 250 ms
mutation budget. The smaller protocol wins.

## Phase 2 — Make full reconciliation single-pass where practical

Full scans still matter on first import, cache loss, and unknown external edits.

- carry note source read during reference extraction into DTO construction so a scan does not read the
  same note twice;
- reuse maps for collection path lookup and attachment record lookup instead of repeated array scans;
- avoid rewriting the cached index when its content revision did not change;
- preserve existing bounded filesystem concurrency; tune limits only from measured disk utilization;
- keep fingerprinting and path validation intact.

Likely files:

- `src/main/library/storage/library-store.ts`
- `scripts/benchmark-performance.cjs`
- focused storage tests

Targets:

- 5,000-item cold rebuild under 8 seconds on the reference machine;
- one known external note edit under 500 ms after the watcher debounce;
- no-op reconciliation performs zero record writes and zero note-body reads.

Do not add a database. The current cache and record files remain sufficient until single-pass scanning
still misses a demonstrated requirement.

## Phase 3 — Bound card rendering cost

Profile first-card and scroll traces on the Markdown fixture.

Apply the first measured fix that is sufficient:

1. reduce `ITEM_PAGE_SIZE` from 100 if fewer mounted cards meets scrolling and navigation needs;
2. begin Markdown card rendering only near the viewport, using the existing shared
   `useNearViewport` observer;
3. use a lightweight plain-text card excerpt while retaining full Markdown in detail, only if the
   product accepts that visual change;
4. run math processing only for Markdown containing math syntax if traces show KaTeX parsing matters.

Keep the existing lazy detail/editor boundaries. Do not split tiny components or add `useMemo` around
cheap expressions.

Likely files:

- `src/renderer/src/features/library/workspace.tsx`
- `src/renderer/src/features/items/note-item-card.tsx`
- `src/renderer/src/features/items/markdown-preview.tsx`
- `src/renderer/src/features/items/use-near-viewport.ts`

Checks:

- offscreen notes do not parse Markdown or request attachment previews;
- keyboard focus and incremental loading preserve stable order;
- cards near the viewport are ready before they become visible;
- detail Markdown output is unchanged.

## Phase 4 — Fix layout only if traces identify it

`OrderedMasonry` currently observes every rendered child and performs batched writes followed by a
height read for every visible child. Markdown and image height changes can schedule repeated full-page
layouts.

If layout is a top trace contributor:

- skip relayout when container width, column count, and observed card heights are unchanged;
- cache measured card heights by item ID for the mounted page;
- keep one `requestAnimationFrame` batch and separate measurement from style writes;
- compare against native CSS masonry only when it is supported by the project's Electron Chromium
  version and preserves visual ordering/accessibility.

Do not add a masonry dependency. Replace the component only if the native implementation is both
correct and measurably faster.

Likely files:

- `src/renderer/src/features/library/ordered-masonry.tsx`
- `src/renderer/src/features/library/workspace.tsx`

Checks:

- unchanged card resizes schedule no full relayout;
- DOM order, visual order, keyboard order, and selection behavior stay aligned;
- no cumulative layout shift after image or Markdown preview resolution.

## Phase 5 — Reduce renderer update fan-out

Run React Profiler on search, selection, vault refresh, and a one-item mutation.

Only if broad commits remain over budget:

- preserve unchanged item object identity when merging overview updates;
- replace repeated `library.items.find()` calls in hot render/interaction paths with one memoized
  ID-to-item map;
- pass stable item-level callbacks to memoized cards rather than creating new closures per card where
  profiler evidence shows card rerenders;
- keep transient drag/resize values in refs when they do not affect rendered output;
- split `Workspace` only at state boundaries that demonstrably reduce commit scope.

Do not split `Workspace` because of line count. Extraction without reduced subscriptions does not
improve runtime performance.

## Phase 6 — Search and indexing, only if still over budget

Current in-memory substring search is 11 ms in the Node loop at 5,000 items, so a new index is not
justified yet. Measure the real IPC path first.

If real search misses 100 ms p95:

- avoid returning thousands of IDs that will immediately be filtered out by destination/type;
- include destination/type/reference filters in the existing main-process query operation;
- precompute normalized searchable text when the library snapshot is built or an item changes;
- debounce requests only if IPC churn, rather than filtering, is the measured bottleneck.

Do not add a search package until normalized in-memory search fails the target at the supported vault
size.

## Phase 7 — Memory and loaded-code verification

After latency work, repeat the media protocol from the previous plan.

- verify card previews never load original image bytes;
- expose preview cache bytes/count only in benchmark mode;
- verify object URLs are revoked after leases end and cache eviction occurs;
- verify non-note detail does not load Markdown editor chunks;
- verify Read mode does not load CodeMirror or Milkdown;
- verify hidden Quick Capture destroys its renderer after 60 seconds;
- compare renderer, GPU, main, and total working set at every scenario checkpoint.

Keep the existing JavaScript/font budgets. Tighten a budget only after three release builds establish a
stable lower baseline; do not optimize chunks merely to make them visually smaller.

## Delivery order

Land one independently measured change at a time:

1. packaged scenario runner and corrected baseline;
2. mutation fast path;
3. single-pass full reconciliation;
4. bounded card Markdown work;
5. masonry changes, only if traced;
6. renderer update fan-out, only if profiled;
7. search indexing, only if still over budget;
8. final memory and loaded-code verification.

For every change, attach:

- before/after median and p95 for its target scenario;
- process memory at the same checkpoints;
- a trace or counter showing the intended work was removed;
- confirmation that unrelated primary budgets did not materially regress.

Run after each phase:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm perf:budget
pnpm perf:benchmark
```

## Implemented

- Ordinary item mutations now update only affected DTOs from the in-memory record snapshot instead of
  rescanning the vault or rebuilding every item.
- Record and collection snapshots stay synchronized with app-owned writes and deletes.
- Renames and moves suppress stale watcher events for paths the app itself just removed while keeping
  reconciliation active for current paths.
- Full scans reuse note bodies read during reference extraction when constructing DTOs.
- The benchmark now measures real `LibraryService.queryItems`, rename, and archive operations and
  enforces the 5,000-item search and mutation budgets.
- Note-card Markdown mounts only near the viewport, the renderer page size is 50, and masonry measures
  all card heights before applying positions.
- On the reference machine, the 5,000-item Node service benchmark now reports approximately 111 ms
  rename, 111 ms archive, and 12 ms search. Cached initialization remains approximately 51 ms.
- Cold 5,000-item indexing now reuses text bytes and writes new rebuildable records directly, reducing
  the reference run from approximately 13 seconds to 6 seconds.
- `pnpm perf:packaged` builds an unpacked release, creates an isolated 5,000-note fixture, runs it three
  times, records first-card/long-task/process-memory JSONL, and enforces the cached first-card budget.
- Type checking, lint, 170 passing tests, production build, and JavaScript/font budgets pass.

## Completion criteria

- all primary budgets pass on packaged fixtures;
- ordinary app-owned mutations never scan the whole vault;
- full reconciliation reads each unchanged note body at most once when a full scan is necessary;
- offscreen cards perform no Markdown parsing or preview IPC;
- scrolling has no repeated long masonry tasks;
- process memory remains within the existing preview and hidden-window bounds;
- every retained optimization has a measured user-facing benefit.

## Large-vault interaction follow-up

The overview and both Focus rail densities now window their content instead of retaining loaded
pages. Ordered masonry columns are preserved. Measured heights are cached, viewport updates happen
only when the rendered range changes, and a persistent ResizeObserver measures new or resized rows.
Focused rows and neighbours, dragged rows, and the last explicitly revealed row remain mounted.
Home/End navigation mounts and focuses the target directly. Memoized rows keep unchanged previews
and menus out of ordinary scroll renders; Index no longer adds CSS content-visibility estimates on
top of the scrolling window.

Search has no fixed debounce. Deferred queries keep typing urgent, and the previous collection or
search results remain visible until the next response arrives. Cancelled responses cannot replace
newer results. Searchable text is cached per immutable item in a WeakMap; edits, renames, metadata
updates, and removals naturally invalidate it.

Background URL enrichment runs four requests at a time and publishes completed metadata in batches.
Requests and publication pause briefly after input. Closing or switching a vault disposes its queue.
Enrichment preserves titles changed while a request was running and updates the service's search
snapshot. Ready metadata does not require another network request.

Cold indexing keeps the existing path-containment and symlink checks but performs bulk checks
asynchronously. Reference lookups are built only when references need them, and new rebuildable
record writes use bounded concurrency. Note saves and moves announce their paths before filesystem
notifications arrive. Capture readiness checks read only vault identity; captures and file imports
update changed DTOs instead of rescanning the whole vault. External files remain watched and
reconciled. Transaction journals, note conflict checks, and authoritative file writes are unchanged.
Before startup reconciliation completes, opening an item reads its individual record instead of
loading the entire record directory. Background link writes wait for reconciliation so they cannot
race its snapshot. Media moves rewrite inbound references once for the whole selection, using fresh
note bytes even when an external edit preserves file size and timestamps.

### Reproducing the measurements

Build and run the packaged interaction fixture:

```sh
pnpm perf:interactions
pnpm perf:interactions --mixed
```

For a faster implementation loop without packaging, use the optimized build in `out/`:

```sh
pnpm build
node scripts/measure-packaged-performance.cjs --preview --browsing --items=6000 --runs=3
```

Add `--screenshots` to save light and dark screenshots alongside the JSONL and verify scrolling with
reduced motion enabled. These checks change only the isolated fixture profile.

The JSON summary records whether the run was packaged. The mixed fixture contains Markdown, PNG
images in landscape and portrait proportions, local URL shortcuts, PDFs, and collection folders.
Sample URLs point at loopback addresses blocked by the network guard, exercising enrichment failure
states without contacting external sites.

The browsing scenario verifies selection, continuous scrolling, destination and layout changes,
search, both Focus densities with Home/End, cold and warm note opening, available media details and
preview readiness, and bulk archive through the UI. Restore, move, and note edit timings are reported
separately as IPC operations and their saved results are checked. It rejects excess mounted rows and
unexpected full scans during ordinary interactions. UI actions use synthetic events and frame
boundaries; they do not include operating-system input delivery. Real keyboard input and autosave
have a separate scenario:

```sh
node scripts/measure-packaged-performance.cjs --typing --items=6000 --runs=3
```

The earlier overview-only baseline was 10–19 mounted wrappers, selection p95 of 71.7 ms, cached first
cards at 507 and 529.5 ms, and a 9,803 ms cold first card on the reference Windows machine. Its raw
results are in `.performance/browsing-6000-final.ndjson`. Do not compare Node service rebuild timings
directly with packaged launch timings.

### Verification on 6 November 2026

The final Windows unpacked build passed `pnpm check` (438 tests), `pnpm audit --prod`, and
`pnpm package:verify`. Three mixed 6,000-item runs completed navigation, both Focus densities,
search, images, links, PDFs, note edits, and bulk archive/restore/move checks. Light and dark
screenshots were inspected; reduced motion and Home/End navigation were checked. All three browsing
runs and all three typing runs reported zero interaction/autosave vault scans.

| Measurement                              | Final packaged result |
| ---------------------------------------- | --------------------- |
| Mounted overview / Focus maximum         | 21 / 18               |
| First card, cold                         | 5,333 ms              |
| First card, subsequent launches          | 535 ms and 5,407 ms   |
| Selection p95                            | 126 ms                |
| Search results p95, mixed fixture        | 139 ms                |
| Warm note opening p95                    | 144 ms                |
| Continuous scroll frame interval p95     | 58.1 ms               |
| Longest task during continuous scrolling | 88 ms                 |
| Search / note key-to-frame p95           | 30.4 / 18.1 ms        |
| Search IPC / note autosave IPC p95       | 34.6 / 191.7 ms       |

Raw results are `.performance/verified-packaged-mixed.ndjson` and
`.performance/verified-packaged-typing.ndjson`. The mixed runner exited nonzero because selection
exceeded 100 ms; its cached launch outlier also exceeds the launch budget. The typing runner exited
nonzero because autosave IPC exceeded 100 ms, despite responsive keystrokes and no autosave scans.
These are **not passing release performance results**. Scrolling, startup variability, initial detail
loading, search result settling, and disk-backed mutations remain above some primary targets.
Further work needs renderer layout/paint and startup traces, plus storage phase measurements;
reference correctness, conflict detection, and transaction durability must remain intact.
