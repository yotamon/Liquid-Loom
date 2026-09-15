<p align="center">
  <img src="docs/liquid-loom.svg" alt="Liquid Loom" width="760">
</p>

<p align="center"><strong>A deterministic engineering layer for Shopify Liquid themes, from legacy adoption to agent-readable architecture.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/liquid-loom"><img alt="npm version" src="https://img.shields.io/npm/v/liquid-loom?logo=npm"></a>
  <a href="https://www.npmjs.com/package/liquid-loom"><img alt="npm downloads" src="https://img.shields.io/npm/dm/liquid-loom?logo=npm"></a>
  <a href="https://github.com/yotamon/Liquid-Loom/releases/latest"><img alt="GitHub release" src="https://img.shields.io/github/v/release/yotamon/Liquid-Loom"></a>
  <a href="https://github.com/yotamon/Liquid-Loom/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/yotamon/Liquid-Loom/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Node 22 and 24" src="https://img.shields.io/badge/Node-22%20%7C%2024-339933?logo=nodedotjs&logoColor=white">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-4DE3C1"></a>
</p>

Liquid Loom gives Shopify theme development a safer, source-first engineering layer while keeping Shopify's runtime completely standard.

Use it to organize theme code by feature, adopt better tooling inside an existing client theme without a rewrite, migrate source gradually, inspect project ownership before a developer or coding agent edits it, and still ship a conventional Shopify theme through Shopify CLI.

Liquid Loom does **not** replace Liquid, Online Store 2.0, Shopify CLI, the Theme Editor, or Shopify's storefront runtime.

## Start with the theme you already have

From an existing Shopify theme containing `layout/theme.liquid`:

```bash
npx liquid-loom@latest init
```

Liquid Loom shows the complete setup plan before writing anything. Existing Shopify source is not moved.

You can keep the theme exactly as it is:

```text
assets/
layout/
sections/
snippets/
templates/
```

and put only new work into organized source when that helps:

```text
src/theme/sections/product/upsell.liquid
src/theme/snippets/product/upsell-price.liquid
```

Both source layers become one normal deployable theme:

```text
existing Shopify source ----+
                             |
organized Liquid Loom source +--> ownership plan --> dist/theme --> Shopify CLI
```

Build with the namespaced script added by `init`:

```bash
npm run loom:build
```

`init` detects npm, pnpm, Yarn, or Bun and supports `--package-manager`, `--no-install`, `--dry-run`, `--theme-dir`, and `--yes`.

Read [Existing-theme adoption](docs/EXISTING_THEME_ADOPTION.md) for the full zero-migration workflow.

## Or start a new theme

```bash
corepack enable
pnpm create liquid-loom@latest my-storefront
cd my-storefront
pnpm build
pnpm dev
```

A fresh project uses Shopify-native component CSS and JavaScript by default. Vite and Tailwind remain supported integrations when a project actually needs bundling, module graphs, or utility-first CSS.

## Why Liquid Loom

Liquid Loom targets the engineering problems that become painful as custom themes, teams, and coding agents grow:

- **Adopt incrementally.** Existing themes do not need an up-front rewrite.
- **Feature-oriented source.** Organize authored Liquid by feature without inventing a new runtime.
- **Dual-source builds.** Native Shopify source and organized Liquid Loom source can coexist safely.
- **One output, one owner.** No silent overlay or last-write-wins behavior.
- **Transactional builds.** Failed builds never replace the last-known-good theme.
- **Safe migration.** Preview ownership transfers before moving source and preserve Shopify output identity.
- **Project intelligence.** `explain` turns ownership and provable static relationships into deterministic human- and machine-readable data.
- **Shopify-native defaults.** Theme blocks, app blocks, component asset tags, color palettes, customer accounts, and standard storefront interoperability stay visible as Shopify concepts.
- **Optional advanced assets.** Vite and Tailwind remain available without defining the framework's architecture.
- **Portable behavior.** Destination collisions are case-insensitive and Unicode-normalized across filesystems.
- **Useful diagnostics.** `doctor`, `check`, `analyze`, Theme Check, and performance budgets make failures explainable.
- **Standard output.** `dist/theme` remains inspectable, pushable, and debuggable with Shopify's own tools.

## Shopify-native fresh-project architecture

The reference storefront now demonstrates Shopify's 2026-native theme model instead of loading one application bundle for ordinary theme behavior.

A fresh source tree can look like:

```text
src/
├── public/
│   └── theme.css
└── theme/
    ├── blocks/
    │   ├── product-title.liquid
    │   ├── product-price.liquid
    │   └── product-purchase.liquid
    ├── sections/
    │   ├── products/main-product.liquid
    │   └── global/header.liquid
    ├── snippets/
    ├── templates/
    └── layout/theme.liquid
```

Component-local behavior lives with the Liquid component when practical:

```liquid
{% stylesheet %}
.product-purchase { ... }
{% endstylesheet %}

{% javascript %}
customElements.define(...)
{% endjavascript %}
```

Shopify can then process component assets through its own render-aware pipeline. Global CSS is reserved for genuinely global concerns such as base styles, design tokens, accessibility defaults, and shared layout primitives.

