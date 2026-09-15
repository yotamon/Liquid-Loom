# Shopify GitHub deployment

Liquid Loom intentionally keeps authored source separate from deployable Shopify output. Shopify's GitHub theme integration, however, expects the connected branch to contain Shopify's canonical theme directories.

For repositories that use `src`, tests, and build tooling, connect Shopify to a **compiled deployment branch** or a separate deployment repository rather than to the authored branch.

## Recommended topology

```text
main
├── src/
├── tests/
├── liquid-loom.config.ts
└── package.json
      |
      | CI: install -> validate -> build
      v
shopify-production
├── assets/
├── blocks/
├── config/
├── layout/
├── locales/
├── sections/
├── snippets/
└── templates/
      |
      v
Shopify GitHub integration
```

The deployment branch is generated output. `main` remains the source of truth.

## Safe CI policy

Use a workflow triggered only by authored branches. Never trigger the build from `shopify-production` itself; that prevents a Shopify-originated commit on the connected branch from creating a deployment loop.

When publishing:

1. fetch the current `shopify-production` head;
2. create a worktree from that head so the new deployment is a fast-forward commit;
3. replace only the canonical Shopify theme directories with `dist/theme`;
4. commit only when the compiled output changed;
5. push without `--force`.

A concurrent Shopify write will make the push fail rather than silently overwrite history. Re-run only after reviewing the branch state.

See [`docs/examples/shopify-deploy.yml`](examples/shopify-deploy.yml) for an opt-in workflow recipe.

## Theme Editor writes

A compiled branch can't automatically translate Theme Editor changes back into organized source. Choose one of these policies explicitly:

- **Source-authoritative:** Theme Editor changes on the deployment branch are temporary and the next successful source deployment may replace them. Keep history so drift can be reviewed first.
- **Reconciliation workflow:** review Shopify-originated commits and manually port intentional changes into authored source before the next deployment.
- **Separate deployment repository:** use this when you want stronger operational separation between authored source and generated theme output.

Do not pretend two-way synchronization is lossless when a build step changes source shape.

## Development stores

For protected integration CI, Shopify CLI 4.8+ can create a disposable dev store, preview the built theme, run browser smoke tests, and remove the store afterwards. Public CI should continue to run without Shopify credentials.
