# Refactor and Maintainability Plan

Status: In progress
Baseline: `24d0e2f` (`main`)

> **Current status (2026-08-22, HEAD `b7bfb7c`, 141 commits past baseline).** This plan has
> drifted from the trees it describes. The baseline numbers and phase lists below are historical;
> read them as the starting point, not the current state. What has actually landed:
>
> - **Phase 0** mostly complete: unused deps removed (`@electron-toolkit/preload`, five Fontsource
>   packages), the lint gate is `--max-warnings=0`, and the verified React Doctor correctness
>   findings (render-time ref writes, impure mode updater, busy-state `finally`, safe vault-link
>   decode) are addressed in the current sources.
> - **Phase 1** partial: the `focus-view.test.cjs` workspace *capture wiring* pins were relaxed to
>   behavior assertions over the pure `detectCaptureKind`/`shouldYieldMainComposer` (1.1 started), so
>   Phase 3.4's move of capture coordination out of `workspace.tsx` is now test-safe. Other regex pins
>   (`quick-capture`, `note-frontmatter`, `item-detail-context`, sticky `rich-markdown-active-line`)
>   are not yet fully reclassified. **1.3 complete**: the TS require hook is the shared
>   `tests/helpers/install-ts-require.cjs`, and `library-service.test.cjs` was fully dissolved into
>   eleven domain test files (suite count unchanged at 200 tests: 196 pass, 4 skipped).
> - **Phase 2 / 3.1 / 3.2**: `use-library-retrieval.ts` and `use-library-selection.ts` exist, so
>   retrieval and selection ownership landed. **Phase 3.3 started**: the reference-aware image-move
>   counting was extracted to the pure `reference-image-move.ts` with behavior tests; the stateful
>   `use-item-mutations` hook and Phase 3.4 capture coordination have not.
> - **Phase 4.1 + 4.2 done**: `vault-paths.ts` exists and the capture persistence moved into the new
>   `capture-store.ts` module (`LibraryStore` ~3135 → ~2920 lines; suite unchanged). 4.3 (collections)
>   and 4.4 (lifecycle) assessed and deferred — they're entangled with the scan-snapshot/record
>   machinery that 4.5 deliberately keeps together.
> - **Phase 5**: perf budgets and fonts have moved (the changelog and DEC-046/047 record bounded
>   scanning, code-split boundaries, woff2 KaTeX), but budgets are not re-measured here.
> - **Phase 6**: `docs/10-current-architecture.md` exists.
>
> **Two additions since this plan was written:**
>
> - **DEC-052** (2026-08-10) reintroduced the Milkdown/ProseMirror rich editor for Read and Live,
>   keeping CodeMirror for exact Markdown and Split source. This changes the editor surface the
>   plan's Phase 1/2 "note mode" language assumed and is not captured in the phases below.
> - **DEC-053 and the `NoteEditor` seam** (2026-08-22) introduced a mode-agnostic seam over both
>   editors (`features/items/note-editor.ts` plus source/rich adapters). That work was driven
>   through the `/improve-codebase-architecture` flow and is a completed deepening not listed in
>   any phase below.
>
> This entire document should be re-baselined (current test count, commit, and a phase-by-phase
> done/next) before the next refactor slice starts.

## Goal

Improve maintainability, correctness, and startup cost without changing Kuskus's product behavior,
storage contract, or Electron security boundaries. Refactor in small, independently verified slices;
do not rewrite the application or introduce a new state-management, persistence, validation, or test
framework unless an existing approach is demonstrably insufficient.

## Outcomes

- The main workspace composes focused feature modules instead of owning every workflow.
- Renderer search has one authoritative interpretation of full note content.
- Vault persistence is separated by existing domain responsibility while retaining one concrete
  service facade.
- Tests verify behavior rather than source formatting or component placement where practical.
- Typecheck, lint, tests, build, and performance budgets are trustworthy release gates.
- One concise document explains the current architecture; the decision log remains historical.

## Invariants

Every phase must preserve these constraints:

