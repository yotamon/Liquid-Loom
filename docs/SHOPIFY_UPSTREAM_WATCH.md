# Shopify upstream compatibility watch

Liquid Loom checks the main Shopify theme development surfaces once per week. This is a **read-only signal**, not a dependency updater or storefront acceptance test.

The watched sources are Dawn's latest stable release, Horizon's main commit, Skeleton's preview main commit, Shopify CLI's latest stable release, and package-specific Theme Check / Liquid Prettier releases in the `Shopify/theme-tools` monorepo. GitHub's obsolete `Shopify/theme-check` repository is **not** the source for Theme Check 4.x.

The [audited baseline](shopify-upstream-baseline.json) records known source references on November 11, 2026. The script compares current references against that baseline without silently advancing it. It also checks whether the CLI major version declared by the framework and generated starter matches the current upstream CLI major. A major match does **not** imply behavioral compatibility.

## Run

```bash
node scripts/shopify-upstream-watch.mjs
node scripts/shopify-upstream-watch.mjs --json
```

The GitHub workflow **Shopify upstream compatibility watch** runs weekly, or manually with `workflow_dispatch`. It emits a Markdown report in the workflow summary. It cannot merge PRs, update a package, push a theme, publish to npm, or modify the baseline. A partial GitHub API failure produces an explicitly incomplete report, never a fabricated unchanged state. A total outage fails the workflow.

The script uses at most five GitHub API requests per run and requires no extra npm dependencies. For local runs, you can optionally supply a normal GitHub `GITHUB_TOKEN` to avoid low anonymous rate limits.

## Engineering review when an upstream changes

1. Read the relevant upstream release notes, compare actual behavior, and identify breaking Shopify CLI or Theme Check changes.
2. Test a candidate dependency or storefront change in an isolated branch. Preserve stable JSON templates and native Shopify runtime behavior; keep July 2026 preview changes opt-in.
3. Run tests, the build, Theme Check, packaged-consumer smoke, and real development-store acceptance when behavior depends on Shopify.
4. Merge reviewed changes before updating the reference in `docs/shopify-upstream-baseline.json`. Update the baseline only after the corresponding change is understood and accepted.

**Already actionable as of November 11, 2026:** Shopify CLI **5.0.1** exists while the framework declares `^4.6.0` and the embedded starter `^4.8.0`. Shopify Theme Check has reached **4.0.0**, and the Liquid Prettier plugin **1.11.4**. CLI 5's `--poll` removal and changed JSON output require a deliberate migration audit, although Liquid Loom's own theme-dev launcher does not use `--poll`. Do not equate the compatibility watch with completion of this migration.

Official upstream sources: [Dawn releases](https://github.com/Shopify/dawn/releases), [Horizon](https://github.com/Shopify/horizon), [Skeleton](https://github.com/Shopify/skeleton-theme), [Shopify CLI releases](https://github.com/Shopify/cli/releases), [Theme Tools releases](https://github.com/Shopify/theme-tools/releases).
