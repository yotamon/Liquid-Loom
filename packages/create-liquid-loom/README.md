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

The generated project includes Liquid Loom's source-first theme structure, Vite, Tailwind CSS, Shopify CLI, Theme Check, typed configuration, diagnostics, and a merchant-neutral Online Store 2.0 starter.

Use `--no-install` to generate files without installing dependencies, or `--package-manager npm|pnpm|yarn|bun` to choose the installer.

The target is created through an isolated staging directory and is never merged into a non-empty folder.

Liquid Loom is currently in its early `0.1.x` validation cycle. If you try it on a real theme, [share first-project feedback](https://github.com/yotamon/Liquid-Loom/issues/new?template=early_adopter_feedback.yml), especially anything that feels harder than your existing Shopify workflow.