1. Visible vault files remain authoritative.
2. Renderer requests remain ID-based; arbitrary renderer paths never reach filesystem operations.
3. Main-process validation remains mandatory at every IPC trust boundary.
4. Capture, move, autosave, migration, Trash, and recovery operations retain their current durability.
5. No compatibility wrappers, speculative interfaces, generic repositories, event buses, or global
   state libraries are added.
6. Existing public behavior changes only when a phase explicitly names and tests the correction.
7. Each phase lands with a passing runnable check before the next phase starts.

## Baseline

At the start of this plan (`24d0e2f`):

- Typecheck passes.
- Production build passes.
- 150 tests pass and 4 legacy-v1 tests are skipped.
- ESLint reports 350 warnings, mostly line-ending noise plus four hook dependency warnings.
- The performance budget fails.
- The measured unique static JavaScript graph is approximately 1.66 MB for the main surface and
  0.93 MB for Quick Capture.
- Emitted fonts total approximately 304 KB.
- `workspace.tsx`, `library-service.ts`, and `library-store.ts` are the primary concentration points.

**Re-baseline (2026-08-22, HEAD `b7bfb7c`):**

- Typecheck passes.
- `pnpm lint` runs with `--max-warnings=0` (gate enforced; pre-existing prettier warnings remain in
  files such as `components/ui/tooltip.tsx`).
- 195 tests total: 191 pass, 4 skipped.
- `workspace.tsx` is 2361 lines, `library-service.ts` 1779, `library-store.ts` 3135, and
  `item-detail-dialog.tsx` 2628 — the primary concentration points are unchanged, plus the dialog and
  the `NoteEditor` seam work recently thinned its editor-bridging.
- The perf budget script exists (`scripts/check-performance-budget.cjs`); budgets are not re-measured
  here and the current pass/fail state is unverified.
- Fonts: `@fontsource-variable/inter` and `@fontsource-variable/ibm-plex-sans` remain (Inter body,
  IBM Plex Sans headings); KaTeX is woff2-only per DEC-047.

### React Doctor verification

`npx react-doctor@latest . --verbose` scanned 157 files and reported 44/100 with 127
diagnostics (10 errors and 117 warnings). The score overstates the immediate risk because the report
mixes correctness findings, architectural preferences, micro-optimizations, and false positives.

Verified actionable findings:

- Eight render-time writes to callback/option refs in the two CodeMirror wrappers violate React's
  render-purity rule. Move those writes to a layout effect while keeping editor initialization stable.
- `toggleReadLiveMode` mutates `previousSingleModeRef` inside a state updater. Compute the next mode
  outside the updater so React replay cannot repeat the mutation.
- Five async UI actions reset busy state only on successful resolution. Use `try/finally` and preserve
  their current result-error handling so rejected IPC does not leave controls disabled.
- `decodeURIComponent` in the Markdown link handler can throw on malformed vault-link Markdown. Add
  one safe decode helper and a focused malformed-input test.
- `@electron-toolkit/preload` is unused. `@fontsource-variable/inter` is not unused; it is referenced
  by `assets/main.css` and must remain.
- The pnpm hardening suggestions are valid for the installed pnpm 11 toolchain, but a frozen-install
  trial rejected six recently published lockfile entries and three trust downgrades. Leave the
  policies disabled until those entries are reviewed or refreshed; do not break current installs to
  satisfy the score.
- The giant-component warnings are directionally correct and already covered by Phases 2–4.

Verified non-findings or items that need measurement before change:

- The Quick Capture subscription and observers already return cleanup functions.
- Both object-URL paths revoke their URLs during cleanup, including late async results.
- The hidden programmatic file input is not an unlabeled user-facing control; the Markdown checkbox
  already has an accessible name.
- CodeMirror is already behind the composer/detail lazy boundaries. Dynamic-import warnings on its
  internal modules do not identify an additional useful split.
- Most awaited filesystem loops preserve traversal, uniqueness, transaction, or bounded-I/O
  semantics. Do not replace them with unbounded `Promise.all`; optimize only a measured independent
  path with explicit concurrency.
- Chained iterations, property caching, static JSX, reducer, effect-event, and parent-callback
  diagnostics are advisory. Apply them only when their owning phase simplifies the code or a profile
  demonstrates a problem.

The React Doctor score is therefore an investigation input, not a release gate. Existing typecheck,
lint, tests, build, and measured performance budgets remain authoritative.

