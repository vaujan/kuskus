# Contributing to Kuskus

Thanks for taking a look. Kuskus is still an early desktop app, so reports of broken workflows are as useful as code. Windows is the first release target; macOS and Linux builds are experimental.

## Before you start

Search the [existing issues](https://github.com/vaujan/kuskus/issues) first. For a large feature or architectural change, open an issue to discuss the problem before spending time on an implementation. A small, focused fix can go straight to a pull request.

Read [AGENTS.md](AGENTS.md) for implementation rules and the [architecture guide](docs/10-current-architecture.md) for the code layout. Use existing dependencies where they fit, keep responsibilities separate, and remove obsolete paths instead of adding compatibility layers.

## Set up and check your work

Use pnpm 11.26.0. The project pins Node.js 24.19.0, which pnpm downloads during installation.

```bash
pnpm install --frozen-lockfile
pnpm dev:demo
```

The demo profile keeps test content separate from your normal library. Changes persist between runs; `pnpm demo:reset` replaces that sample content. Never test destructive operations on your only copy of a vault.

Before submitting, run:

```bash
pnpm format
pnpm check
pnpm audit --prod
```

Report failures honestly, including checks you couldn’t run. A build passing doesn’t mean you’ve tested the app’s behavior. For data integrity or security changes, add tests that exercise the failure being fixed. For UI changes, include screenshots with sample content and check keyboard use, both color modes, and reduced motion.

The [development guide](docs/development.md) covers Storybook and isolated workspaces. The [release maintenance guide](docs/20-release-maintenance.md) covers packaging and archive checks.

## Using AI

You can use AI to write, debug, review, or document a contribution. The quality bar stays the same: read the whole diff, understand how it works, and verify the behavior yourself. Don’t submit output you can’t explain or assume an AI review replaces your own.

Every PR needs an honest AI disclosure. Name the tool and model used, and explain what each helped with, including code, tests, docs, and the PR description. Copy the exact model label shown by the tool or session metadata, such as GPT-6.1. Check that metadata before writing the disclosure; a tool name alone is insufficient, and an available model label must not be replaced with “unknown.” Only write “model not exposed” or “automatic selection; model unknown” when no model label is available. Don’t guess a version or claim you used a model you didn’t. If you didn’t use AI, say so.

Write the opening explanation in your own words: what prompted the change, who it helps, and why you chose this approach. AI can help organize technical details, but you need to check every claim. Don’t paste a generated summary in place of your own account of the work. You don’t need polished English or a long essay.

Don’t send private vault contents, credentials, or other people’s data to an AI service. Keep original attribution and license notices for any code or assets you bring in. AI output doesn’t establish permission to redistribute material.

See the [PR guide](docs/pull-requests.md) for examples.

## Open a pull request

Keep each PR about one problem. Describe the result, how you checked it, and any remaining limitations. Use the repository’s PR template; short answers are fine. Don’t claim a check passed because a model predicted it would.

For user-facing changes, add an entry under `unreleased` in `releases/notes.json` and run `pnpm changelog:generate`. Don’t edit the generated changelog or bump versions in feature work. See the [versioning policy](docs/19-versioning.md).

## Report a problem or suggest an idea

For bugs, include the version or commit, operating system, steps to reproduce, and expected and actual results. Mention whether it happens with the demo library. Remove personal paths, note contents, URLs, and credentials from logs and screenshots.

For ideas, use the [feature request form](https://github.com/vaujan/kuskus/issues/new?template=feature-request.yml). Describe your goal, how you handle it today, and how often it comes up. Requests help guide development; they aren’t delivery commitments.

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Working together

Be considerate, explain disagreements, and keep feedback about the work. Harassment and personal attacks aren’t welcome. Maintainers may close contributions that don’t meet these expectations or the project’s scope.

By contributing, you agree to distribute your contribution under [GPL-3.0-only](LICENSE). Include provenance and original license notices for third-party code and assets. Don’t add material whose redistribution rights are unclear.
