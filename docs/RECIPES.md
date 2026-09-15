# Recipes

## Add a static asset

Place a file anywhere under `src/public/`. Its basename becomes the Shopify asset name:

```text
src/public/icons/cart.svg → dist/theme/assets/cart.svg
```

Basenames must be unique across the entire public tree. When Vite is enabled, static assets also cannot collide with any configured generated output.

## Add component CSS or JavaScript

Fresh Liquid Loom projects prefer Shopify-native component assets:

```liquid
{% stylesheet %}
.product-card { display: grid; }
{% endstylesheet %}

{% javascript %}
customElements.define("product-card", class extends HTMLElement {});
{% endjavascript %}
```

Keep truly global styles in a static file such as `src/public/theme.css`. Liquid doesn't render inside `{% stylesheet %}` or `{% javascript %}` tags, so pass dynamic values through markup, data attributes, or CSS custom properties.

## Add a section, block, or snippet

Organize by feature; Shopify's destination remains flat:

```text
src/theme/sections/editorial/story.liquid → dist/theme/sections/story.liquid
src/theme/blocks/product/title.liquid → dist/theme/blocks/title.liquid
```

Run `pnpm build` immediately after adding the file. Portable collisions fail before the output changes.

## Opt into Vite or Tailwind

The fresh starter uses Shopify-native assets by default, but the framework still supports Vite and Tailwind. Add a Vite config and enable it explicitly:

```ts
export default defineConfig({
	viteConfig: "vite.config.js",
	reservedOutputs: ["assets/theme.js", "assets/style.css"]
});
```

Install the asset tooling your project needs and configure stable output names. Generated outputs participate in the same ownership/collision plan as authored Shopify assets.

## Deploy compiled output through Shopify GitHub integration

If your source repository contains `src`, tests, and build tooling, connect Shopify to a generated branch or separate deployment repository that contains only canonical Shopify theme directories. See [GitHub deployment](GITHUB_DEPLOYMENT.md).

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
