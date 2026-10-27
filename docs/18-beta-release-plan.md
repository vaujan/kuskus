# Desktop beta release plan

Updated 2026-10-26 (Asia/Jayapura). Public source and an experimental desktop prerelease already exist. A supported desktop beta remains a separate milestone.

## Integrated recovery

`note-file.ts` replaces individual note content atomically. `vault-transaction.ts` records undo actions before item/folder moves, renames, reference rewrites, and metadata changes. Uncommitted journals roll back before the vault is opened or scanned; committed journals preserve the result. Recovery is repeatable, validates vault paths, and stops on conflicting files. Transactions are serialized per vault within one process.

Interruption tests terminate child processes during journal persistence, file moves, and metadata/reference replacement, then reopen and reconcile real vaults. These checks establish process-interruption behavior for the covered operations. They do not establish power-loss durability or coordination with external editors. Keep the complete vault, including `.kuskus`, when backing up or repairing it.

## Remaining gates, in order

1. **Review the candidate.** Review the recovery implementation and its tests, commit the intended sources, and run `pnpm check:release` and `pnpm audit:all`. Require green Linux, Windows, and full-history secret-scan CI for that exact commit. See [the current launch review](22-public-launch-review.md) for repository settings and the separate artwork-history gate.
2. **Native verification.** Arrange signing and clean test machines. Follow [the native checklist](14-open-source-release-checklist.md): install, edit and immediately close, reopen, concurrent edits, attachment/folder moves, Trash/restore, offline use, quick capture, upgrade, uninstall, retained vaults, keyboard access, and representative library performance. Test interruption recovery on native filesystems. Record build, OS, architecture, and results for every distributed target.
3. **Distribution.** Prepare a new version and accurate notes; existing preview installers predate the new fixes. Build using the signed release flow, inspect publisher/signatures, generate SHA-256 checksums, retain exact corresponding source, and download/test the published artifact. Updates remain manual. Keep unsigned or unverified builds clearly experimental.
4. **Small beta.** Invite 5–10 testers with backup instructions and a bug-reporting route. Check whether they can install, create/open a library, capture references, and recover work after restarting. Prioritize data loss and blocked workflows before expanding distribution.

## Architecture work after verification

Keep storage transactions, scanning/reconciliation, and editor workflow responsibilities separate. Extend behavioral tests when changing persistence. Preserve the Electron process boundaries and typed APIs; a broad rewrite is not a release prerequisite.
