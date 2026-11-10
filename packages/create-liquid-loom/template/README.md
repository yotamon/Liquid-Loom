# PROJECT_NAME

A Shopify-native custom storefront built with [Liquid Loom](https://github.com/yotamon/Liquid-Loom).

The starter uses __ASSET_STRATEGY_DESCRIPTION__.

## Build locally

```bash
__INSTALL_COMMAND__
__BUILD_COMMAND__
__DOCTOR_COMMAND__
```

The generated Shopify theme is in `dist/theme`. Local builds do not require a Shopify account.

## Your first edit

Edit `src/theme/sections/home/hero.liquid` and change the hero heading or one of its merchant-editable settings. Rebuild with `__BUILD_COMMAND__`, then check the generated file at `dist/theme/sections/hero.liquid`.

To understand a product feature before changing it, run `__EXPLAIN_COMMAND__` for the machine-readable project model.

## Preview in Shopify

```bash
__DEV_COMMAND__
```

Live preview requires Shopify CLI and access to a Shopify development store. The `dev` command builds, watches source changes, and launches Shopify's native theme preview against `dist/theme`.

Run `__VALIDATE_COMMAND__` before shipping. Avoid editing generated `dist/theme` files directly because your source files own the output.
