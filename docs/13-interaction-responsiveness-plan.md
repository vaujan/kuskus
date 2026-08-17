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

## Current evidence

Observation on the current tree (Windows, 5,000-item vault):

- Quick Capture (a small isolated window) is responsive under rapid keys; the main workspace is not.
  This isolates the problem to main-workspace renderer/main-process churn, not global input handling.
- The search box lagged far more than the note editor. Root cause was per-keystroke IPC + list
  blanking; addressed above.

Confirmed hot paths that remain:

1. **Note autosave rebuilds the whole library every ~800 ms of typing.**
   `updateNote` (`library-service.ts:515`) returns via `toCurrentNoteDto`
   (`library-service.ts:549`), which calls `buildLibraryDto` → `scanVault`
   (`library-store.ts:1177`) → `performScanVault` (`library-store.ts:984`): a full visible-file walk,
   per-file stat, and DTO rebuild, plus a cached-index write. So one save does O(vault) work.
2. **Each save causes two renderer `setLibrary` calls.**
   The file write fires the vault watcher → `refreshVault` → `setLibrary(refreshedLibrary)`
   (`workspace.tsx:384-403`), and the autosave `onSaved` → `updateItem` → `setLibrary` with a
   full `.map` (`workspace.tsx:678-692`). Both replace the `library` object, forcing
   `visibleItems` (filter + full sort) to recompute in `use-library-retrieval.ts:127-134` and the list
   to re-render.
3. **Live Markdown preview re-parses per keystroke** (mermaid/katex). Candidate, not yet measured.
4. **Interactivity is unmeasured.** No keystroke latency, dropped-frame, or total-blocking-time
   budget exists in the packaged scenario runner.

## Performance contract

Extend the packaged scenario runner (see Phase 0). Report medians and p95 from at least three clean
packaged runs. Use the deterministic fixtures from the prior plans.

### New primary budgets (interactivity)

| Scenario                                                |                                    Budget |
| ------------------------------------------------------- | ---------------------------------------: |
| Note editor keystroke to committed paint                |          p95 ≤ 100 ms, no task > 100 ms |
| Rapid key burst (10 keys, any surface) in main window   |           no long task > 100 ms during it |
| Scroll through 100 mixed cards                          | ≥ 55 FPS p95, no task > 100 ms (existing) |
| Search keystroke to settled results at 5,000 items      | p95 ≤ 100 ms (existing, now via typing)  |
| Autosave commit while typing a note                     |      no task > 100 ms, zero vault rescan |
| Open vault for the first time (5,000 items)             |          toast shown; no frozen UI frame |

### Guardrails

- No authoritative file, autosave, recovery, reference, or security behavior may weaken.
- Autosave correctness and conflict handling are unchanged; only the work performed per save shrinks.
- A change that does not improve its target metric is reverted.
- Cached launch must not wait for reconciliation (existing).
- No new dependency (state library, worker, profiler, search/indexing package, virtualization
  library) until the native/simple path misses a measured budget.

## Phase 0 — Extend the measurement loop with typing

`performance-reporter.ts` already records first-card, passive long tasks, and process memory. Add a
scripted typing scenario to the packaged run:

- Drive the renderer with `webContents.sendInputEvent` (or CDP `Input.dispatchKeyEvent`):
  1. type a fixed 5-character search then clear it;
  2. type a 10-key burst into the note editor;
  3. idle 60 seconds.
- Capture per scenario:
  - keystroke-to-paint latency (keydown event time to next `requestAnimationFrame` paint);
  - long-task count and maximum, and total blocking time;
  - dropped-frame count (missed 60 FPS deadlines) during the burst;
  - `queryItems` IPC round-trip durations and call count (confirms the debounce effect).
- Summarize medians/p95 across three runs in the benchmark script.

Exit criteria:

- one command produces comparable typing/interactivity numbers for the new budgets;
- the command exits nonzero when a checked budget regresses;
- normal application startup contains no benchmark behavior.

