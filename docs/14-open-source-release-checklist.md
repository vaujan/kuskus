# Open-source and release readiness

Updated 2026-10-22 (Asia/Jayapura). The first launch milestone is the public source repository and browser demo. Windows installers remain a separate milestone: the maintainer currently has neither Windows signing nor a native Windows test machine. No public installer or tag has been prepared by this pass. See [the source-launch handoff](17-source-launch.md).

## Launch hardening on 2026-10-22

- [x] Validate DNS answers at socket connection time using an Undici agent, closing the gap between metadata preflight validation and a subsequent DNS lookup. Redirects retain destination validation.
- [x] Reject symbolic links and Windows junctions in resolved vault paths, including dangling links and `.kuskus` metadata paths. Archive destinations and referenced note images use the same guard. This is a filesystem guard, not a guarantee against a concurrent process replacing path components between validation and IO.
- [x] Record the maintainer's artwork ownership/redistribution confirmation and retain upstream MIT notices for all five bundled-skill sources.
- [x] Re-run Gitleaks 8.30.1 locally: 243 reachable commits, approximately 8.39 MB scanned, no findings. A directory scan also reported no findings; files over 5 MB were excluded. No scan guarantees the absence of secrets.
- [x] Verify the existing remote default-branch CI at [`12c2cb2`](https://github.com/vaujan/kuskus/actions/runs/39409885178): Linux, Windows, and full-history Gitleaks jobs all passed. New changes require their own green CI run before merging.
- [x] Add visible source, license, and third-party notice links to the landing page. Publish the repository before announcing the site so the source link resolves publicly.

## Completed fixes

- [x] Upgrade Electron from 39.8.10 to 44.7.0, update Mermaid and KaTeX, and patch transitive DOMPurify, KaTeX, and Undici dependencies. Production dependency audit now reports **zero advisories**, down from 11. The seven-day dependency age policy remains enabled. KaTeX is pinned to 0.18.10 because the subsequent 0.18.11 release is marked as accidentally breaking.
- [x] Restrict external URLs to HTTP(S) through one shared main-process helper. Every app window denies popups, unexpected navigation, frame navigation, and webview attachment.
- [x] Authenticate all library, capture, and window IPC handlers using registered WebContents, the main-frame identity, and the exact expected renderer document. Reject unregistered windows, child frames, missing frames, and remote/opaque URLs.
- [x] Keep note-save rollback files inside `.kuskus/temp` rather than exposing them to vault indexing. A watched-vault regression test fails with the old placement and passes with the internal backup.
- [x] Adapt image and text clipboard writes to Electron 44's asynchronous API; load the native thumbnail API only when thumbnail decoding is needed.
- [x] Remove the template update destination and Linux maintainer, missing macOS entitlement reference, and unused camera/microphone permission descriptions. macOS notarization is enabled; its build remains experimental until native verification.
- [x] Add real repository, issue, homepage, and contributor metadata. Scope public releases to Windows; retain experimental local macOS/Linux packaging, using AppImage for Linux.
- [x] Make all platform packaging scripts run the same validation and icon generation and disable implicit publishing.
- [x] Replace the bump-before-build release flow. `pnpm release` now validates, audits, and requires signed Windows installers without changing versions, tags, or publishing.
- [x] Restrict archive inputs to application output, resources, package metadata, LICENSE, and generated notices. Add archive inspection and behavioral tests rejecting repository-only files, credential files, and missing attribution.
- [x] Generate full third-party notices for 275 application dependencies and the vendored atomic editor, including reviewed upstream supplements for three npm packages missing full license text. Include notices in desktop archives and landing-page output; require Electron's own notices in package inspection.
- [x] Remove obsolete v1 library migration, automatic visible-metadata conversion, localStorage draft/preference migration, migration IPC/UI, and four skipped legacy tests. Reject obsolete root library metadata without modifying it; preserve user Markdown properties.
- [x] Add Linux/Windows CI for frozen installation, tests, lint, type checks, desktop/landing builds, bundle budget, dependency audit, and unpacked package inspection. Add a read-only, full-history Gitleaks job with redacted output and a pinned container digest.
- [x] Update README, changelog, contribution guidance, privacy description, security-reporting instructions, release process, backup guidance, and asset inventory.
- [x] Scan all reachable Git history locally with detect-secrets 1.5.0, with credential verification disabled. Scanned 2,496 text blobs (binary blobs and files over 5 MB excluded). All 33,871 findings were verified as lockfile integrity hashes: 33,779 dependency checksums and 92 skill checksums. No credential-specific detector fired. The current working tree was also scanned (716 source/document files); its 1,444 entropy matches were likewise verified as lockfile checksums. CI additionally runs Gitleaks; these scans are evidence, not a guarantee that no secret exists.

## Local verification

| Check                                        | Result                                                                                                                                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automated tests                              | 348 passed, zero failed or skipped; includes socket DNS validation, redirects, symlink/junction containment, sender authentication, release sequencing, and package inspection                                                            |
| Desktop TypeScript                           | Passed                                                                                                                                                                                                                                    |
| ESLint                                       | Passed                                                                                                                                                                                                                                    |
| Desktop production build                     | Passed                                                                                                                                                                                                                                    |
| Static renderer budget                       | Passed: main 2,435,312 / 2,500,000 bytes; quick capture 951,860 bytes                                                                                                                                                                     |
| Landing-page TypeScript and production build | Passed; license and notice files copied to output                                                                                                                                                                                         |
| Production dependency audit                  | Zero known advisories                                                                                                                                                                                                                     |
| Frozen-lockfile install                      | Passed with pnpm 11.26.0; Node.js 24.19.0 installed and used by project scripts                                                                                                                                                           |
| Native unpacked app                          | Fresh Linux x64 package with Electron 44.7.0; archive inspection passed for 41,430 entries. Native launch with 100 synthetic notes reached its first card in approximately 1.48 seconds and exited cleanly (single smoke run, 2026-10-22) |

Builds still emit CSS optimizer warnings for `::highlight` and landing-page large-chunk warnings. These do not fail the build; verify search highlighting visually. A bundle budget is not a native responsiveness measurement. The app's main surface remains close to its static ceiling.

## Remaining publication gates

- [ ] **Verify signed installers on Windows.** Provide signing credentials through the signing provider/environment, run `pnpm release`, inspect the signature and publisher, and test installation, launch, offline use, upgrade, uninstall, retained libraries, and shortcut behavior on clean x64/ARM64 systems. Do not publish an architecture solely because it cross-compiles.
- [x] **Confirm a newly packaged Linux application.** The earlier apparent stall was a slow, incomplete runtime download repeatedly interrupted by short time limits. Resumed the official archive, verified its SHA-256, installed Electron 44.7.0, packaged the app, passed archive inspection, and completed a native launch using a disposable 100-note library. Windows packaging and native installation remain separate gates.
- [ ] **Enable GitHub private vulnerability reporting.** SECURITY.md points to the repository's private reporting route; repository settings were not changed locally.
- [x] **Confirm artwork and skill provenance.** Maintainer confirmed artwork ownership on 2026-10-22. Upstream skill MIT declarations were reviewed and notices retained. See [the asset inventory](16-third-party-assets.md).
- [ ] **Review GitHub CI results for the launch changes.** Existing default-branch CI is green, including full-history Gitleaks; review a new run for these changes before merging and making the repository public.
- [ ] **Perform hands-on data safety and accessibility checks** below. Automated tests do not establish native UI behavior or power-loss safety.
- [ ] **Prepare the actual release.** Update the version and release notes, commit reviewed sources, build and verify signed artifacts, then tag the exact source and publish installers/checksums with corresponding source access. The landing page intentionally keeps browser-demo language until actual downloads exist; update its source/download links at publication time.

## Hands-on product checklist

Use disposable copies of representative vaults. Record OS, architecture, installer version, and result.

- [ ] Create/open/reopen libraries with Unicode names, spaces, missing folders, and permission failures.
- [ ] Edit rapidly, switch notes/libraries, close immediately, reopen, and compare saved text.
- [ ] Edit the same note in two Kuskus windows and an external editor; verify visible conflicts and preserved content.
- [ ] Import supported media/files, then restart, rename/move items and folders, and relocate the entire vault. Inspect relative attachments.
- [ ] Trash/restore items and folders; verify reference-aware cleanup and confirmation for permanent deletion.
- [ ] Interrupt saves and batch moves, simulate disk-full/write failures, restart, and compare against a backup.
- [ ] Check malformed frontmatter, missing/broken attachments, huge files, and links/junctions introduced after indexing. Shared path guards reject links, with regression coverage; concurrent filesystem mutation and every native workflow still need manual verification.
- [ ] Check URL failures, redirects, offline use, and private-address rejection. Socket DNS answers are now validated as well as preflight destinations, with regression coverage; native network behavior still needs manual verification.
- [ ] Verify quick capture shortcut conflicts, cancellation/recovery, restart persistence, and focus restoration on Windows.
- [ ] Check keyboard-only use, screen-reader labels, zoom, small windows, both color modes, reduced motion/transparency, and search highlighting.
- [ ] Measure packaged cold startup, typing, search, capture, and scrolling on a representative large library.

See [the release process](15-release-process.md) for exact preparation, signing, publication, and backup steps. macOS and Linux remain experimental until their corresponding native checks pass.