## Phase 0 — Make the gates trustworthy [done]

_All sub-phases landed. The lint gate is `--max-warnings=0`, unused packages are removed, and the
verified React Doctor correctness findings are addressed in current sources. Item 0.5.6 (pnpm
`minimumReleaseAge`/`trustPolicy`) was intentionally deferred and remains open.

### 0.1 Remove dependency residue

Already started:

- Remove the five unused Fontsource packages.
- Keep only the imported Inter package.
- Move the shadcn CLI from runtime dependencies to `devDependencies`.

Files:

- `package.json`
- `pnpm-lock.yaml`

Acceptance:

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

### 0.2 Normalize line endings once

Add a repository-level Git rule matching `.editorconfig`, then normalize tracked text in a dedicated
mechanical commit. Do not mix behavior changes into this commit.

Files:

- `.gitattributes` with LF for source and configuration text
- Existing tracked text files normalized by Git/Prettier

Acceptance:

- A second formatting run produces no diff.
- ESLint no longer reports CRLF-only Prettier warnings.
- Runtime bundles are behaviorally unchanged.

### 0.3 Resolve real lint warnings

Fix the four hook dependency warnings in `add-item-composer.tsx` by stabilizing or narrowing the
values actually consumed. Do not silence `exhaustive-deps` and do not add broad object dependencies
that retrigger effects unnecessarily.

Files:

- `src/renderer/src/features/capture/add-item-composer.tsx`
- `scripts/generate-katex-woff2-css.cjs`
- `tests/quick-capture.test.cjs`

Then change the lint command to reject new warnings:

```json
"lint": "eslint --cache --max-warnings=0 ."
```

Acceptance:

- `pnpm lint` passes with zero warnings.
- Capture-session, image staging, attachment rename, draft normalization, and import-request tests
  continue to pass.

### 0.4 Correct the performance budget calculation

`check-performance-budget.cjs` currently adds the renderer entry bytes after traversing a graph that
already contains the same entry. Measure the union of entry and surface graphs exactly once.

Do not increase budgets to make the command pass. After correcting measurement, report static entry,
static surface, first note-preview load, detail-editor load, and font bytes separately so a lazy
chunk is not mistaken for free code.

Files:

- `scripts/check-performance-budget.cjs`
- One focused Node test for graph deduplication, or an exported pure graph-size helper tested with
  temporary files

Acceptance:

- The same file cannot contribute twice to a reported surface.
- Quick Capture and main-window measurements are independent.
- The command still fails when a real budget is exceeded.

### 0.5 Resolve verified React Doctor correctness findings

Make one small correctness pass before structural refactoring:

1. Move live callback and options ref synchronization in `composer-markdown-editor.tsx` and
   `markdown-editor.tsx` into `useLayoutEffect`; keep initial document/config refs unchanged.
2. Make the note mode state updater pure in `item-detail-dialog.tsx`.
3. Put busy-state resets in `finally` blocks in `setup-screen.tsx` and `library-sidebar.tsx`.
4. Safely decode malformed `kuskus-note:` targets in `markdown-preview.tsx`.
5. Remove `@electron-toolkit/preload`; retain the CSS-imported Inter package.
6. Add pnpm `minimumReleaseAge` and `trustPolicy` only after confirming a frozen install accepts the
   settings and documenting the intentional seven-day update delay.

Do not change observer cleanup, object-URL cleanup, hidden-input labeling, CodeMirror chunking, state
ownership, filesystem concurrency, or component boundaries merely to raise the score.

Acceptance:

- One focused test covers malformed encoded vault links or the extracted safe decoder.
- Existing editor, note-mode, setup, sidebar, and Quick Capture tests pass.
- Typecheck and lint pass.
- A React Doctor rerun no longer reports the eight render-time ref writes, impure state updater, or
  unsafe Markdown decode; accepted heuristic diagnostics may remain.

## Phase 1 — Establish refactor-safe tests

This phase precedes component splitting because current source-regex tests pin implementation shape.

### 1.1 Classify existing tests

Status: partial — started 2026-08-22.

Classify each source assertion as one of:

