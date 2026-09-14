# Shopify Liquid July 2026 developer preview

Shopify's July 2026 Liquid changes introduce preview-only composition primitives including the `block` and `partial` tags.

Liquid Loom is aware of those primitives, but **does not enable or require them by default**.

## Stable is the default

Without configuration, Liquid Loom resolves:

```js
shopifyLiquidMode: "stable"
```

That is deliberate. A framework should not silently make a developer-preview runtime contract part of a production theme.

If stable mode contains preview `block` or `partial` tags, `liquid-loom doctor` reports a warning.

## Declare preview intent explicitly

When a project is intentionally targeting a Shopify development store with the July 2026 Liquid developer preview enabled, declare that intent:

```ts
import { defineConfig } from "liquid-loom";

export default defineConfig({
  shopifyLiquidMode: "july-2026-preview"
});
```

This setting does **not** enable the Shopify preview for a store. It only tells Liquid Loom which Liquid contract the project intends to target.

The Shopify developer preview still has to be enabled through Shopify's own development-store workflow.

## What Liquid Loom does with the declaration

When the preview mode is declared, Liquid Loom:

- accepts the mode as explicit project metadata;
- detects source files using preview `block` and `partial` tags;
- surfaces preview usage through `liquid-loom doctor`;
- includes preview usage in `liquid-loom explain` and its JSON model;
- keeps normal source ownership, collision detection, migration, and build safety unchanged.

The declaration does not transform Liquid or add a compatibility layer.

## What Liquid Loom does not do

Liquid Loom does not:

- enable Shopify developer previews remotely;
- rewrite stable Liquid into preview syntax;
- scaffold preview syntax as the production default;
- polyfill `block` or `partial` on stores that do not support them;
- guarantee that Shopify will keep preview semantics unchanged before general availability.

## Existing Shopify theme blocks remain first-class

The preview `block` tag is distinct from Shopify theme block files under `blocks/`.

Liquid Loom already treats the stable Shopify `blocks/` output directory as a first-class theme directory. Existing block files, `content_for 'blocks'`, schemas, and Theme Check validation do not require `shopifyLiquidMode: "july-2026-preview"`.

The preview mode is only about syntax and behavior that Shopify currently marks as part of the July 2026 developer preview.

## Promotion to stable

When Shopify promotes these primitives to a stable contract, Liquid Loom should update its stable-mode expectations based on Shopify's final documentation instead of assuming the developer-preview contract survived unchanged.

Until then, preview support stays explicit, observable, and reversible.

## Official Shopify references

- [Developer preview: Liquid block and partial tags](https://shopify.dev/changelog/developer-preview-liquid-block-and-partial-tags)
- [Theme developer preview](https://shopify.dev/docs/storefronts/themes/getting-started/developer-preview)
