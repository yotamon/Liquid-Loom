# Architecture

Liquid Loom has four boundaries: source ownership, build planning, transactional output, and Shopify tooling.

It deliberately does not create a second storefront runtime. Liquid remains Liquid, Shopify CLI remains the preview/deployment tool, and `dist/theme` remains a conventional Shopify theme.

## Core invariants

1. Every deployable Shopify path has exactly one source owner.
2. The complete ownership plan is validated before a new build output is published.
3. Native Shopify source, organized source, and generated assets use the same collision map.
4. Destination comparison is case-insensitive and Unicode NFC-normalized.
5. A failed build cannot replace the last-known-good theme or cache.
6. Build output cannot overlap any managed source directory.
7. Migration is valid only when the Shopify output path is identical before and after the move.
8. The installed CLI resolves all paths from the consuming project, not from the installed package.
9. Shopify's upload minimum is validated from final output ownership, not from one required source layout.
10. Existing-theme adoption is incremental. Vite, Tailwind, performance budgets, and source migration are not mandatory prerequisites.

## Source layers

The public configuration stays intentionally small:

```ts
export default defineConfig({
  shopifySourceDir: ".", // optional native Shopify source
  sourceDir: "src",      // organized Liquid Loom source
  outputDir: "dist/theme",
  viteConfig: false
});
```

Internally this resolves into source layers:

```text
shopify layer
  kind: shopify
  root: shopifySourceDir

loom layer
  kind: organized
  root: sourceDir
```

A normal scaffold has only the organized layer. An adopted theme has both.

The generic source-layer representation remains internal. Liquid Loom does not expose an arbitrary `sources[]` plug-in API just to support this feature.

## Native Shopify discovery

When `shopifySourceDir` is configured, Liquid Loom discovers only Shopify-managed directories:

```text
assets/
blocks/
config/
layout/
locales/
sections/
snippets/
templates/
```

It does not recursively scan the repository root. This is important when `shopifySourceDir: "."` because `node_modules`, `src`, `dist`, documentation, and unrelated application files are excluded by construction.

Native files use identity mapping:

```text
sections/hero.liquid   -> sections/hero.liquid
assets/theme.css       -> assets/theme.css
templates/product.json -> templates/product.json
```

Shopify-supported nesting under `templates/customers/*` and `templates/metaobject/*` is preserved. Unsupported nesting fails instead of being copied blindly.

## Organized source mapping

Organized Liquid Loom source keeps the source-first contract:

```text
src/theme/sections/home/hero.liquid
  -> sections/hero.liquid

src/theme/snippets/product/price.liquid
  -> snippets/price.liquid

src/public/icons/cart.svg
  -> assets/cart.svg
```

Feature folders are authoring organization. Shopify receives its conventional deployable structure.

## Global ownership plan

All discovered source entries are mapped before copying begins:

```text
native Shopify source ----+
                           |
organized source ----------+--> global ownership map --> Shopify paths
generated asset reservations+
```

There is no overlay precedence.

This is a hard error:

```text
sections/hero.liquid
src/theme/sections/home/hero.liquid
```

because both own:

```text
sections/hero.liquid
```

The same rule prevents a static `assets/theme.js` from silently replacing a Vite-generated `assets/theme.js`.

## Platform minimum

Shopify's framework-level upload minimum is:

```text
layout/theme.liquid
```

Liquid Loom validates that the final ownership plan contains that output. The source may therefore be either:

```text
layout/theme.liquid
```

or:

```text
src/theme/layout/theme.liquid
```

The reference storefront includes more files because its features need them. Those files are not promoted into invented platform requirements.

## Build transaction

```text
CLI
 |
 +--> resolve config and source layers
 |
 +--> acquire recoverable project lock
 |
 +--> create isolated staging output/cache
 |
 +--> discover managed source entries
 |
 +--> map complete ownership plan
 |      - path traversal guard
 |      - Shopify nesting validation
 |      - case-insensitive collision guard
 |      - Unicode-normalized collision guard
 |      - generated-output reservation guard
 |
 +--> validate Shopify upload minimum
 |
 +--> copy/cache static source into staging
 |
 +--> optionally run Vite into staging
 |
 +--> optionally validate performance budgets
 |
 +--> atomically promote staged output + cache
 |
 +--> release lock
```

