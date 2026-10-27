# Public launch readiness

Updated 2026-10-26 (Asia/Jayapura). Source publication and stable desktop distribution are separate milestones. The repository is already public and has an experimental desktop prerelease. Keep stable distribution gated on native verification, signing, and the remaining artwork history review.

## Repository and security settings

The last verified committed source is `19e3a1793aeb85635a586cfd5d1a2b9d3b3dc740`. Its [Verify run](https://github.com/vaujan/kuskus/actions/runs/40266293523) passed Linux, Windows, and full-history Gitleaks. Changes after that commit need their own green run; local results do not replace it.

The repository has a GPL-3.0-only license, contributor and AI-disclosure guidance, bug/feature forms, generated dependency notices, and an enabled private vulnerability-reporting route. Secret scanning, secret push protection, and automated dependency security updates were enabled during this integration. The repository description and website are configured.

The `main` branch now requires an up-to-date branch, successful Linux/Windows/secret checks, one approving review, and resolved review conversations. These requirements apply to administrators. Force pushes and branch deletion are blocked. A maintainer cannot approve their own PR; arrange an independent reviewer before merging. The older disabled ruleset is not the enforcement mechanism; branch protection is.

## Integrated source fixes

- Removed the duplicate `normalizePath` import and included `vite.config.ts` in the normal Node TypeScript check.
- Updated direct and transitive dependencies within their supported major versions. The seven-day age policy and trust checks remain enabled; exact security patch exceptions are recorded in `pnpm-workspace.yaml`. See [the dependency audit](21-dependency-audit.md).
- Added persisted rollback journals for item moves and renames, folder moves and renames, reference rewrites, and associated metadata writes. Recovery runs before opening/scanning the vault, and operations are serialized per vault within the process. Process-interruption tests reopen real libraries; journals with conflicting paths stop recovery instead of overwriting both copies.
- Reference updates replace the note atomically without first moving its original out of the way. The journal retains the previous text until commit.

These changes establish tested process-interruption behavior, not power-loss durability or coordination with another process editing the same vault. Keep backups and use disposable copies when testing a preview. A failed recovery retains its journal for repair.

## Outstanding source-publication gate

The [asset inventory](16-third-party-assets.md) records 16 copied bookmark images plus their source manifest in earlier commits. Their removal from the current tree did not remove them from published history. Obtain redistribution clearance or coordinate a reviewed history rewrite covering branches and tags. Review affected release source archives and installers as well. Never treat an image URL as a redistribution license.

A public history rewrite changes commit/tag identities and needs coordination with contributors and release provenance. Do not force-push a filtered history or replace existing release artifacts as part of routine source fixes. Prepare and review the filtered result first; retain a private recovery copy, then explicitly approve the publication step. GitHub cached objects and existing clones may require separate follow-up.

## Desktop distribution

The [v0.0.3-preview.1 prerelease](https://github.com/vaujan/kuskus/releases/tag/v0.0.3-preview.1) contains Windows x64, Linux x64, and macOS ARM64/x64 installers, checksums, and build metadata. Its source predates this integration. Those assets do not contain the new recovery fixes merely because `main` has changed.

The release explicitly records unsigned Windows installers, ad-hoc-signed/not-notarized macOS builds, and incomplete clean-machine installation/runtime testing. Do not describe them as signed stable builds. Produce a new versioned candidate only after reviewing the source and completing the [beta gates](18-beta-release-plan.md).

Before stable distribution:

- Require green CI and a clean full dependency audit for the exact candidate.
- Build and inspect that candidate, verify signatures/publisher and SHA-256 checksums, and retain corresponding source.
- Test installation, upgrade, retained vaults, offline workflows, capture, immediate close/reopen, interruption recovery, keyboard access, accessibility, and uninstall on each distributed OS/architecture.
- Download and test the published artifacts and check the public website without signing in.

## Verification record

Before integration, `pnpm check` passed with 376 tests and the production audit reported zero advisories. The full audit reported 41 high, 25 moderate, and 2 low findings. The original standalone Vite config built successfully but failed a targeted TypeScript check because of its duplicate import.

Final integrated verification passed:

- `pnpm install --frozen-lockfile --ignore-scripts`: lockfile and installed dependencies are consistent. Earlier update/install runs also completed the Electron installation and native-dependency postinstall steps.
- `pnpm check:release`: 395 tests passed, none failed or skipped; formatting, lint, desktop/website type checks and builds, the full dependency audit, Storybook, Linux x64 unpacked packaging, and archive inspection passed. Inspection verified 32,327 archive entries and Electron notices with Electron 44.9.1.
- The full audit reports zero advisories. The main renderer surface is 2,451,844 bytes against the unchanged 2,500,000-byte budget; Quick Capture is 952,505 bytes.
- Gitleaks 8.30.1, downloaded from its upstream release and checked against its published SHA-256 manifest, found no leaks in reachable local Git history, an export of current tracked/unignored source, or the prepared filtered history. The filtered copy has no reachable objects under the removed bookmark directory, and its main tip has the same source tree as the original committed main.
- `git diff --check` and formatting of the final documentation updates passed.

The full check initially exposed a timing-dependent live-preview test, an incompatible Base UI update, and renderer growth from React 19.3. The test now completes and publishes its parse before assertions. Base UI remains at the existing 1.6.0 API, and React/React DOM remain at 19.2.7. No performance ceiling or audit threshold was raised. Builds retain the existing search-highlight CSS and large-chunk warnings.

Changes remain local and uncommitted; GitHub security settings are live. The green remote CI above predates this integration. No new release, history force-push, signed installer, clean-machine native installation test, or live-site interaction is claimed.

AI assistance: Codex implemented and checked this integration and drafted its technical documentation. The exact model label is not exposed in the active user interface; model unknown. Human review, artwork clearance, and native release approval are not claimed.
