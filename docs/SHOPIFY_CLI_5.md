# Shopify CLI 5 compatibility

Liquid Loom's next-generation source starter targets `@shopify/cli ^5.0.1`. Both the
root workspace and packaged `create-liquid-loom` template use the same tested
major. The package manager lockfile resolves `@shopify/cli` to version `5.0.1`.

## What changed

Shopify CLI 5 is a major release, so this is a deliberate upgrade, not an
automatic response to a new upstream tag. It supports structured JSON output
for most commands, alters some existing JSON response shapes and removes the
`theme dev --poll` flag. Liquid Loom's existing theme-development launcher
calls `shopify theme dev --path dist/theme` without `--poll`, and does not parse
Shopify CLI JSON output.

With Shopify CLI 5.0.1, Theme Check rejected the old product form expression
`id: 'ProductForm-' | append: block.id`. The form ID is now assigned in Liquid
before the form tag. Theme Check also required a local stylesheet declaration
for the predictive-search results class. Both changes are mirrored in the
packed starter. The upgrade candidate was validated with a frozen lockfile
and a clean native theme build: **42 files inspected, zero Theme Check offenses**.

Automated CI includes unit tests, cross-platform builds, `shopify theme check`,
a packed consumer smoke test and CodeQL. These tests establish toolchain and
source compatibility, not browser or purchase acceptance.

## Remaining Shopify runtime validation

On a non-production development store, test `shopify theme dev`, Theme Editor
customization, product/cart/search, 250+ variants, selling plans, and
progressive enhancement when JavaScript is unavailable. Verify authentication
and non-interactive CLI output before adopting CLI 5 in automation outside
Liquid Loom. Do not merge the separate product-purchase hardening PR without
its runtime acceptance; the form-tag fix must be preserved during reconciliation.

This migration does **not** enable the July 2026 Liquid-first preview. That
remains an explicit opt-in path and requires an eligible preview store.

References:

- https://shopify.dev/docs/api/shopify-cli/migrate/5-0
- https://github.com/Shopify/cli/releases/tag/5.0.0
- https://github.com/Shopify/theme-tools/releases