Incremental builds seed staging from the prior successful output. Clean builds begin from empty staging. Mapping, bundling, budget, or promotion failures leave the previous output intact.

## Optional bundling

Fresh Liquid Loom projects use the bundled Vite/Tailwind workflow by default.

Existing-theme initialization writes:

```js
viteConfig: false,
performance: false
```

This means:

- native `assets/*` remain passthrough source;
- `src/public/*` can add passthrough assets;
- no Vite process runs;
- no Vite-generated filenames are reserved;
- existing build tooling can keep running independently.

Enabling Vite later is an explicit configuration change and must pass the same global ownership checks.

## Cache model

Single-source `0.1.x` projects remain compatible with manifest version 1 semantics.

Hybrid builds use source-layer-aware manifest keys, for example:

```text
shopify:sections/hero.liquid
loom:theme/sections/home/hero.liquid
```

Each manifest entry records:

- SHA-256 content hash;
- source layer;
- source path;
- Shopify output path;
- byte size.

Stale cleanup is output-aware. If ownership moves from a native path to organized source while the Shopify output stays `sections/hero.liquid`, the output is not deleted merely because the old source key disappeared.

## Migration invariant

Migration is an ownership transfer, not a Shopify rename.

```text
before
sections/hero.liquid
  -> sections/hero.liquid

after
src/theme/sections/home/hero.liquid
  -> sections/hero.liquid
```

Liquid Loom computes both mappings before moving anything. If the destination changes the deployable Shopify path, the migration is rejected.

This is why migration does not need to rewrite Liquid references, JSON templates, snippet calls, or section types.

### Transactional migration

Migration plans are preview-only by default. Applied migrations move each file only after the full future ownership plan has passed validation.

If a later filesystem move fails, completed moves are rolled back in reverse order. If rollback itself fails, Liquid Loom raises an aggregate blocking error instead of claiming success.

## Existing-theme initialization

`liquid-loom init` is a separate mutation transaction from the build pipeline.

It:

1. verifies `layout/theme.liquid` at the selected native root;
2. detects the package manager deterministically;
3. computes package/config/ignore mutations;
4. refuses conflicting `loom:*` scripts or an existing Liquid Loom config;
5. writes the setup transaction;
6. creates organized source directories;
7. optionally installs dependencies.

Existing Shopify source files are never moved by `init`.

Initialization captures changed text files and package-manager lockfiles so a failed setup/install can restore the pre-init state as far as the filesystem permits.

## Watch model

Watch mode observes:

- the organized source root;
- only native Shopify-managed directories that exist;
- the Liquid Loom config;
- the Vite config only when bundling is enabled.

It never watches an entire repository solely because the native theme root is `.`.

## Output safety

`dist/theme` may sit beside a root-level Shopify theme:

```text
layout/
sections/
assets/
src/
dist/theme/
```

but output may not:

- equal the project root;
- escape the project;
- overlap `sourceDir`;
- overlap any managed native Shopify directory.

Clean operations use the same safety checks.

## Public API boundary

The root package publishes:

- config helpers;
- mapping/planning helpers;
- source discovery;
- build APIs;
- diagnostics;
- existing-theme detection/init/migration helpers.

The CLI remains the preferred product interface. Programmatic APIs are kept explicit and small rather than exposing internal transaction machinery.

## Packages and release validation

- `liquid-loom` publishes the framework and CLI.
- `create-liquid-loom` publishes the fresh-project scaffolder.
- the embedded starter is guarded against reference-source drift;
- CI packs the actual npm tarballs and installs them in independent temporary projects;
- package smoke validates both a fresh scaffold and an existing-theme init/build/migrate/build flow;
- releases use npm Trusted Publishing with GitHub OIDC and provenance.

## Extension strategy

The `0.2` architecture solves an observed adoption problem without opening a broad plug-in surface.

A future extension point should still require:

1. a concrete Shopify use case;
2. explicit ownership/mapping semantics;
3. transactional failure behavior;
4. published-package tests;
5. repeated consumer evidence when it broadens the public API.

Store-specific behavior belongs in the consuming theme, not in framework core.
