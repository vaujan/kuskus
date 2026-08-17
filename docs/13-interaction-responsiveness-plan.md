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
That machine is far slower than a typical desktop — cold first-card took 16–25 s — so the absolute
keystroke-to-paint numbers are inflated and are not a fair budget gate. What the runs do confirm,
architecture-wise:

- `updateNote` IPC dropped from the 16–21 s full rebuild to **~120–140 ms** per save.
- `getOverview` right after a save returns in ~1 ms (no rescan).
- **`autosaveScans` = 0** during the note-typing burst: the autosave performs no full vault scan.
- `queryItems` returns in ~6 ms after the debounce.

Phases 3 and 4 remain gated on measurements taken on a normal desktop: the keystroke-to-paint budgets
cannot be satisfied (or fairly judged) on this validation machine.

## Current evidence

Observation on the current tree (Windows, 5,000-item vault):

- Quick Capture (a small isolated window) is responsive under rapid keys; the main workspace is not.
  This isolates the problem to main-workspace renderer/main-process churn, not global input handling.
- The search box lagged far more than the note editor. Root cause was per-keystroke IPC + list
  blanking; addressed above.

Confirmed hot paths that remain:

1. ~~**Note autosave rebuilds the whole library every ~800 ms of typing.**~~ Implemented (above).
2. ~~**Each save causes two renderer `setLibrary` calls.**~~ Implemented (above).
3. **Live Markdown preview re-parses per keystroke** (mermaid/katex). Candidate, not yet measured.
4. ~~**Interactivity is unmeasured.**~~ Implemented (Phase 0, above).

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
