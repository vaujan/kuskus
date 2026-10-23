# Desktop beta release plan

Updated 2026-10-23 (Asia/Jayapura). Ship the browser demo and source preview first, then invite
5–10 Windows testers after the desktop gates below pass. This is a release plan, not approval
to publish installers.

## Integrated hardening

- Note-content replacement is isolated in `src/main/library/storage/note-file.ts`. It flushes
  a unique staged file, then replaces the destination in one rename. The original is never moved
  out of the way before replacement.
- Process-interruption tests exit during staging, after staging, and after replacement, then reopen
  and reconcile a real vault. Additional tests cover partial writes, replacement failures, and
  successful cleanup. These establish process-interruption behavior, not power-loss safety.
- The application-menu regression check follows the current focus workspace toolbar ownership.
- Landing-page primary actions open the browser demo. The desktop page explains installer gates
  and temporary demo edits.

## Local verification

On 2026-10-23, `pnpm check` passed: 356 tests, no failures or skips, lint, desktop and landing-page
type checks and production builds, and the renderer bundle budget. `pnpm audit --prod` reported
no known vulnerabilities. Builds still emit the existing search-highlight CSS and website chunk-size
warnings. No fresh installer, native Windows test, remote CI, or published-site verification was
performed in this pass.

## Remaining gates, in order

1. **Multi-file transaction recovery.** `LibraryStore.rewriteVisibleNoteReferences` still moves
   original notes to backups before replacement, and `moveItems` stages files in hidden storage.
   Their exception rollback does not run if the process terminates. Implement persisted transaction
   recovery and interruption tests before calling those operations crash-safe. Verify folder moves,
   reference rewrites, and attachment moves together; do not infer safety from note-save tests.
2. **Fix the release candidate.** Review and commit the intended sources; run `pnpm check`,
   `pnpm audit --prod`, and package inspection. Require green Linux, Windows, and full-history
   secret-scan CI for that exact commit. Local checks do not confirm remote CI or publication state.
3. **Native Windows verification.** Arrange signing and an x64 Windows machine. Follow
   `14-open-source-release-checklist.md`: install, edit and immediately close, reopen, concurrent
   edits, attachment/folder moves, Trash/restore, offline use, quick capture, upgrade, uninstall,
   retained vaults, keyboard access, and representative library performance. Record build, OS,
   architecture, and results. ARM64 requires separate native verification.
4. **Distribution.** Build using the signed release flow; inspect publisher/signatures, generate
   SHA-256 checksums, publish the exact corresponding source and known limitations, verify private
   vulnerability reporting, and download/test the published artifact. Change website actions only
   when those artifacts exist. Updates remain manual.
5. **Small beta.** Invite 5–10 testers with backup instructions and a bug-reporting route. Check
   whether they can install, create/open a library, capture references, and recover their work after
   restarting. Prioritize data loss and blocked workflows before expanding distribution.

## Architecture work after the safety gates

Extract complete responsibilities with behavioral tests when touching them: scanning/reconciliation
and item transactions from storage, then editor state and workflow coordination from the large
renderer components. Keep the current Electron process boundaries and typed APIs. A broad rewrite
is not a release prerequisite.
