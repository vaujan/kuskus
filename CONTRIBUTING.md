# Contributing to Kuskus

Kuskus is a local visual reference library built with Electron, React, and TypeScript. Windows is the first release target; macOS and Linux builds are experimental.

Read [AGENTS.md](AGENTS.md) for implementation rules and [the architecture](docs/10-current-architecture.md) for the code layout. Keep changes focused, use existing dependencies where practical, and remove obsolete implementations rather than introducing compatibility layers.

## Set up and verify

Use Node.js 24.19.0 and pnpm 11.26.0. Install with `pnpm install --frozen-lockfile`, start with `pnpm dev`, and run `pnpm check` before submitting a pull request. `pnpm audit --prod` checks dependency advisories. `pnpm build:unpack` creates an unsigned local package; run `pnpm package:verify` on Windows or Linux to inspect its archive and required notices.

Use `pnpm dev:demo` for a disposable sample library. Never test destructive operations on your only copy of a vault. Use synthetic content in bug reports and fixtures.

## Issues and pull requests

Search existing [issues](https://github.com/vaujan/kuskus/issues) before opening one. For bugs, include the Kuskus version or commit, OS version, steps to reproduce, expected and actual results, and whether the issue occurs with the demo library. Redact file paths, note contents, URLs, and other personal data from logs and screenshots.

Explain the user-facing problem and resulting behavior in a pull request, along with relevant verification. Add behavioral tests for data integrity and security changes. For UI changes, include screenshots with synthetic content and check keyboard interaction, both color modes, and reduced motion preferences.

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

Contributions are distributed under [GPL-3.0-only](LICENSE). Include provenance and original license notices for third-party code or assets. Do not add assets whose redistribution rights are unclear.
