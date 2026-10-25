# Public launch review

Reviewed 2026-10-25 (Asia/Jayapura), starting from `1adec7b5a2ee173cce47eac900413fff2765fff1`. This review covers source publication, contributor documentation, and release evidence. It doesn’t approve a desktop release or change repository visibility.

I would hold the public announcement until the source gates below are closed. The project has a license, attribution tooling, automated checks, and a working contribution path, but current CI is red and some demo artwork has no recorded redistribution clearance. Publishing as an early source preview is a smaller milestone than distributing supported installers.

## What GitHub shows today

- The repository is private, its default branch is `main`, and it has no GitHub releases.
- The [latest default-branch run](https://github.com/vaujan/kuskus/actions/runs/40099022804) tests the starting commit above. Linux and Windows verification failed; the full-history Gitleaks job passed.
- Linux reached the production dependency audit and failed on four advisories. Windows failed earlier: `vite-plugin-static-copy` could not find the PDF.js `cmaps` input using a Windows path. Inspect path normalization in `electron.vite.config.ts` and `vite.config.ts` before retrying Windows CI.
- Branch protection could not be inspected: the integration returned HTTP 403. The ruleset endpoint also returned 403, requesting GitHub Pro or a public repository. This is not evidence that protections are configured. Verify required reviews and Linux/Windows/secret checks in repository settings when available.

The previous launch handoff describes an earlier state. In particular, its statements about green CI and an unpublished website aren’t current launch evidence.

## Dependency audit

Fresh audit results:

| Scope                                   | Critical | High | Moderate | Low |
| --------------------------------------- | -------- | ---- | -------- | --- |
| Production (`pnpm audit --prod --json`) | 0        | 2    | 2        | 0   |
| All dependencies (`pnpm audit --json`)  | 0        | 43   | 27       | 2   |

The production report includes Electron and Undici. Electron is declared as a development dependency but is the shipped desktop runtime; its classification doesn’t make it irrelevant to users.

- Electron 44.7.0 is affected by the [compromised intermediate certificate advisory](https://github.com/advisories/GHSA-jr5w-w6x2-84p9). The advisory lists 44.9.1 as the patched version in this major line.
- Undici is affected by [excessive content-encoding handling](https://github.com/advisories/GHSA-xjj6-f33q-929c), [EventSource memory growth](https://github.com/advisories/GHSA-4qv8-2p9j-2685), and [integrity-token handling](https://github.com/advisories/GHSA-f72v-6w45-q472). The report lists 7.30.1 as the patched version in this major line.

Update compatible direct dependencies and the Undici override together, regenerate the lockfile, and rerun the audits and builds. Check the existing seven-day dependency age policy rather than silently disabling it. Review the remaining tooling advisories by actual exposure; a passing production audit won’t resolve them. No dependency exceptions or upgrades were made in this documentation pass.

## Before opening the source

- [ ] Fix Windows PDF asset copying and require green Linux and Windows CI for the final launch commit.
- [ ] Resolve the production advisories and review outstanding development-tool exposure. Preserve the audit gate in CI.
- [ ] Clear the copied bookmark artwork in `src/renderer/src/demo/assets/bookmarks/`. `sources.json` records URLs, but the asset inventory has no license or permission record for these images. Record redistribution terms and attribution, or replace the images with original or licensed assets. The earlier confirmation for maintainer artwork doesn’t cover these additions.
- [ ] Review all published refs, history, sample content, screenshots, and commit metadata for information you don’t want public. The starting commit has a successful full-history secret-scan job; require a fresh successful scan after the final changes. No new local full-history scanner was run in this pass.
- [ ] Commit and review the documentation changes. Require a contributor-written reason, accurate verification, and honest AI disclosure in PRs.
- [ ] Change visibility only after those checks. Immediately enable private vulnerability reporting and verify the route in `SECURITY.md` before announcing. Configure required checks/reviews and enable available secret protection.
- [ ] Verify the public repository and website without signing in. Check the demo, source link, license, notices, keyboard use, and mobile layout. The website guide records an earlier deployment; this pass hasn’t inspected the live UI.

Repository description and homepage are empty in GitHub. Add a short description, the website URL, and useful topics so visitors can identify the project. These are discoverability improvements rather than safety gates.

## Before distributing desktop installers

Keep the [beta plan](18-beta-release-plan.md) and [release process](15-release-process.md) as the release gates. In particular:

- `LibraryStore.moveItems` stages original files inside hidden storage and uses in-memory rollback on exceptions. Process termination doesn’t execute that rollback. Persisted recovery and interruption coverage remain necessary before claiming crash-safe multi-file operations.
- Windows signing and hands-on install, upgrade, uninstall, save/recovery, accessibility, and capture checks are still unverified here. Test each architecture you distribute.
- Build and inspect the exact release candidate, verify signatures and checksums, and publish its corresponding source and known limitations.

Source availability alone doesn’t establish that an installer is ready for people’s only copy of their notes.

## Documentation prepared in this pass

The README now starts with what the app does, its preview status, privacy behavior, and setup. Detailed development profiles moved into [the development guide](development.md). Contribution guidance allows AI assistance while requiring the contributor to understand and verify the whole diff.

The [PR guide](pull-requests.md) and GitHub template separate the contributor’s own reason, technical explanation, verification, and AI disclosure. Model names must come from the tool’s displayed label; unknown or automatically selected models must be described honestly. The agent instructions also prohibit inventing the contributor’s experience or claiming checks that didn’t run. A bug form now asks for reproducible details and warns against posting private data.

## Local verification

`pnpm check` passed locally: 367 tests passed, none failed or skipped; version consistency, formatting, lint, desktop type checks/build, renderer budget, and website type checks/build passed. The main renderer surface measured 2,437,981 bytes against a 2,500,000-byte budget. Builds still warn about `::highlight` CSS optimization and large website chunks.

The fresh production and full audits completed with the findings listed above, so the audit gate is failing. Local Markdown links and `git diff --check` passed. Formatting was checked again after the final documentation edits.

No fresh native package, Storybook build, Windows runtime test, local full-history secret scan, or live-site UI inspection was performed. These local results don’t replace Windows CI, native testing, artwork clearance, or a final history review.

AI assistance for this documentation pass: Codex, identified in this session as GPT-6; the exact serving variant isn’t exposed. AI inspected repository files and GitHub evidence, drafted the docs, and ran the recorded commands. The maintainer’s personal review and launch decision are still pending.
