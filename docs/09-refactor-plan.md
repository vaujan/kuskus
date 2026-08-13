# Refactor and Maintainability Plan

Status: Proposed
Baseline: `24d0e2f` (`main`)

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

At the start of this plan:

- Typecheck passes.
- Production build passes.
- 150 tests pass and 4 legacy-v1 tests are skipped.
- ESLint reports 350 warnings, mostly line-ending noise plus four hook dependency warnings.
- The performance budget fails.
- The measured unique static JavaScript graph is approximately 1.66 MB for the main surface and
  0.93 MB for Quick Capture.
- Emitted fonts total approximately 304 KB.
- `workspace.tsx`, `library-service.ts`, and `library-store.ts` are the primary concentration points.

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
- The pnpm hardening suggestions are valid for the installed pnpm 11 toolchain, but must be introduced
  with an install check because a seven-day release delay changes dependency-update behavior.
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

## Phase 0 — Make the gates trustworthy

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

Classify each source assertion as one of:

- **Behavior:** replace with a pure-function, service, controller, or rendered-output assertion.
- **Static contract:** keep only where the source itself is the product contract, such as forbidden
  CSS color literals or preload exposure.
- **Visual detail:** move out of correctness tests; verify through the existing UI audit/demo flow.

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

Split `tests/library-service.test.cjs` along existing behavior boundaries without changing fixtures:

- vault initialization and migration
- capture and staging
- notes and attachments
- collections and lifecycle
- URL enrichment and network safety
- reconciliation, cache, and performance behavior

Extract the repeated TypeScript require hook into one test helper. Keep shared binary fixtures in one
fixture module. Update the test script so every `*.test.cjs` file is discovered automatically rather
than maintained in a manual list.

Acceptance:

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

Do this only after the renderer phases are stable. Preserve `LibraryService` as the application
facade and `LibraryStore` as a temporary concrete facade while methods move; this is not a backwards
compatibility layer, because it remains the single internal persistence boundary.

### 4.1 Extract shared vault path safety

Move canonical path containment, hidden-directory paths, normalized relative paths, and safe filename
logic into one main-process module. All storage modules must use it; no module may implement its own
containment check.

Suggested file:

- `src/main/library/storage/vault-paths.ts`

Security tests must cover sibling-prefix paths, traversal, case behavior on Windows, hidden Trash,
and symlink/non-following guarantees.

### 4.2 Extract capture persistence

Move draft file/image staging, capture queue manifests, submission assets, restore, and discard into:

- `src/main/library/storage/capture-store.ts`

Keep submission orchestration in `capture-submission-service.ts`; this module owns filesystem state
only.

### 4.3 Extract collection persistence

Move collection records and validated directory operations into:

- `src/main/library/storage/collection-store.ts`

Collection moves must retain current ancestry validation, descendant record updates, and rollback.

### 4.4 Extract lifecycle transactions

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
