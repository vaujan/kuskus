# Dependency audit follow-up

Recorded 2026-10-23 (Asia/Jayapura). This is a dated maintenance record, not an advisory allowlist.
Re-run the audits against the exact release commit; database results change over time.

## Results

The full development and production audit initially reported 71 advisories: 2 critical, 42 high,
26 moderate, and 1 low. After targeted patches, it reports 63: **0 critical, 40 high, 23 moderate**.
The production-only audit remains a separate release check. Development advisories can affect the
build environment even when they do not appear in the production dependency audit.

Patched all three Storybook packages together from 10.6.0 to 10.6.2, raised Vite's minimum to
7.3.7 in both workspaces, and constrained transitive `proxy-addr` to patched 2.0.8 or later. These
address the reviewed [Storybook origin-validation advisory](https://github.com/advisories/GHSA-f2ph-cmg5-wxc8),
[Vite Windows editor-launch advisory](https://github.com/advisories/GHSA-587h-7wmj-h5pm), and
[proxy-addr advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h). The dependency age and
trust policies remain enabled.

## Outstanding work before broad distribution

Remaining reported modules include `fast-uri`, `brace-expansion`, `postcss`, `js-yaml`, `nanoid`,
`tar`, `browserslist`, `qs`, `@xmldom/xmldom`, `baseline-browser-mapping`, `hono`, `ip-address`,
`http-cache-semantics`, `braces`, `source-map-js`, `postcss-selector-parser`, and
`@modelcontextprotocol/sdk`. Multiple advisories and installed versions can affect the same module;
the module count is not the advisory count.

Run `pnpm audit:all` and `pnpm why <package>` to identify the affected parent and usage. Upgrade
the owning tools within supported ranges, inspect release notes before major updates, and rerun
`pnpm check:release` after lockfile changes. For findings without a compatible fix, review the
actual exposure and record the decision, owner, and follow-up before releasing. No such exceptions
have been approved by this cleanup pass. Do not force a new major transitive dependency across
incompatible parent APIs or raise audit thresholds to hide findings.

Until reviewed, keep the development servers local and use trusted build inputs. This pass does
not establish that all development tooling is vulnerability-free, and a passing production audit
must not be described as a clean full audit.
