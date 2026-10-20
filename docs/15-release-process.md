# Preparing a public release

Windows is the supported release target. macOS and Linux packaging commands are for experimental local testing until their native installation checks are completed. Electron 44 requires a 64-bit platform; macOS testing requires macOS 13 or later.

## Prepare the source

1. Work from a clean checkout with Node.js 24.19.0 and pnpm 11.26.0. Run `pnpm install --frozen-lockfile` and `pnpm check`. CI repeats these checks on Linux and Windows and inspects an unsigned unpacked package. Windows CI also builds and retains an unsigned x64 test installer for seven days. A green CI build is not a signed public installer.
2. Run `pnpm audit --prod`. Resolve advisories or record a reviewed, specific exception before release. Do not hide findings by raising the severity threshold.
3. Enable private vulnerability reporting in GitHub settings. Review the full-history secret scan and the asset provenance inventory. No automated scan can establish asset ownership or guarantee the absence of secrets.
4. Update the version with `pnpm version <patch|minor|major> --no-git-tag-version`, update CHANGELOG, and commit the reviewed release contents. Do not tag until the installer passes verification. The release command itself never changes the version or creates a tag.

## Build and inspect on Windows

Run `pnpm release` on Windows with the signing credentials supplied through the signing provider or electron-builder's documented environment variables. Never put credentials in the repository or command arguments. This command runs the complete verification suite and dependency audit, then builds with `forceCodeSigning=true` and `--publish never`. It fails if signing is unavailable. Local `build:win` and CI packaging may be unsigned and must not be mistaken for approved public releases.

Run `pnpm package:verify` after packaging. Generated THIRD_PARTY_NOTICES.txt, Kuskus LICENSE, and Electron's LICENSE.electron.txt and LICENSES.chromium.html must be present. Confirm the installer signature and publisher using Windows signature inspection. Generate SHA-256 checksums with `Get-FileHash` for every released installer.

Test the x64 and ARM64 installers on matching clean Windows systems before advertising each architecture. Check installation, offline launch, upgrade, uninstallation, retained library files, shortcut conflicts, quick capture, note saves, and conflict/recovery behavior. Record the results in the release checklist. Do not publish an architecture solely because cross-compilation succeeded.

## Publish after verification

Tag the exact verified source commit, attach the signed installers and checksums to its GitHub release, and provide corresponding source access. Include installation instructions, supported OS/architectures, known limitations, and backup/recovery advice. Kuskus currently has no automatic updater; users install new releases manually.

Update the landing page to link to the real release and public source when available. Until then its browser-demo language is intentional. Download and install the public artifact once more before announcing it.

No command in this process publishes automatically. Signing, native installer checks, source publication, and the announcement are separate release gates.

## Back up and recover

Close Kuskus and copy the entire library folder, including hidden `.kuskus` metadata and attachments, to a separate location. Keep ordinary Markdown/files together with their relative attachment paths. Back up the user profile separately if draft capture sessions and preferences matter. Do not rely on Trash as a backup.

After a crash or conflict, preserve a copy of the vault and profile before attempting recovery. Reopen the affected vault, inspect conflicting text and missing-file notices, and compare files with the backup. Reproduce bugs on a disposable copy. Never delete `.kuskus` or overwrite a conflicting note as an automatic recovery step.

## Runtime download troubleshooting

The first Electron download is over 100 MB and may take several minutes on a slow connection. Keep one download running while transferred bytes are increasing; repeated short time limits discard partial downloads. Run `pnpm exec install-electron` explicitly and confirm `pnpm exec electron --version` before debugging the app itself. Use official release artifacts and retain checksum verification.

CI caches Electron runtimes and packaging tools by operating system, architecture, and lockfile. A cold cache still requires a full download. If acquiring a runtime was interrupted, verify a fresh package rather than inspecting a leftover `dist` archive.

To inspect a cross-compiled Windows package on Linux, run `pnpm package:verify win32`. This checks archive contents and required notices, including electron-builder's `LICENSE.electron.txt`; it does not establish Windows installation or signing correctness.

When cross-building Windows on Linux, NSIS uses Wine to generate its uninstaller. Wine needs an initialized prefix owned by the current user and working system services. A partial setup stub from a failed Wine run is not an installer. Prefer the Windows CI artifact if the local Wine environment cannot finish initialization; signing and clean-machine checks are still required.
