# create-liquid-loom

Create a modern custom Shopify theme project powered by [Liquid Loom](https://github.com/yotamon/Liquid-Loom).

```bash
corepack enable
pnpm create liquid-loom@latest my-storefront
cd my-storefront
pnpm build
```

When you are ready to preview against a Shopify development store:

```bash
pnpm dev
```

The generated project includes Liquid Loom's source-first theme structure, Shopify CLI, Theme Check, typed configuration, diagnostics, and a merchant-neutral Online Store 2.0 starter. By default it uses Shopify-native component CSS/JavaScript **without Vite or Tailwind dependencies**. Add optional bundling through `--preset vite` or `--preset vite-tailwind`; both generate ready-to-build entrypoints and a correctly referenced Vite asset bundle.

Use `--no-install` to generate files without installing dependencies, `--package-manager npm|pnpm|yarn|bun` to choose the installer, or `--preset native|vite|vite-tailwind` to select the asset strategy. Native is the default. These options require a source version containing the preset implementation; see the root README for the difference between the npm `@latest` release and unreleased `main`.

The target is created through an isolated staging directory and is never merged into a non-empty folder.

Liquid Loom is in pre-1.0 validation; the published npm version can lag behind the repository source. If you try it on a real theme, [share first-project feedback](https://github.com/yotamon/Liquid-Loom/issues/new?template=early_adopter_feedback.yml), especially anything that feels harder than your existing Shopify workflow.
