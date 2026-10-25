# AGENTS.md

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.
- Study how established products solve the problem before designing a solution. Adopt their proven patterns and conventions rather than inventing an approach from scratch.

## Contributions and PR descriptions

- Follow [CONTRIBUTING.md](CONTRIBUTING.md) and [the PR guide](docs/pull-requests.md).
- Disclose AI tools, the model labels actually shown, and their roles in every PR. If the model is hidden or selected automatically, say it is unknown; never invent a model name.
- Leave the contributor’s personal reason for the change for the human to write. Do not impersonate their experience or claim they reviewed or tested something without evidence.
- State only checks actually run and their results. Keep explanations concrete and concise.
