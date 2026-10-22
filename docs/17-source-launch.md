# Source and browser-demo launch

Prepared 2026-10-22 (Asia/Jayapura). Launch the source repository and browser demo first. Public Windows installers follow when signing and native testing are available. Do not describe the desktop app as a verified public binary release yet.

## Ready locally

- Artwork ownership and public redistribution confirmed by the maintainer.
- MIT attribution retained for bundled development skills; runtime and vendored-code notices generated for desktop and site distributions.
- Socket DNS validation and vault symlink/junction rejection added with regression coverage.
- `pnpm check`: 348 tests pass, no failures or skips; lint, desktop/landing TypeScript, both production builds, and renderer budget pass.
- `pnpm audit --prod`: no known vulnerabilities.
- Fresh Linux x64 archive inspection and native launch with 100 synthetic notes passed. First card appeared in approximately 1.48 seconds in this single run. This is a smoke check, not a cross-platform performance or data-safety certification.
- Gitleaks 8.30.1: no findings in 243 locally reachable commits or the directory scan; directory files over 5 MB were excluded.
- Existing remote default-branch CI passed on Linux and Windows, including full-history Gitleaks: [run 39409885178](https://github.com/vaujan/kuskus/actions/runs/39409885178). Launch changes need a separate green run.

## Final source-publication steps

1. Review and merge the launch-readiness PR after its Linux, Windows, and secret-scan jobs pass. Keep the remote watch-path and smoke-check fixes already merged into `main`.
2. Sign into GitHub and enable private vulnerability reporting for `vaujan/kuskus`. The local CLI credential is invalid, the in-app browser is signed out, and the connected GitHub tool does not expose that administration action. Confirm the private reporting route in `SECURITY.md` works after publication; do not post exploit details publicly.
3. Review the repository, history, screenshots, and demo content for information you do not want to disclose. Change repository visibility to public in GitHub settings only after this review. Publishing source exposes reachable history as well as the current files.
4. Build the site with `pnpm --dir landing-page build` and deploy `landing-page/dist/` to the existing static hosting project. It includes `LICENSE` and `THIRD_PARTY_NOTICES.txt`. Verify the demo, source link, notice links, keyboard use, and a narrow viewport on the published URL.
5. Announce it as an early source preview with a browser demo. The site links directly to the GPL-3.0-only source, so keep the source-publication-before-site-deployment order. Do not announce desktop downloads until they exist and pass the installer gates.

The repository remains private and the site has not been deployed by this preparation. No tag, GitHub release, or public installer has been published.

## Windows installer milestone

The maintainer confirmed that Windows signing and a Windows x64 test machine are not available yet. Arrange those before distributing the supported Windows installer. Run the signed release flow and the clean-machine checks in [the release process](15-release-process.md), including signatures, launch, offline use, upgrade, uninstall, retained vaults, quick capture, save/conflict recovery, and accessibility. Advertise ARM64 only after matching native testing. Keep Linux and macOS experimental.
