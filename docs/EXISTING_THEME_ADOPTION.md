# Existing-theme adoption

Status: implemented for `0.2.0`

Liquid Loom can be added to an existing Shopify theme without restructuring the theme first. Native Shopify source and organized Liquid Loom source can coexist in one build, and migration into `src` is optional and incremental.

The core rule is simple: every deployable Shopify path has exactly one source owner. Liquid Loom never silently chooses one source over another.

## The adoption model

```text
Existing Shopify source                 New Liquid Loom source

assets/                                 src/public/
blocks/                                 src/theme/blocks/
config/                                 src/theme/config/
layout/                                 src/theme/layout/
locales/                                src/theme/locales/
sections/                               src/theme/sections/<feature>/
snippets/                               src/theme/snippets/<feature>/
templates/                              src/theme/templates/<feature>/
       \                                      /
        +---------- ownership plan ----------+
                        |
                        v
                   dist/theme
                        |
                        v
                   Shopify CLI
```

You can therefore:

1. keep the current Shopify theme exactly where it is;
2. add Liquid Loom without moving an existing theme file;
3. write only new work under `src`;
4. migrate one file or directory when it becomes useful;
5. migrate the whole theme later, or never migrate it at all.

## Add Liquid Loom to an existing theme

From the Shopify theme root:

```bash
npx liquid-loom@latest init
```

or:

```bash
pnpm dlx liquid-loom@latest init
```

`init` detects `layout/theme.liquid`, prints the complete mutation plan, and asks for confirmation before writing anything.

For automation:

```bash
npx liquid-loom@latest init --yes
```

Preview without changing files:

```bash
npx liquid-loom@latest init --dry-run
```

If the Shopify theme is inside a larger repository:

```bash
npx liquid-loom@latest init --theme-dir theme
```

Package-manager override:

```bash
npx liquid-loom@latest init --package-manager pnpm
```

Skip dependency installation:

```bash
npx liquid-loom@latest init --no-install --yes
```

### What `init` changes

`init` is deliberately non-invasive. It:

- creates `liquid-loom.config.mjs`;
- adds `liquid-loom` as a development dependency when it is not already installed;
- adds namespaced scripts such as `loom:build`, `loom:watch`, `loom:dev`, and `loom:doctor`;
- adds `dist/` and `.cache/` to `.gitignore` when needed;
- creates the organized `src` directories;
- keeps the existing Shopify theme files in place.

It refuses to overwrite an existing Liquid Loom config or a conflicting `loom:*` script.

Existing-theme initialization defaults to:

```js
import { defineConfig } from "liquid-loom";

export default defineConfig({
	shopifySourceDir: ".",
	sourceDir: "src",
	outputDir: "dist/theme",
	viteConfig: false,
	performance: false
});
```

That keeps the existing asset workflow and avoids imposing starter-specific performance budgets during initial adoption. Both can be enabled later.

## Use Liquid Loom without migrating anything

After `init`, existing source remains valid:

```text
sections/header.liquid
sections/product-main.liquid
snippets/price.liquid
assets/theme.css
```

New code can immediately use the organized source model:

```text
src/theme/sections/product/upsell.liquid
src/theme/snippets/product/upsell-price.liquid
```

Run:

```bash
npm run loom:build
```

or the equivalent script through your package manager.

The build combines both source layers into:

```text
dist/theme/sections/header.liquid
dist/theme/sections/product-main.liquid
dist/theme/sections/upsell.liquid
dist/theme/snippets/price.liquid
dist/theme/snippets/upsell-price.liquid
dist/theme/assets/theme.css
```

## Ownership and collisions

There is no precedence between native and organized source.

This is invalid:

```text
sections/hero.liquid
src/theme/sections/home/hero.liquid
```

Both map to:

```text
sections/hero.liquid
```

The build fails before publishing a new output. The previous successful `dist/theme` remains untouched.

The same global ownership plan includes generated asset reservations when Vite is enabled, so native, organized, and generated files cannot silently overwrite one another.

