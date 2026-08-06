# Recipes

## Add a static asset

Place a file anywhere under `src/public/`. Its basename becomes the Shopify asset name:

```text
src/public/icons/cart.svg → dist/theme/assets/cart.svg
```

Basenames must be unique across the entire public tree and cannot be `theme.js` or `style.css` unless generated-output configuration changes with matching Vite output.

## Add a section or snippet

Organize by feature; Shopify’s destination remains flat:

```text
src/theme/sections/editorial/story.liquid → dist/theme/sections/story.liquid
```

Run `pnpm build` immediately after adding the file. Portable collisions fail before the output changes.

## Add another Vite entrypoint

Extend `rollupOptions.input` and give its output a stable name in `vite.config.js`. Add that output to `reservedOutputs` in `liquid-loom.config.ts` so a public asset cannot overwrite it.

## Scan for organization-specific terms

```ts
export default defineConfig({
	forbiddenTerms: ["internal-brand", "private-hostname"]
});
```

`pnpm doctor` and `pnpm public-ready` inspect text content and filenames while ignoring Git internals, dependencies, caches, coverage, and generated output. Avoid secrets in configuration; list only non-secret identifying terms.

## Tune performance budgets

Start with measured production output, then leave enough headroom for normal product work:

```ts
performance: {
  maxBuildMs: 10_000,
  maxThemeBytes: 5_000_000,
  maxAssetBytes: 500_000,
}
```

A budget failure occurs inside staging, so the previous build remains deployable.

## Use a different source or output directory

```ts
export default defineConfig({
	sourceDir: "storefront",
	outputDir: "build/shopify",
	cacheFile: ".cache/liquid-loom.json"
});
```

Output must remain inside the project and outside the source directory.
