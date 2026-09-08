<p align="center">
  <img src="docs/liquid-loom.svg" alt="Liquid Loom" width="760">
</p>

<p align="center"><strong>Modern build tooling for custom Shopify themes.</strong></p>

<p align="center">
  <a href="https://github.com/yotamon/Liquid-Loom/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/yotamon/Liquid-Loom/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/yotamon/Liquid-Loom/actions/workflows/codeql.yml"><img alt="CodeQL" src="https://github.com/yotamon/Liquid-Loom/actions/workflows/codeql.yml/badge.svg"></a>
  <img alt="Node 22 and 24" src="https://img.shields.io/badge/Node-22%20%7C%2024-339933?logo=nodedotjs&logoColor=white">
  <img alt="Vite 8" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white">
  <img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-4DE3C1"></a>
</p>

Liquid Loom lets Shopify theme teams organize source code like an application while still shipping the exact directory structure Shopify expects.

```text
src/theme/sections/home/hero.liquid
src/theme/snippets/product/price.liquid
src/entrypoints/theme.js
                |
                v
        deterministic build
                |
                v
dist/theme/sections/hero.liquid
dist/theme/snippets/price.liquid
dist/theme/assets/theme.js
```

It does not replace Liquid, Online Store 2.0, or Shopify CLI. It is a build layer around them: feature-oriented source, Vite/Tailwind assets, collision-safe flattening, transactional output, diagnostics, and a production-minded starter.

> **Status:** pre-release. `0.1.0` is validated and package-ready, but is not yet published to npm.
> Registry setup still needs to be completed: claim or bootstrap both package names if needed, then configure npm Trusted Publishing for `release.yml`.

## Who it is for

Liquid Loom is aimed at developers and teams building custom or client Shopify themes where the native flat theme layout becomes uncomfortable to maintain.

It is most useful when you want:

- feature-oriented source folders without changing Shopify's deployable format;
- a modern JavaScript and CSS build pipeline;
- deterministic builds with no silent filename overwrites;
- a last-known-good theme when bundling fails;
- repeatable local and CI validation;
- a starter that demonstrates accessibility and progressive enhancement rather than hiding Shopify concepts.

If your primary goal is Shopify Theme Store submission, start with Shopify's official [Skeleton Theme](https://github.com/Shopify/skeleton-theme) and adopt Liquid Loom's tooling patterns only where they help your workflow.

## Start a theme

Until both packages are live on npm, clone the repository directly:

```bash
git clone https://github.com/yotamon/Liquid-Loom.git my-storefront
cd my-storefront
corepack enable
pnpm install
pnpm dev
```

After the first npm release:

```bash
corepack enable
pnpm create liquid-loom@latest my-storefront
cd my-storefront
pnpm dev
```

`pnpm dev` builds the deployable theme, watches source files, and launches `shopify theme dev`. A Shopify development store is only required for live preview. Builds, tests, diagnostics, and Theme Check remain local.

To work on Liquid Loom itself:

```bash
git clone https://github.com/yotamon/Liquid-Loom.git
cd Liquid-Loom
corepack enable
pnpm install
pnpm validate
```

## The source contract

Shopify deployable themes use a constrained directory structure. Liquid Loom lets authoring paths be nested for organization, then maps them to portable Shopify output before writing anything.

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

Liquid Loom validates the current Shopify upload minimum: `layout/theme.liquid`. Starter-only files such as `config/settings_schema.json` and `templates/index.json` are useful defaults, but they are not treated as platform requirements.

For Shopify's canonical directory rules, see the official [theme architecture documentation](https://shopify.dev/docs/storefronts/themes/architecture).

## What the build protects

### No silent overwrites

The complete source-to-output plan is validated before files are published. Collisions are case-insensitive and Unicode-normalized so a build cannot work on one filesystem and silently overwrite another.

### Last-known-good output

Static mapping and Vite bundling happen in isolated staging paths. The staged theme and cache are promoted together only after the build succeeds. A failed bundle leaves the previous deployable theme untouched.

### Safe concurrent builds

Independent CLI processes serialize through a recoverable project lock. An abandoned lock from a terminated process is detected and removed.

### Consumer-shaped package validation

CI packs the actual npm artifacts, installs the CLI into a fresh scaffold, and runs a production build. The package is tested as a consumer receives it, not only from the repository checkout.

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

| Command              | Purpose                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`           | Build, watch, and launch Shopify theme development                      |
| `pnpm watch`         | Rebuild locally without Shopify CLI                                     |
| `pnpm build`         | Incremental production build                                            |
| `pnpm build:clean`   | Production build from empty staging                                     |
| `pnpm doctor`        | Diagnose runtime, project metadata, source, config, safety, and privacy |
| `pnpm check`         | Validate source JSON and required build output                          |
| `pnpm analyze`       | Report output composition and largest files                             |
| `pnpm theme-check`   | Run Shopify Theme Check                                                 |
| `pnpm test:coverage` | Enforce line, branch, and function coverage thresholds                  |
| `pnpm pack:check`    | Install the packed CLI into a fresh scaffold and build it               |
| `pnpm validate`      | Reproduce the protected CI gate                                         |

## Reference storefront

The included storefront is intentionally merchant-neutral. It demonstrates theme blocks, JSON templates, editable header/footer groups, storefront filtering, predictive search, variant URL state, selling plans, responsive images, semantic navigation, reduced-motion support, visible focus states, and no-JavaScript fallbacks.

It is a reference implementation, not the reason Liquid Loom exists. The product is the build and authoring workflow.

## Quality gate

Pull requests exercise unit and integration tests, coverage thresholds, clean transactional builds, performance budgets, Theme Check, packed-package smoke tests, Dependency Review, CodeQL, and portability across Linux, Windows, and macOS. A Node-next canary is intentionally non-blocking.

## What comes next

The next milestone is not a larger abstraction layer. It is evidence that the workflow is useful outside this repository:

1. publish `0.1.0` through npm trusted publishing;
2. run the starter against a real Shopify development store;
3. get at least three external Shopify developers through setup and a real edit/build/preview loop;
4. publish one concise before/after case study;
5. add broader extension APIs only when repeated user needs justify them.

See [Validation](docs/VALIDATION.md) for the early-adopter plan and [Roadmap](ROADMAP.md) for release priorities.

## Documentation

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