Likely files:

- `src/main/performance-reporter.ts`
- `scripts/measure-packaged-performance.cjs`
- `src/main/index.ts`

## Phase 1 — Remove the full-library rebuild from note autosave

Highest-impact remaining change. `updateNote` must not scan the vault or rebuild every DTO.

- Return the updated note DTO from the in-memory record snapshot (the write already updated it via
  `store.updateNote`) instead of calling `buildLibraryDto` in `toCurrentNoteDto`.
- Keep reference metadata (`referencedAttachment`) in sync for note content changes that alter
  `[[wiki]]`/attachment targets; a note-only content edit that changes references may still require a
  bounded reference update, but never a full vault walk.
- Write the cached index at most once after the mutation (or defer it to the existing reconciliation).

Likely files:

- `src/main/library/library-service.ts`
- `src/main/library/storage/library-store.ts`

Checks:

- an autosave performs no visible-file walk and no full DTO rebuild;
- autosave conflict, recovery, and reference behavior are unchanged;
- cached restart reflects the saved note.

## Phase 2 — Stop the double `setLibrary` per save

Renderer side of the same hot path.

- Decide one owner for note-save updates: the autosave `onSaved` result (`updateItem`,
  `workspace.tsx:678`) is the authoritative, minimal path. The watcher-driven `refreshVault`
  (`workspace.tsx:392`) should not also replace the library for app-owned writes.
- Options, in order of preference, measured at each step:
  1. suppress the vault-change broadcast for app-owned note saves in the main process (watcher stays
     active for real external edits);
  2. or dedupe on the renderer: ignore a vault-change refresh when the incoming overview matches the
     item identity the autosave already installed.
- Preserve object identity for unchanged items so `visibleItems` (filter + sort) and card components
  can skip work when only one item changed.

Likely files:

- `src/main/library/library-service.ts`
- `src/main/ipc/library-handlers.ts`
- `src/renderer/src/features/library/workspace.tsx`
- `src/renderer/src/features/library/use-library-retrieval.ts`

Checks:

- typing a note produces at most one renderer library update per autosave;
- external edits still reconcile and refresh immediately;
- search, selection, and focus behavior are unchanged while editing.

## Phase 3 — Measure, then bound, live preview re-parse

Only if Phase 1 + 2 leave the typing budget over.

- Profile a 10-second typing trace in split/live mode; attribute long tasks to markdown/mermaid/katex
  re-parse vs render commit.
- Prefer the first sufficient fix: defer heavy rendering to idle, skip re-render when the visible
  preview is scrolled out, or throttle re-render at the existing 800 ms autosave cadence rather than
  per keystroke.

Likely files:

- `src/renderer/src/features/items/markdown-preview.tsx`
- `src/renderer/src/features/items/item-detail-dialog.tsx`

## Phase 4 — Verify search under the new harness

The debounce + progressive-refinement fix is expected to satisfy the 100 ms p95 search budget through
real IPC typing. If it does not:

- avoid returning IDs that will be filtered by destination/type/reference (push those filters into the
  main-process query);
- precompute normalized searchable text per item when the snapshot is built or an item changes;
- raise the debounce only if IPC call count, not filtering, is the measured bottleneck.

Do not add a search package until normalized in-memory search misses the target.

## Delivery order

Land one independently measured change at a time, each with before/after medians and p95:

1. typing scenario + interactivity budgets in the packaged runner;
2. note autosave fast path (no full rebuild);
3. single renderer library update per save;
4. live preview bounding, only if still over budget;
5. search hardening, only if still over budget.

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
- typing a note or search box keeps p95 keystroke-to-paint ≤ 100 ms with no task > 100 ms at 5,000
  items;
- note autosave never triggers a full vault scan or a second renderer library swap;
- first-open indexing shows the toast and never freezes a frame;
- every retained optimization has a measured user-facing benefit.
