<p align="center">
  <img src="docs/liquid-loom.svg" alt="Liquid Loom" width="760">
</p>

<p align="center"><strong>A modern, source-first workflow for custom Shopify themes.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/liquid-loom"><img alt="npm version" src="https://img.shields.io/npm/v/liquid-loom?logo=npm"></a>
  <a href="https://www.npmjs.com/package/liquid-loom"><img alt="npm downloads" src="https://img.shields.io/npm/dm/liquid-loom?logo=npm"></a>
  <a href="https://github.com/yotamon/Liquid-Loom/releases/latest"><img alt="GitHub release" src="https://img.shields.io/github/v/release/yotamon/Liquid-Loom"></a>
  <a href="https://github.com/yotamon/Liquid-Loom/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/yotamon/Liquid-Loom/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Node 22 and 24" src="https://img.shields.io/badge/Node-22%20%7C%2024-339933?logo=nodedotjs&logoColor=white">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-4DE3C1"></a>
</p>

Liquid Loom lets Shopify theme developers organize source code like a modern application, bundle assets with Vite and Tailwind CSS, and still ship the standard theme structure Shopify expects.

It does **not** replace Liquid, Online Store 2.0, or Shopify CLI. It gives them a safer authoring and build layer.

## Try it

Create a theme and get a clean production build locally:

```bash
corepack enable
pnpm create liquid-loom@latest my-storefront
cd my-storefront
pnpm build
```

Then preview it against a Shopify development store:

```bash
pnpm dev
```

`pnpm build`, `pnpm doctor`, tests, diagnostics, and Theme Check work locally. A Shopify store is only required for the live preview started by `pnpm dev`.

Want another package manager? The scaffolder supports `--package-manager npm|pnpm|yarn|bun` and `--no-install`.