The output stays conventional:

```text
dist/theme/
├── assets/theme.css
├── blocks/product-title.liquid
├── blocks/product-price.liquid
├── blocks/product-purchase.liquid
├── sections/main-product.liquid
├── snippets/
├── templates/product.json
└── layout/theme.liquid
```

## Theme-block-first composition

The reference product page is composed from Shopify theme blocks rather than hard-coding all product information into one monolithic section.

```text
Main product
├── Product media
└── Merchant-reorderable blocks
    ├── Vendor
    ├── Title
    ├── Price
    ├── Purchase controls
    ├── Description
    ├── @theme
    └── @app
```

This keeps customization inside Shopify's Theme Editor and makes the structure understandable to merchants, developers, apps, and coding agents without adding a Liquid Loom component runtime.

## Storefront interoperability

The reference storefront adopts Shopify's standard storefront events and actions where the theme owns the interaction.

Examples include:

- standardized product, collection, recommendation, and cart view events through `s-view-event` and `standard_event_data`;
- cart mutation through `Shopify.actions.updateCart()` with the native product form retained as the no-JavaScript fallback;
- merchant-configurable `<shopify-account>` integration in the header;
- `color_palette` as the source for semantic CSS design tokens.

The goal is interoperability with Shopify, apps, and agents, not a Liquid Loom-specific browser protocol.

## Understand the theme before editing it

Liquid Loom can describe the project without evaluating Liquid or requiring a build first:

```bash
liquid-loom explain
liquid-loom explain product
```

Coding agents and CI can request deterministic JSON:

```bash
liquid-loom explain --json
liquid-loom explain product --json
```

The model reports source ownership, semantic feature groups, static snippet/section/block/asset relationships, JSON-template section references, preview partial regions, preview-tag usage, and unresolved static references.

It intentionally does not guess dynamic Liquid relationships. Read [Project model](docs/PROJECT_MODEL.md) for the complete contract.

## One output, one owner

There is intentionally no "new source wins" rule.

This is invalid:

```text
sections/hero.liquid
src/theme/sections/home/hero.liquid
```

because both map to:

```text
sections/hero.liquid
```

Liquid Loom plans the complete ownership map before publishing a build and reports the conflicting owners instead of silently overwriting one of them.

Generated Vite outputs participate in the same ownership map when Vite is enabled.

## Migrate only when it helps

Preview a migration:

```bash
liquid-loom migrate sections/hero.liquid
```

Apply it:

```bash
liquid-loom migrate sections/hero.liquid --apply
```

Organize it while preserving its Shopify identity:

```bash
liquid-loom migrate sections/hero.liquid \
  --to theme/sections/home/hero.liquid \
  --apply
```

The deployable path must remain `sections/hero.liquid`. Liquid Loom rejects a migration that would silently rename Shopify output.

Bulk migration remains optional:

```bash
liquid-loom migrate sections --apply
liquid-loom migrate --all
liquid-loom migrate --all --apply
```

Liquid Loom never invents a feature taxonomy for existing source.

## Asset strategies

### Shopify-native default

Fresh projects default to `viteConfig: false` and use static global assets plus `{% stylesheet %}` / `{% javascript %}` for component-local code.

### Existing pipeline

An adopted theme can keep Sass, PostCSS, Webpack, Vite, Tailwind, or another existing pipeline unchanged. Native `assets/*` pass through as Shopify assets.

### Optional Vite and Tailwind

Projects that need bundling can explicitly enable Vite and reserve stable generated Shopify asset names. Tailwind remains available through the native Tailwind Vite plugin.

The framework still validates static and generated outputs in one collision map.

See [Recipes](docs/RECIPES.md) for setup examples.

## Shopify GitHub deployment

A Liquid Loom source branch contains development files that Shopify's GitHub theme integration does not treat as the deployable theme root.

For GitHub-connected themes, use a generated `shopify-production` branch or a separate deployment repository containing only the canonical Shopify theme directories:

```text
main
  |
  | validate + build
  v
shopify-production
  |
  v
Shopify GitHub integration
```

The repository includes an opt-in deployment recipe that publishes compiled output without force-pushing and avoids deployment loops from Shopify-originated commits.

Read [Shopify GitHub deployment](docs/GITHUB_DEPLOYMENT.md).

## Shopify Liquid preview mode

Shopify's July 2026 `{% block %}` / `{% partial %}` developer preview is never enabled implicitly.

Projects intentionally targeting it can declare:

```ts
export default defineConfig({
	shopifyLiquidMode: "july-2026-preview"
});
```

This records project intent for diagnostics and project intelligence. It does not enable the preview on a Shopify store.

Read [Shopify Liquid July 2026 developer preview](docs/LIQUID_JULY_2026_PREVIEW.md).

## Build guarantees

Liquid Loom keeps the existing engineering guarantees regardless of asset strategy:

1. discover all managed source;
2. map the complete Shopify ownership plan;
3. validate paths, collisions, and Shopify's upload minimum;
4. build in isolated staging;
5. optionally run Vite and performance budgets;
6. atomically promote output and cache together.

