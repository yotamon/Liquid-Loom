# Troubleshooting

## `BuildCollisionError`

Two source files resolve to the same portable Shopify path, or a static file claims a generated asset. The error lists every source. Rename one basename; changing only capitalization or Unicode composition is not portable.

## A build waits for another build

Liquid Loom serializes output mutations. Normally the waiting process proceeds when the active build finishes. If the owner process crashed, the next build detects its terminated PID and removes the abandoned lock. Do not delete `.cache/manifest.json.lock` while another build is running.

## The current build fails but `dist/theme` still looks old

That is intentional. Failed work remains in staging and is discarded; `dist/theme` is the last successful transaction. Fix the reported issue and rebuild.

## Performance budget failed

Run `pnpm analyze`, inspect the largest files, and confirm the change is intentional. Optimize the asset or adjust the documented budget in `liquid-loom.config.ts`. Avoid increasing budgets merely to silence an unexplained regression.

## Shopify CLI does not start

Run `pnpm exec shopify version`, authenticate with `pnpm exec shopify auth login`, and confirm the account can access a development store. `pnpm watch` remains available when only local compilation is needed.

## Theme Check reports generated files only

Run `pnpm build:clean` before `pnpm theme-check`. The root `.theme-check.yml` ignores authoring source and dependencies and checks the deployable output.

## `doctor` reports private content

Review the file and configured term before publishing. Findings intentionally print the location without echoing the configured private value into logs.

## Installation or lockfile mismatch

Use the pnpm version declared in `package.json` through Corepack:

```bash
corepack enable
pnpm install --frozen-lockfile
```

Contributors should update and commit `pnpm-lock.yaml` whenever package metadata changes.