- **Behavior:** replace with a pure-function, service, controller, or rendered-output assertion.
- **Static contract:** keep only where the source itself is the product contract, such as forbidden
  CSS color literals or preload exposure.
- **Visual detail:** move out of correctness tests; verify through the existing UI audit/demo flow.

Done:

- `focus-view.test.cjs`: the "Detail capture stays in the rail" test's `workspaceSource` *capture
  wiring* pins — `openComposer`, `window.capture.onMainItemRequested`, `handleNewItemShortcut`,
  the `composer={composerOpen || showExternalDropShadow …}` slot, `openDetail(nextItem.id, true)` —
  were replaced with behavior assertions over the already-extracted pure `detectCaptureKind` and
  `shouldYieldMainComposer`. These were the pins that would break once Phase 3.4 moves capture
  coordination out of `workspace.tsx`. Non-capture workspace pins (`presentation="card"`,
  `const focusDetail = focusItem ?…`) were kept because they do not move under Phase 3.4, as were the
  static-contract pins on `focus-item-list.tsx`, `add-item-composer.tsx`, and
  `composer-rich-markdown-editor.tsx`.

Remaining (not yet acted on):

- `quick-capture.test.cjs` pins on `add-item-composer.tsx`, `quick-capture-app.tsx`,
  `src/main/index.ts`, and `capture-contract.ts` are classified as **static contract**: none of those
  files move under Phase 3.4 (which explicitly leaves composer internals in place), so they neither
  block the decompose nor need relaxation.
- `focus-view.test.cjs` "medium windows use an overlay sidebar" pins `focus-workspace.tsx` and
  `use-mobile.ts` — neither moves under Phase 3.4; classified as static contract / visual detail.
- `note-frontmatter.test.cjs` still regex-pins the detail dialog; its `<RichMarkdownEditor>` pin was
  updated to `<NoteRichEditor>` for the `NoteEditor` seam but the file is not fully reclassified.

Priority files:

- `tests/focus-view.test.cjs`
- `tests/item-detail-context.test.cjs`
- `tests/note-window.test.cjs`
- `tests/note-frontmatter.test.cjs`
- `tests/quick-capture.test.cjs`

### 1.2 Extract behavior before moving components

Move state decisions currently embedded in JSX into existing or new pure feature modules, then test
those decisions with `node:test`. Examples:

- focus-detail expansion and close decisions
- capture placement decisions
- detail mode availability
- selection and action scope
- responsive sidebar mode decisions

Prefer pure functions and existing `node:test`; do not add a browser test framework merely to check
class names.

### 1.3 Split the test monolith by domain

Status: complete — 2026-08-22.

The repeated TypeScript require hook is now one shared helper, `tests/helpers/install-ts-require.cjs`,
used by all 18 `tests/*.test.cjs` files that previously copy-pasted it. End behavior is unchanged.

`tests/library-service.test.cjs` (originally ~2800 lines / 72 tests) has been fully dissolved into
domain files, all preserving the suite count (200 tests: 196 pass, 4 skipped):

- `folder-tree.test.cjs` — folder-tree pure tests.
- `url-metadata.test.cjs` — URL enrichment / item metadata / Internet-Shortcut pure tests.
- `capture-markdown.test.cjs` — capture-kind / staged-image Markdown reference / attachment placement
  pure tests.
- `rich-markdown-interop.test.cjs` — Markdown formatting, note-mode, rich Markdown interchange,
  frontmatter partitioning, code-change publication, scroll-mapping pure tests.
- `service-capture.test.cjs` — `LibraryService`-backed capture/attachment-staging integration tests.
- `service-collections.test.cjs` — folder/collection and item-lifecycle integration tests.
- `service-note-lifecycle.test.cjs` — note create/persist/reopen, missing-content, attachment
  reference, note update validation, autosave coordinator integration tests.
- `service-obsidian.test.cjs` — Obsidian vault init, legacy embeds, schema-v1 migration, identity
  rename, frontmatter removal, bookmark conversion integration tests.
- `service-url.test.cjs` — URL creation, enrichment, preview cache, image validation integration.
- `service-reconciliation.test.cjs` — cached snapshot, dirty reconcile, corrupt snapshot, bounded
  payload, demo seeding integration tests.