## Incremental migration

Migration is preview-only unless `--apply` is supplied.

Preview one file:

```bash
liquid-loom migrate sections/hero.liquid
```

Apply it:

```bash
liquid-loom migrate sections/hero.liquid --apply
```

Default result:

```text
sections/hero.liquid
  -> src/theme/sections/hero.liquid
```

The deployable path remains:

```text
sections/hero.liquid
```

### Organize while migrating

A single file can be moved directly into a feature folder:

```bash
liquid-loom migrate sections/hero.liquid \
  --to theme/sections/home/hero.liquid \
  --apply
```

`src/` may also be included explicitly:

```bash
liquid-loom migrate sections/hero.liquid \
  --to src/theme/sections/home/hero.liquid \
  --apply
```

Liquid Loom proves that the native and organized paths produce the same Shopify output before moving the file. If the output identity changes, migration is refused.

### Migrate a directory

```bash
liquid-loom migrate sections
liquid-loom migrate sections --apply
```

Directory migration uses direct organized equivalents. It does not invent feature taxonomy.

### Migrate all remaining native source

```bash
liquid-loom migrate --all
liquid-loom migrate --all --apply
```

Default mappings are:

```text
assets/*       -> src/public/*
blocks/*       -> src/theme/blocks/*
config/*       -> src/theme/config/*
layout/*       -> src/theme/layout/*
locales/*      -> src/theme/locales/*
sections/*     -> src/theme/sections/*
snippets/*     -> src/theme/snippets/*
templates/*    -> src/theme/templates/*
```

Migration is transactional. If a move fails after earlier moves have completed, Liquid Loom attempts to restore the already moved files. An incomplete rollback is surfaced as a blocking error rather than hidden.

## Asset workflow

Existing themes often already use their own Sass, PostCSS, Webpack, Vite, or other asset process. Liquid Loom does not replace that during `init`.

With:

```js
viteConfig: false;
```

behavior is:

- native `assets/*` pass through unchanged;
- `src/public/*` can add new passthrough assets;
- Vite does not run;
- generated Vite filenames are not reserved;
- `src/entrypoints` triggers a `doctor` warning because those files are not compiled.

To adopt Liquid Loom's Vite/Tailwind workflow later, configure a Vite file explicitly and resolve any asset ownership collisions first.

## Watch and Shopify development

Hybrid watch mode observes:

- the organized source root;
- only existing Shopify-managed directories under `shopifySourceDir`;
- the Liquid Loom config;
- the Vite config only when Vite is enabled.

It never recursively watches an entire repository just because `shopifySourceDir` is `.`.

`liquid-loom dev` keeps the normal deployment flow:

```text
native source + organized source
        -> Liquid Loom build
        -> dist/theme
        -> shopify theme dev
```

## Safety guarantees

Existing-theme adoption keeps the framework's existing safety model:

- no silent source precedence;
- case-insensitive and Unicode-normalized destination collision checks;
- build output cannot overlap organized or native managed source;
- static and generated assets cannot own the same output;
- failed builds preserve the last-known-good theme output;
- build and cache promotion remain transactional;
- migration preserves Shopify output identity;
- migration is preview-first and rollback-aware;
- cache manifests track source-layer identity so migration does not delete unchanged Shopify output as stale.

## Monorepos

Use a project-relative native theme root:

```js
export default defineConfig({
	shopifySourceDir: "theme",
	sourceDir: "src",
	outputDir: "dist/theme",
	viteConfig: false
});
```

Or initialize it directly:

```bash
liquid-loom init --theme-dir theme
```

## What Liquid Loom intentionally does not do

Migration does not rewrite:

- Liquid references;
- JSON template section types;
- snippet references;
- asset URLs;
- Shopify schema;
- feature-folder names.

Because safe migration preserves the final Shopify path, those rewrites should not be necessary.

The goal is incremental adoption, not a second Shopify runtime.