> **Building a real custom theme?** Liquid Loom is in its early `0.1.x` validation cycle and we are actively looking for Shopify developers to try one real edit/build/preview loop. [Run the 10-minute first-project test](docs/FIRST_PROJECT.md), then [tell us what felt confusing, slower, or worse](https://github.com/yotamon/Liquid-Loom/issues/new?template=early_adopter_feedback.yml). Questions and architecture ideas are welcome in [Discussions](https://github.com/yotamon/Liquid-Loom/discussions).

## What changes

You author by feature:

```text
src/theme/sections/home/hero.liquid
src/theme/sections/product/recommendations.liquid
src/theme/snippets/product/price.liquid
src/entrypoints/theme.js
src/styles/theme.css
```

Liquid Loom validates the complete build plan, bundles assets, and produces a normal Shopify theme:

```text
                         Liquid Loom
                              |
                              v

dist/theme/sections/hero.liquid
dist/theme/sections/recommendations.liquid
dist/theme/snippets/price.liquid
dist/theme/assets/theme.js
dist/theme/assets/theme.css
```

Shopify still receives the flat, conventional structure it understands. Your source tree does not have to be organized that way.

## Why use it

Liquid Loom is designed for the parts of custom theme development that become painful as a project grows:

- **Feature-oriented source** without inventing a new Shopify runtime.
- **Vite + Tailwind CSS** in the default workflow.
- **No silent overwrites.** Destination collisions are detected before files are published.
- **Last-known-good builds.** A failed bundle does not replace the previous working theme output.
- **Portable behavior.** Collision checks are case-insensitive and Unicode-normalized across filesystems.
- **Useful diagnostics.** `doctor`, `check`, `analyze`, Theme Check, and performance budgets are built into the project workflow.
- **A real starter.** The scaffolder includes Online Store 2.0 patterns, progressive enhancement, accessibility defaults, search, filtering, variants, selling plans, and theme blocks.
- **Standard output.** The result remains a Shopify theme that can be inspected, pushed, and debugged with Shopify's own tools.

## Who it is for

Liquid Loom is a good fit when you build custom or client Shopify themes and the native flat repository structure has become difficult to navigate or standardize across a team.

It is especially useful if you already expect modern frontend tooling, deterministic builds, and repeatable CI from the rest of your stack.

It is probably **not** the right starting point if:

- you only need a small theme with no custom build pipeline;
- your goal is Shopify Theme Store submission, where Shopify's official [Skeleton Theme](https://github.com/Shopify/skeleton-theme) should be your starting point;
- you are building a headless storefront rather than a Shopify Liquid theme.

## Liquid Loom and Shopify CLI

Shopify CLI remains the tool that talks to Shopify. Liquid Loom sits before it:

```text
author source -> validate -> build -> dist/theme -> Shopify CLI -> development store
```

`pnpm dev` builds the deployable theme, watches your source, and launches `shopify theme dev` against `dist/theme`.

There is no proprietary runtime and no special deployment format to keep alive.

## Source contract

Shopify themes use a constrained directory structure. Liquid Loom lets authoring paths be nested for organization, then maps them to portable Shopify output before writing anything.

| Authoring path                                  | Deployable path                        | Rule                                |
| ----------------------------------------------- | -------------------------------------- | ----------------------------------- |
| `src/theme/sections/home/hero.liquid`           | `sections/hero.liquid`                 | Flatten by filename                 |
| `src/theme/snippets/product/price.liquid`       | `snippets/price.liquid`                | Flatten by filename                 |
| `src/theme/config/editor/settings_schema.json`  | `config/settings_schema.json`          | Flatten by filename                 |
| `src/theme/locales/markets/en.default.json`     | `locales/en.default.json`              | Flatten by filename                 |
| `src/theme/templates/catalog/product.json`      | `templates/product.json`               | Feature folders flatten by filename |
| `src/theme/templates/customers/account.json`    | `templates/customers/account.json`     | Preserve Shopify-supported nesting  |
| `src/theme/templates/metaobject/book.json`      | `templates/metaobject/book.json`       | Preserve Shopify-supported nesting  |
| `src/public/icons/cart.svg`                     | `assets/cart.svg`                      | Flatten into assets                 |
| `src/entrypoints/theme.js` + `src/styles/*.css` | `assets/theme.js` + `assets/style.css` | Vite owns generated bundle outputs  |

Liquid Loom validates Shopify's current upload minimum at framework level: `layout/theme.liquid`. Starter files such as `config/settings_schema.json` and `templates/index.json` are useful defaults, not invented platform requirements.

For Shopify's canonical directory rules, see the official [theme architecture documentation](https://shopify.dev/docs/storefronts/themes/architecture).

## Build guarantees

### No silent overwrites

The complete source-to-output plan is validated before files are published. If two source files would become the same Shopify destination, the build stops with the colliding paths instead of choosing one.

### Last-known-good output

Static mapping and Vite bundling happen in isolated staging paths. The staged theme and cache are promoted together only after the build succeeds.

### Safe concurrent builds

Independent CLI processes serialize through a recoverable project lock. An abandoned lock from a terminated process is detected and removed.

### Consumer-shaped package validation

CI packs the actual npm artifacts, installs both CLIs from those packed artifacts, scaffolds a fresh project, and runs a production build. Releases are published through npm Trusted Publishing with signed provenance from GitHub Actions.

## Configuration

Projects can use JavaScript or TypeScript configuration:

```ts
import { defineConfig } from "liquid-loom";

export default defineConfig({
	sourceDir: "src",
	outputDir: "dist/theme",
	performance: {
		maxBuildMs: 10_000,
		maxThemeBytes: 5_000_000,
		maxAssetBytes: 500_000
	}
});
```

Configuration stays project-relative and portable. The CLI resolves the consuming project from `process.cwd()` rather than from its installed package directory.

## Commands

| Command            | Purpose                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `pnpm dev`         | Build, watch, and launch Shopify theme development                      |
| `pnpm watch`       | Rebuild locally without Shopify CLI                                     |
| `pnpm build`       | Incremental production build                                            |
| `pnpm build:clean` | Production build from empty staging                                     |
| `pnpm doctor`      | Diagnose runtime, project metadata, source, config, safety, and privacy |
| `pnpm check`       | Validate source JSON and required build output                          |
| `pnpm analyze`     | Report output composition and largest files                             |
| `pnpm theme-check` | Run Shopify Theme Check                                                 |
| `pnpm validate`    | Reproduce the protected CI gate                                         |

## Reference storefront

The included storefront is intentionally merchant-neutral. It demonstrates theme blocks, JSON templates, editable header/footer groups, storefront filtering, predictive search, variant URL state, selling plans, responsive images, semantic navigation, reduced-motion support, visible focus states, and no-JavaScript fallbacks.

It is a reference implementation, not a hidden framework abstraction. The product is the authoring and build workflow.

## Current status

[`v0.1.0`](https://github.com/yotamon/Liquid-Loom/releases/tag/v0.1.0) is publicly available on npm as [`liquid-loom`](https://www.npmjs.com/package/liquid-loom) and [`create-liquid-loom`](https://www.npmjs.com/package/create-liquid-loom).

The next milestone is product proof, not a larger API surface:

1. run the public starter against a real Shopify development store;
2. get at least three external Shopify developers through setup and a real edit/build/preview loop;
3. publish one concise before/after case study;
4. fix the onboarding and workflow friction those sessions expose;
5. add broader extension APIs only when repeated user needs justify them.

See [Validation](docs/VALIDATION.md) for the early-adopter plan and [Roadmap](ROADMAP.md) for release priorities.

## Feedback and contribution

If you try Liquid Loom, feedback from an imperfect real project is more valuable right now than a feature wishlist based only on the README.

- [Run the 10-minute first-project test](docs/FIRST_PROJECT.md)
- [Share first-project feedback](https://github.com/yotamon/Liquid-Loom/issues/new?template=early_adopter_feedback.yml)
- [Report a bug](https://github.com/yotamon/Liquid-Loom/issues/new?template=bug_report.yml)
- [Start a discussion](https://github.com/yotamon/Liquid-Loom/discussions)
- [Read the contribution guide](CONTRIBUTING.md)

## Documentation

- [First project](docs/FIRST_PROJECT.md) - a ten-minute evaluation from public install to one real source edit
- [Architecture](docs/ARCHITECTURE.md) - invariants, mapping rules, transaction flow, and extension boundaries
- [Validation](docs/VALIDATION.md) - external-user and real-store validation plan
- [Recipes](docs/RECIPES.md) - entrypoints, static assets, private-term policies, and budgets
- [Troubleshooting](docs/TROUBLESHOOTING.md) - collisions, locks, Shopify CLI, and build failures
- [Benchmarks](docs/BENCHMARKS.md) - reproducible build measurements
- [Releasing](docs/RELEASING.md) - provenance-backed npm release process
- [Contributing](CONTRIBUTING.md) - development and pull-request expectations
- [Security](SECURITY.md) - private vulnerability reporting

## Design principles

- Source is the product; generated output is disposable.
- Shopify's runtime contract stays visible.
- Fail early, explain specifically, and preserve the last-known-good build.
- Prefer a small dependable core over speculative abstractions.
- Add framework surface only after real users demonstrate the need.

<p align="center">
  <img src="docs/brand-board.png" alt="Liquid Loom identity board" width="960">
</p>

## License

MIT © 2026 Liquid Loom contributors.