- `service-storage.test.cjs` — storage transaction/recovery integration tests plus the legacy-v1
  recovery `test.skip` cases.

Acceptance for 1.3 is met: no test was lost, pass/skip counts are intentionally accounted for, and
moving a React component between files no longer breaks a correctness test by pinning the monolith.

- No test is lost; pass and skip counts are intentionally accounted for.
- Moving a React component between files does not break a correctness test.
- Storage transaction and recovery coverage remains unchanged.

## Phase 2 — Make retrieval and search coherent

### Problem

Text matching is duplicated in:

- `src/renderer/src/features/library/workspace.tsx`
- `src/main/library/library-service.ts`

The renderer has truncated note previews while the main process has complete note bodies. Selection
pruning and new-item visibility can therefore disagree with authoritative search results.

### 2.1 Define responsibility

Main process owns text search over title, complete note body, URL/domain/description, and filenames.
Renderer owns:

- current destination/folder subtree
- type filters
- referenced-attachment visibility
- sorting
- pagination/render limits

### 2.2 Use query result IDs consistently

Create a focused renderer retrieval module that owns:

- deferred query
- request generation/race protection
- pending status
- authoritative matching IDs
- destination/type/visibility filtering
- sorting and render-page state

Do not clear or prune selection from a local truncated-body guess. Apply selection pruning after the
matching result for the current query is accepted. Ignore responses from an older request or library
revision.

Suggested file:

- `src/renderer/src/features/library/use-library-retrieval.ts`

Existing pure modules to reuse:

- `item-sort.ts`
- `item-view.ts`
- `folder-tree.ts`
- `library-overview.ts`

### 2.3 Remove duplicate searchable-text construction

Keep full-text construction in the main process only. If query behavior needs a helper, use one pure
function beside `LibraryService`; do not share main-process full-content logic with the renderer.

Acceptance:

- A query matching only text beyond the 2,400-character overview preview still behaves consistently.
- Search races cannot restore an older result set.
- Selection contains only items in the accepted current retrieval.
- Destination, type filters, sorting, progressive rendering, and newly saved-item reveal still work.

## Phase 3 — Decompose the renderer workspace

Refactor one cohesive workflow at a time. `Workspace` remains the composition root and owns only state
that coordinates two or more extracted workflows.

### 3.1 Retrieval

Move Phase 2 retrieval state and effects out first. This removes search, filtering, sorting, paging,
and result-race code from `Workspace` with direct behavior coverage.

### 3.2 Selection and keyboard ownership

Extract:

- selected IDs and anchor
- range/toggle/select-all decisions
- visible-item pruning
- keyboard target resolution
- selection announcements

Suggested file:

- `src/renderer/src/features/library/use-item-selection.ts`

Reuse `item-shortcuts.ts`; do not duplicate target resolution.

### 3.3 Item mutations

Status: partial — started 2026-08-22.

First slice landed: the reference-aware image-move counting that was duplicated inline in
`moveItemIds`, `archiveItemIds`, and `unarchiveItemIds` was extracted into the pure module
`src/renderer/src/features/library/reference-image-move.ts` (`countReferencedImageChanges`) with 5
behavior tests in `tests/reference-image-move.test.cjs`. Each workspace mutation now calls that one
module instead of re-implementing the same before/after path comparison three times.

Remaining: move the concrete operations (`moveItemIds`, `archiveItemIds`, `unarchiveItemIds`,
`trashItemIds`, `restoreItemIds`, `renameItemTitle`, permanent-delete, and the rename/delete/trash
dialog state) into `use-item-mutations.ts`. These are statefully entangled with `applyLibraryResult`,
focus transitions, notification callbacks, and `itemOperationBusy`, so each should move only once it
can carry its behavior tests rather than as a single large move.

Group the existing concrete operations without creating a generic command system:

- move/archive/unarchive
- Trash/restore/permanent delete
- rename
- reference-aware confirmation state
- result application and notifications

Suggested file:

- `src/renderer/src/features/library/use-item-mutations.ts`

The hook may call `window.kuskus` directly because it is renderer application code. Keep dialogs as
normal components receiving explicit state and callbacks.

### 3.4 Capture coordination