A failed build leaves the previous deployable output intact. Independent CLI processes serialize through a recoverable project lock.

## Commands

| Command                        | Purpose                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `liquid-loom init`             | Add Liquid Loom to an existing Shopify theme without moving source |
| `liquid-loom migrate [target]` | Preview or apply output-preserving source migration                |
| `liquid-loom build`            | Build the merged deployable Shopify theme                          |
| `liquid-loom build --clean`    | Build from empty staging                                           |
| `liquid-loom watch`            | Rebuild when managed source changes                                |
| `liquid-loom dev`              | Build, watch, and launch `shopify theme dev`                       |
| `liquid-loom explain [target]` | Explain ownership and static theme relationships                   |
| `liquid-loom doctor`           | Diagnose runtime, ownership, config, safety, assets, and privacy   |
| `liquid-loom check`            | Validate ownership, source JSON, and build output                  |
| `liquid-loom analyze`          | Report output composition and largest files                        |
| `liquid-loom clean`            | Remove generated output and cache safely                           |

Scaffolded projects expose package-manager scripts for the same commands. Existing-theme `init` uses namespaced `loom:*` scripts so it does not replace a project's existing `build` or `dev` commands.

## Reference storefront

The fresh-project scaffold is a merchant-neutral reference theme that demonstrates:

- Shopify theme blocks and app blocks;
- merchant-reorderable product information and purchase controls;
- Shopify-native component CSS and JavaScript;
- standard storefront view events and cart actions;
- `color_palette` design tokens;
- `<shopify-account>` customer-account integration;
- JSON templates and editable header/footer section groups;
- storefront filtering and predictive search;
- variant URL state, selling plans, quantities, and progressive enhancement;
- responsive images, semantic navigation, skip links, visible focus states, reduced-motion support, and no-JavaScript fallbacks.

It is a reference implementation. The product is Liquid Loom's engineering layer and workflow.

## Who it is for

Liquid Loom is a good fit when you:

- maintain a custom or client Shopify theme and want stronger tooling without rewriting it;
- want new theme work organized by feature rather than only by Shopify's flat directories;
- need deterministic ownership and collision behavior;
- want coding agents to inspect a conservative architectural model before editing source;
- want Shopify-native theme capabilities without giving up modern engineering guarantees.

It is probably not the right starting point when:

- the theme is tiny and needs no build pipeline;
- you are building a headless storefront rather than a Shopify Liquid theme;
- your primary goal is Shopify Theme Store submission, where Shopify's official starting points and policies remain authoritative.

## Validation

Protected CI validates:

- unit and integration tests with coverage thresholds;
- transactional clean builds;
- zero-offense Shopify Theme Check;
- Linux/Node 22, Windows/Node 24, and macOS/Node 24 portability;
- packed-package installation and fresh-scaffold smoke tests;
- Dependency Review and CodeQL;
- a non-blocking Node 26 canary.

Real-store validation remains separate from public CI so contributors do not need Shopify credentials.

## Documentation

- [Shopify 2026 platform modernization](docs/SHOPIFY_2026_MODERNIZATION.md) - architecture decisions and acceptance criteria
- [Existing-theme adoption](docs/EXISTING_THEME_ADOPTION.md) - zero-migration setup, hybrid source, and safe migration
- [Project model](docs/PROJECT_MODEL.md) - deterministic architecture queries for developers, agents, and CI
- [Shopify Liquid July 2026 developer preview](docs/LIQUID_JULY_2026_PREVIEW.md) - explicit preview-mode contract and safety boundaries
- [Shopify GitHub deployment](docs/GITHUB_DEPLOYMENT.md) - compiled deployment branches and write-back constraints
- [First project](docs/FIRST_PROJECT.md) - short evaluation from public install to a real source edit
- [Architecture](docs/ARCHITECTURE.md) - ownership, transactions, cache, and migration invariants
- [Validation](docs/VALIDATION.md) - real-user and real-store validation plan
- [Recipes](docs/RECIPES.md) - native assets, optional bundling, private-term policies, and budgets
- [Troubleshooting](docs/TROUBLESHOOTING.md) - collisions, locks, Shopify CLI, and build failures
- [Benchmarks](docs/BENCHMARKS.md) - reproducible build measurements
- [Releasing](docs/RELEASING.md) - provenance-backed npm release process
- [Contributing](CONTRIBUTING.md) - development and pull-request expectations
- [Security](SECURITY.md) - private vulnerability reporting

## Design principles

- Adopt tooling before forcing migration.
- Source ownership must be explicit.
- Shopify's runtime contract stays visible.
- Prefer Shopify primitives over competing abstractions.
- Generated output is disposable; authored source is the product.
- Prefer provable project intelligence over guessed relationships.
- Fail early, explain specifically, and preserve the last-known-good build.
- Treat Vite and Tailwind as replaceable integrations, not the framework's durable moat.
- Keep preview APIs explicit until Shopify stabilizes them.
- Add framework surface only after real users demonstrate the need.

<p align="center">
  <img src="docs/brand-board.png" alt="Liquid Loom identity board" width="960">
</p>

## License

MIT © 2026 Liquid Loom contributors.
