# Contributing to Liquid Loom

Thanks for helping make Shopify theme development calmer and more predictable.

## Set up the repository

```bash
corepack enable
pnpm install
pnpm build
pnpm validate
```

Node.js 22.12 or newer is required. Use the pnpm version declared in `package.json` so local and CI lockfile behavior stays aligned.

## Choose the right source directory

- Liquid and theme JSON belong under `src/theme/`.
- Static assets that should be copied without bundling belong under `src/public/`.
- Browser entrypoints belong under `src/entrypoints/`.
- Authored CSS belongs under `src/styles/`.
- Generated files under `dist/` and `.cache/` must not be edited or committed.

Nested folders under `layout`, `sections`, `snippets`, `blocks`, and `public` flatten by filename. Run `pnpm build` after adding files; destination collisions are errors by design.

## Development rules

1. Write a failing test before changing build-system behavior.
2. Keep platform logic in small, dependency-light modules under `build-scripts/lib/`.
3. Preserve standard Shopify behavior when JavaScript is unavailable.
4. Do not add store identifiers, credentials, customer data, private endpoints, or vendor-specific business workflows.
5. Keep the reference theme merchant-neutral and accessible.
6. Update the README when the source contract or commands change.

## Before opening a pull request

```bash
pnpm validate
```

That command enforces coverage, formatting, a clean production build, project checks, Shopify Theme Check, and the public-readiness scan.

Keep pull requests focused. Explain the user-facing outcome, note any source-to-output mapping change, and include tests for success and failure paths.
