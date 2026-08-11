## Verification

For implementation changes, run at minimum:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Also perform focused verification of the changed workflow. Storage changes require testing creation, restart/reload, invalid data, missing content, and path safety in proportion to the change.