Extract only workspace-level capture coordination:

- global capture requests
- composer ownership
- external drop handoff
- import requests
- recovery dialog state

Do not move composer-internal editing or staging logic out of `add-item-composer.tsx` in this step.

Suggested file:

- `src/renderer/src/features/library/use-workspace-capture.ts`

### 3.5 Presentation composition

After behavior is extracted, split large render-only sections into feature components where this
reduces prop complexity:

- workspace dialogs
- normal library canvas
- focus surface

Do not create pass-through components that merely rename a `<div>`.

Acceptance:

- `Workspace` reads as orchestration: initialize workflows, connect them, render surfaces.
- Each extracted module has one behavior-focused test.
- No new global provider or reducer is introduced.
- Existing lazy boundaries for composer and item detail remain intact.

## Phase 4 — Separate vault persistence by responsibility

Status: in progress — started 2026-08-22.

Preserve `LibraryService` as the application facade and `LibraryStore` as a temporary concrete facade
while methods move; this is not a backwards compatibility layer, because it remains the single
internal persistence boundary.

### 4.1 Extract shared vault path safety

Done: `src/main/library/storage/vault-paths.ts` exists and the security tests pass.

### 4.2 Extract capture persistence

Done — 2026-08-22: the 18 capture-persistence methods (draft file/image staging, capture queue
manifests, submission assets, restore, discard) moved out of `LibraryStore` into
`src/main/library/storage/capture-store.ts` as standalone functions, with `LibraryStore` delegating.
`LibraryStore` went from ~3135 to ~2920 lines; `capture-store.ts` is ~380 lines. Typecheck, lint, and
the full suite (200 tests: 196 pass, 4 skipped) pass unchanged, including the queued-destination
path semantics (`temp/capture-queue`). Submission orchestration stays in `capture-submission-service.ts`;
this module owns filesystem state only.

### 4.3 Extract collection persistence

Assessed — deferred (2026-08-22). Unlike capture persistence, the collection methods
(`createCollection`, `updateCollection`, `moveCollection`, `deleteCollection`) are woven into the
record-reconciliation machinery: `moveCollection` rewrites descendant item/collection records, and
`deleteCollection` mutates the in-memory scan snapshot. Extracting them would require passing the
record readers/writers and snapshot as collaborators, restructuring the scanner rather than moving a
self-contained block. Per 4.5 ("do not split scanner internals solely to reduce line count"), this is
deferred rather than forced.

Move collection records and validated directory operations into:

- `src/main/library/storage/collection-store.ts`

Collection moves must retain current ancestry validation, descendant record updates, and rollback.

### 4.4 Extract lifecycle transactions

Assessed — deferred (2026-08-22). Same entanglement as 4.3: the item-lifecycle methods
(`finalizeInboxItem`, `updateItem`, `updateNote`, `moveItems`, `permanentlyDeleteItems`,
`inspectItemDeletion`) depend on `resolveItem`, the scan snapshot, record readers/writers, and the
`buildDto` pipeline. Extracting them as standalone functions would duplicate or thread that shared
state. Deferred until the scanner/reconciler boundary is stable, per 4.5.

Move item resolution, move/archive/Trash/restore/permanent-delete transactions and inbound reference
rewrites into:

- `src/main/library/storage/item-lifecycle-store.ts`

Keep deletion-policy decisions in `LibraryService`; keep low-level filesystem transaction behavior in
the store module.

### 4.5 Leave scanning and reconciliation together

Scanning, records, DTO reconstruction, attachment resolution, fingerprints, snapshots, and incremental
reconciliation are tightly coupled and should remain together initially:

- `src/main/library/storage/library-store.ts`, later renamed only if the resulting responsibility is
  clearly scanner/index oriented

Do not split scanner internals solely to reduce line count.

Acceptance for every extraction:

- Move only one responsibility per commit.
- Existing integration tests pass unchanged before adding new edge cases.
- No circular imports between storage modules.
- Rollback and recovery behavior remains testable through `LibraryService`.

## Phase 5 — Reduce real startup and first-use cost

Performance work starts after correcting measurement. Optimize measured graphs, not source line count.

### 5.1 Static main surface

Inspect why these current graph areas are statically reachable:

