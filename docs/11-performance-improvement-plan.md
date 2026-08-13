# Performance Improvement Plan

Status: Implemented; packaged before/after benchmark pending

## Goal

Reduce Kuskus's steady-state memory and first-use work without changing the Electron foundation,
vault format, renderer sandbox, or visible image quality in item detail.

The current development run uses approximately **581 MB working set** across Electron's main,
renderer, GPU, and network processes. The active vault has seven visible images: **15.6 MB** on disk
and approximately **50.2 MB** when decoded as RGBA. One 2,680 × 3,400 image accounts for about
**34.8 MB** decoded before Chromium/GPU duplication.

This is a development measurement, not a release baseline. All acceptance decisions below use a
packaged build and repeatable fixtures.

## Targets

- Reduce settled packaged-build memory by at least **20%** on the media fixture.
- Keep decoded card-preview memory at or below **32 MB** per renderer.
- Do not load original image bytes for a library card.
- Release a hidden Quick Capture renderer after an idle period.
- Keep card scrolling and search responsive with 5,000 items.
- Preserve full-resolution detail previews and exact authoritative files.

Expected result for the currently observed process mix: **80–140 MB** saved during ordinary visual
browsing, and an additional **100–200 MB** after an opened Quick Capture window becomes idle. These
ranges overlap and must not be added to claim a guaranteed total.

## Measurement protocol

Before changing behavior, add one release-only measurement command using Electron's existing
`app.getAppMetrics()` API. Do not add a profiling dependency.

Measure three runs for each checkpoint and report the median by process type and total working set:

1. main window settled for 30 seconds;
2. first card visible;
3. after scrolling through 100 media cards;
4. after opening and closing one image detail;
5. after opening and hiding Quick Capture;
6. 60 seconds after Quick Capture is hidden.

Use these fixtures:

- the existing 5,000-item text-heavy fixture;
- a media fixture with 100 mixed-size images, including ten images above 10 megapixels;
- the current dogfood vault for a reality check, never as the release gate.

Record startup time, first-card time, renderer/GPU/main memory, preview-cache decoded bytes, and
preview-cache entry count. A change passes only when its median improves without a material
regression at another checkpoint.

## Phase 1 — Serve bounded card thumbnails

This is the highest-impact change.

- Generate a rebuildable thumbnail in the main process with Electron's existing `nativeImage` API;
  do not add an image package initially.
- Bound the longest edge to 512 physical pixels and preserve aspect ratio.
- Store it under the existing `.kuskus/thumbnails/<item-id>/` cache area with enough source
  fingerprint information to invalidate it after an external edit.
- Return thumbnail bytes through an item-ID-only IPC operation. The renderer must not receive a path.
- Keep `getImagePreview` for full-resolution detail only.
- Coalesce concurrent generation for the same item and generate on demand rather than rebuilding the
  entire vault at startup.
- Treat thumbnail failure as a recoverable card-preview failure; never modify the source image.

Likely files:

- `src/main/library/library-service.ts`
- `src/main/library/storage/library-store.ts`
- `src/main/ipc/library-handlers.ts`
- `src/preload/index.ts`
- `src/shared/library-contract.ts`
- `src/renderer/src/features/items/image-item-card.tsx`

Checks:

- a card request never returns dimensions above 512 × 512;
- external image replacement invalidates the cached thumbnail;
- concurrent requests generate one thumbnail;
- full detail still uses the original image;
- malformed and missing images retain the current safe error state.

Estimated saving on the current vault: **45–90 MB** across renderer and GPU memory. The seven current
images require about 50.2 MB decoded at full size versus at most 7 MB as 512-pixel RGBA thumbnails.

## Phase 2 — Bound and defer renderer previews

`<img loading="lazy">` does not prevent the current hooks from fetching bytes immediately. Fix the
request point rather than adding list virtualization first.

- Use one `IntersectionObserver` to acquire a preview only when its card is near the viewport.
- Keep the existing shared request queue and object-URL lease model.
- Change preview-cache eviction from 128 entries to a **32 MB decoded-byte budget** using preview
  dimensions, while retaining an entry-count safety ceiling.
- Evict unreferenced least-recently-used entries and revoke every evicted object URL.
- Clear renderer preview/detail caches when switching vaults.
- Bound `Workspace`'s loaded note-detail map to the active item plus a small recent set.

Likely files:

- `src/renderer/src/features/items/preview-cache.ts`
- `src/renderer/src/features/items/use-image-preview.ts`
- `src/renderer/src/features/items/use-url-preview.ts`
- `src/renderer/src/features/items/use-note-attachment-previews.ts`
- `src/renderer/src/features/library/workspace.tsx`

Checks:

- offscreen cards make no preview IPC request;
- scrolling releases old object URLs after the byte budget is exceeded;
- two consumers of one preview still share one request and URL;
- an active lease is never evicted;
- vault switching retains no previous-vault preview.

