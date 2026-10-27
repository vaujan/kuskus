# Dependency audit

Updated 2026-10-26 (Asia/Jayapura). This is evidence for the current local lockfile, not an advisory allowlist or a guarantee against unknown vulnerabilities. Rerun the audit for the exact release commit.

## Current result

`pnpm audit --json` reports **zero advisories** across production and development dependencies: 0 critical, 0 high, 0 moderate, 0 low. The audit reports 1,413 total dependencies. Before this integration, the full audit reported 41 high, 25 moderate, and 2 low advisories; the production-only audit was already clean.

Direct tooling and its transitive dependencies were updated within supported major versions. Patched packages include Fast URI, brace-expansion, PostCSS, js-yaml, nanoid, tar, Browserslist, qs, xmldom, baseline-browser-mapping, Hono, ip-address, http-cache-semantics, source-map-js, postcss-selector-parser, the MCP TypeScript SDK, Zod, and body-parser.

`pnpm-workspace.yaml` keeps the seven-day minimum release age and trust policy. Exact exceptions allow audited security patch versions without disabling those policies globally. Same-major transitive patch floors prevent affected versions of Fast URI 3.x, brace-expansion 2.x, tar 7.x, xmldom 0.8.x, http-cache-semantics 4.x, and body-parser 2.x from returning through older parent constraints. No incompatible cross-major transitive override was introduced.

Base UI is pinned to the existing 1.6.0 API used by controlled context-menu triggers. A later 1.x update removed that API; a UI migration is outside this security integration. The retained version passes the full audit. React and React DOM remain at the previously used 19.2.7 release; the unrelated 19.3 update exceeded the existing renderer bundle budget. The budget was not increased.

## Ongoing gate

`pnpm check:release`, the signed Windows release command, and the installer workflow require the full audit, including development tooling. CI uses `pnpm check:release`, so a new tooling advisory also fails the release check. `pnpm audit:all` runs the full audit independently; `pnpm audit --prod` remains useful for inspecting shipped dependencies separately.

For a new finding, use `pnpm why <package>` to locate the owning tool and inspect its supported dependency range. Prefer a supported parent update or a compatible patch floor. Review upstream changes before major upgrades; do not hide findings by raising audit thresholds or adding blanket exclusions. Keep development servers local and use trusted build inputs.

Package inspection and native runtime checks remain necessary after dependency changes. A clean audit does not establish correct application behavior or installer readiness. See [the launch review](22-public-launch-review.md) for the remaining release gates.