- renderer entry/vendor chunk
- Base UI tooltip/shared primitive chunk
- URL preview/card code
- saved item card variants

Prefer direct package subpath imports, existing lazy boundaries, and moving optional feature imports
behind the interaction that opens them. Do not replace Base UI or add another component library.

### 5.2 Note preview first use

A note card currently loads the full Markdown preview path, including GFM, math, KaTeX, and code
presentation. Preserve rich detail rendering, but measure whether card presentation needs every
plugin on first view.

Potential split, only if measurements justify it:

- lightweight card Markdown renderer
- full detail Markdown renderer with math and code support

Do not reduce Markdown fidelity in detail mode.

### 5.3 Fonts

Keep Inter and required KaTeX fonts. Determine which KaTeX font files are emitted and actually needed
by supported syntax before removing any. If full KaTeX support requires the current set, correct the
font budget rather than silently breaking equations; budget changes require documented measured
justification.

### 5.4 Budgets

Budgets should separately cover:

- initial renderer entry
- main static surface
- Quick Capture static surface
- first note-card preview
- detail/editor on demand
- fonts

Acceptance:

- Corrected budgets pass without exclusions or arbitrary increases.
- Quick Capture stays independent from detail/editor code.
- No user-visible startup or capture regression.
- Production build and performance benchmark pass.

## Phase 6 — Simplify current architecture documentation

Add a concise current-state architecture document. Do not rewrite the append-only decision history.

Suggested file:

- `docs/10-current-architecture.md`

It should contain only:

1. process and trust boundaries
2. main-process module responsibilities
3. renderer feature ownership
4. IPC request/response flow
5. vault scan and reconciliation flow
6. capture submission lifecycle
7. where new code belongs
8. required checks before merge

Update stale “current foundation” wording in the technical decision log only by adding a pointer to
this document; retain superseded decisions for history.

Acceptance:

- A contributor can locate the owner of a new feature without reading the full decision log.
- Documentation matches actual imports and process boundaries.

## Commit sequence

Use small commits in this order:

1. `chore(deps): remove unused runtime packages`
2. `chore(format): normalize repository line endings`
3. `chore(lint): enforce a warning-free lint gate`
4. `fix(perf): measure unique renderer dependency graphs`
5. `test: replace retrieval source assertions with behavior checks`
6. `refactor(library): centralize authoritative retrieval state`
7. `refactor(library): extract item selection`
8. `refactor(library): extract item mutations`
9. `refactor(capture): extract workspace capture coordination`
10. `test: split library integration tests by domain`
11. `refactor(storage): centralize vault path safety`
12. `refactor(storage): extract capture persistence`
13. `refactor(storage): extract collection persistence`
14. `refactor(storage): extract lifecycle transactions`
15. `perf(renderer): reduce measured startup and first-use graphs`
16. `docs: describe the current architecture`

The Phase 0.5 fixes should be one or two commits before item 5; do not bundle them into renderer or
storage decomposition.

A commit may be omitted when investigation shows no beneficial change. Do not combine phases merely
to match this list.

## Required checks

Run after every behavioral commit:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Run after renderer dependency, lazy-loading, font, or Markdown changes:

```bash
pnpm perf:budget
pnpm perf:benchmark
```

For storage changes, also run the relevant temporary-vault tests in isolation before the full suite.

## Completion criteria

The plan is complete when:

- all required checks pass with zero ignored warnings;
- search uses full authoritative content consistently;
- workspace workflows have focused ownership and behavior tests;
- storage modules follow existing domain boundaries without added framework machinery;
- source-regex tests are limited to genuine static contracts;
- startup, Quick Capture, note preview, detail, and fonts have accurate passing budgets;
- current architecture is documented concisely;
- no storage migration or user-data rewrite was required by the refactor.

## Explicit non-goals

- Replacing Electron, React, Base UI, CodeMirror, Tailwind, or `node:test`.
- Introducing Redux, Zustand, an ORM, a repository framework, a validation framework, or a service
  container.
- Redesigning the interface.
- Changing the schema-v2 vault contract.
- Re-enabling legacy-v1 compatibility paths.
- Splitting into packages, processes, or independently deployable services.