Estimated additional saving: **15–40 MB** on a long media browse, with larger savings for larger
vaults.

## Phase 3 — Release hidden window renderers

Quick Capture is created lazily but remains alive after it hides. Its draft and queue are already
owned by main-process services, so the renderer does not need indefinite residency.

- Destroy Quick Capture after 60 seconds hidden.
- Cancel the idle destruction when capture is reopened.
- Preserve the current immediate hide behavior and recover draft state through the existing capture
  session on recreation.
- Keep note windows user-owned; closing one should destroy it immediately as it does now.

Likely file:

- `src/main/window/quick-capture-window.ts`

Checks:

- hidden Quick Capture is destroyed after the idle deadline;
- reopening before the deadline reuses the window;
- reopening after destruction restores the draft and focus behavior;
- shutdown and display listeners do not retain a destroyed window.

Estimated saving after Quick Capture has been used: **100–200 MB**. The tradeoff is one renderer
startup after a long idle period.

## Phase 4 — Load editors only when requested

React Doctor reports heavy editor modules, but the useful boundary is narrower than blindly applying
all dynamic-import warnings.

- Keep item detail lazy from the main workspace.
- Split image/file/URL detail from note detail so opening a non-note does not load Markdown tooling.
- Load the rich editor only when Live mode is entered.
- Load CodeMirror only when Markdown or Split mode is entered.
- Load KaTeX/math rendering only for content that needs it if the production graph measurement shows
  a meaningful first-note win.
- Preserve editor state once a user has entered an editing mode; do not repeatedly unload active
  editors to chase memory.

Likely files:

- `src/renderer/src/features/items/item-detail-dialog.tsx`
- `src/renderer/src/features/items/markdown-preview.tsx`
- `src/renderer/src/features/items/rich-markdown-editor.tsx`
- `src/renderer/src/features/items/markdown-editor.tsx`

Checks:

- opening an image detail loads no editor chunk;
- opening a note in Read mode loads no editor chunk;
- entering each edit mode preserves current autosave, conflict, selection, and attachment behavior;
- Quick Capture remains independent from item-detail chunks.

Estimated saving before editing: **10–30 MB**, plus lower parse/compile work. This phase is primarily a
first-use and responsiveness improvement.

## Phase 5 — Optimize only measured CPU paths

After Phases 1–4, profile the 5,000-item fixture before changing list and scan code.

Candidates:

- reuse ID-to-item maps in repeated workspace menu/selection lookups;
- batch masonry style writes or replace them only if layout profiling identifies them as a frame
  bottleneck;
- avoid reading complete binary files during reconciliation when a bounded header read can validate
  the supported format and dimensions;
- parallelize only filesystem reads proven independent and keep existing concurrency limits.

Do not add a virtual-list library, state-management library, worker, or image dependency unless the
post-Phase-4 profile demonstrates that the native/simple path misses a target.

React Doctor's chained-array, reducer, giant-component, and repeated-property warnings are not
performance acceptance criteria. Fix its five render-time ref mutations as correctness work, but do
not claim a memory saving for that change. Its object-URL warning in `add-item-composer.tsx` is a
false positive because effect cleanup and late-result cleanup already revoke those URLs.

## Delivery order

Land each phase independently:

1. `perf: measure packaged process memory`
2. `perf(images): serve bounded card thumbnails`
3. `perf(renderer): defer and byte-bound previews`
4. `perf(capture): release the idle capture window`
5. `perf(renderer): defer note editor modules`
6. `perf: optimize measured reconciliation or layout hotspots` only if still needed

Run after every phase:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm perf:budget
pnpm perf:benchmark
```

Also run the packaged memory protocol and attach before/after medians to the commit or pull request.

## Implemented

- Card images now use on-demand, cached 512-pixel thumbnails generated with Electron `nativeImage`.
- Card preview requests begin only within 600 pixels of the viewport.
- The shared renderer cache is limited to 32 MB decoded memory and 64 entries.
- Loaded exact note details are limited to the 20 most recent entries.
- Hidden Quick Capture windows are destroyed after 60 seconds idle.
- Note preview, source editor, and rich editor modules load behind their actual modes; Read and Split
  use the sanitized Markdown preview while Live loads the rich editor.
- Render-time rich-editor ref writes identified by React Doctor now synchronize in a layout effect.
- A production-preview smoke run loaded four generated thumbnails and settled at approximately
  438 MB across the Electron main, GPU, network, and renderer processes. This is not a before/after
  result because the earlier 581 MB observation was a development run.

## Completion criteria

- Packaged media-fixture memory improves by at least 20%.
- Card previews are bounded thumbnails and the cache stays within its decoded-byte budget.
- Full-resolution images are loaded only by detail surfaces.
- Hidden Quick Capture memory is released after idle.
- Existing startup, search, storage, capture recovery, autosave, and security checks pass.
- Any phase whose measured benefit is negligible is reverted rather than retained for appearance.
