# Existing-theme adoption design

Status: proposed for `0.2.0`

This document defines how Liquid Loom can be adopted inside an existing Shopify theme without requiring a rewrite, while still supporting partial or full migration into Liquid Loom's organized source structure.

The design is intentionally conservative: existing theme files remain valid Shopify source, Liquid Loom never silently overwrites one source with another, and migration must preserve the deployable Shopify path of every moved file.

## Problem

The current `0.1.x` onboarding is strongest for a new project:

```text
create-liquid-loom -> src/... -> Liquid Loom build -> dist/theme -> Shopify CLI
```

That is useful, but it leaves a major adoption gap. Most professional Shopify work happens in an existing theme, an agency boilerplate, or a client repository. Asking those developers to reorganize the whole project before they can benefit from Liquid Loom creates too much switching cost.

A developer should be able to:

1. install Liquid Loom into an existing Shopify theme without moving any existing files;
2. keep editing the existing flat Shopify directories normally;
3. author new work in Liquid Loom's feature-organized source structure immediately;
4. migrate one file, one directory, or the whole theme later;
5. preserve the exact Shopify output path while migrating;
6. keep their existing asset workflow until they explicitly choose to adopt Vite/Tailwind;
7. run the same `build`, `watch`, `dev`, `doctor`, and collision-safety model regardless of how much has been migrated.

## Goals

- Make adoption incremental rather than all-or-nothing.
- Preserve existing Shopify semantics and references.
- Never modify existing theme files during `init`.
- Allow native Shopify source and Liquid Loom organized source to coexist in one build.
- Preserve the existing no-silent-overwrite invariant across all source locations.
- Make migration reversible, previewable, and output-preserving.
- Avoid forcing Vite, Tailwind, or a new asset pipeline onto an existing project.
- Preserve backward compatibility for current `0.1.x` projects.
- Keep the public configuration surface small.

## Non-goals

- Automatically infer a developer's desired feature taxonomy.
- Rewrite Liquid, JSON templates, section references, snippet references, or asset URLs during migration.
- Introduce source precedence where one file silently overrides another.
- Replace Shopify CLI.
- Write generated output back into the user's existing theme source.
- Replace an existing build tool unless the developer explicitly opts into Liquid Loom's Vite integration.
- Split Liquid Loom into many independent packages just to appear modular.

## Core decision: dual-source builds

Liquid Loom should treat an existing Shopify theme and organized Liquid Loom source as two source layers that produce one deployable Shopify theme.

```text
Existing Shopify source                 Liquid Loom organized source

assets/                                 src/public/
blocks/                                 src/theme/blocks/
config/                                 src/theme/config/
layout/                                 src/theme/layout/
locales/                                src/theme/locales/
sections/                               src/theme/sections/<feature>/
snippets/                               src/theme/snippets/<feature>/
templates/                              src/theme/templates/<feature>/
       \                                      /
        \                                    /
         +---------- mapping plan ----------+
                        |
                        v
                   dist/theme
                        |
                        v
                   Shopify CLI
```

There is no overlay precedence.

Every deployable output path must have exactly one owner across every source layer. If two files map to the same output path, the build fails before changing the last-known-good output.

This keeps the current safety model intact while making adoption incremental.

## Public configuration

Do not expose a generic plug-in style `sources[]` API yet. The public configuration only needs one new optional property.

```ts
export default defineConfig({
  shopifySourceDir: ".",
  sourceDir: "src",
  outputDir: "dist/theme",
  viteConfig: false
});
```

### `sourceDir`

Existing behavior. This is Liquid Loom's organized authoring root and remains `src` by default.

### `shopifySourceDir`

New optional path. When present, Liquid Loom discovers standard Shopify theme directories under this location and treats their deployable paths as identity mappings.

Examples:

```ts
shopifySourceDir: "."
```

or, for a monorepo:

```ts
shopifySourceDir: "theme"
```

### `viteConfig`

Expand the current type from `string` to `string | false`.

- current and new scaffolded projects keep the existing default, `vite.config.js`;
- existing-theme `init` writes `viteConfig: false` by default;
- when `false`, Liquid Loom does not run Vite and does not reserve Vite-generated output names;
- the existing theme's `assets/` directory remains passthrough source;
- Vite/Tailwind can be adopted later as a separate explicit choice.

This gives modular adoption without splitting the framework into multiple packages.

## Internal source model

The resolved configuration should normalize public configuration into internal source descriptors.

```ts
type SourceLayer =
  | {
      id: "shopify";
      kind: "shopify";
      root: string;
    }
  | {
      id: "loom";
      kind: "organized";
      root: string;
    };
```

Current projects resolve to one organized layer.

Existing-theme projects resolve to a Shopify layer plus an organized layer.

The generic layer model stays internal until repeated real-world needs justify exposing it publicly.

## Mapping contract

### Existing Shopify source

Valid native theme files preserve their deployable path.

```text
sections/hero.liquid       -> sections/hero.liquid
templates/product.json     -> templates/product.json
assets/theme.css           -> assets/theme.css
```

The native mapper should still enforce Shopify-supported nesting rather than blindly copying arbitrary directories.

### Organized Liquid Loom source

Current mapping semantics remain unchanged.

```text
src/theme/sections/home/hero.liquid
  -> sections/hero.liquid

src/theme/snippets/product/price.liquid
  -> snippets/price.liquid

src/public/icons/cart.svg
  -> assets/cart.svg
```

### Output identity invariant

Migration is considered safe only when the file's output path is identical before and after the move.

Example:

```text
before:
sections/hero.liquid
  -> sections/hero.liquid

after:
src/theme/sections/home/hero.liquid
  -> sections/hero.liquid
```

Because the generated Shopify path stays `sections/hero.liquid`, references do not need to be rewritten.

This is the central migration invariant.

## Collision ownership

There must never be automatic precedence between native and organized source.

This is invalid:

```text
sections/hero.liquid
src/theme/sections/home/hero.liquid
```

Both own:

```text
sections/hero.liquid
```

The build must fail before writing output.

The diagnostic should explain both the Shopify namespace and the available choices:

```text
Two source files map to the same Shopify section:

  sections/hero.liquid
  src/theme/sections/home/hero.liquid

Both map to:
  sections/hero.liquid

Keep one source owner, rename the new section, or migrate the existing file into the organized source tree.
```

Collision checks remain case-insensitive and Unicode-normalized across source layers.

## Existing-theme initialization

Add:

```bash
liquid-loom init
```

The command must be safe to run in a repository that was not created by Liquid Loom.

### Detection

By default, `init` inspects the current working directory and looks for Shopify theme evidence, with `layout/theme.liquid` as the strongest required signal.

Support an explicit path:

```bash
liquid-loom init --theme-dir theme
```

If detection is ambiguous, fail with an actionable message instead of guessing.

### Init plan

Before changing anything, show a mutation plan:

```text
LIQUID LOOM · existing theme setup

Shopify theme: .
Theme files: 184
Package manager: pnpm
Asset workflow: keep existing assets

Planned changes:
  + liquid-loom.config.mjs
  + src/theme/
  ~ package.json
  ~ .gitignore

Existing Shopify files moved: 0
```

### Files and package metadata

`init` should:

- create `liquid-loom.config.mjs` rather than changing the repository's module type;
- set `shopifySourceDir` to the detected theme root;
- set `sourceDir` to `src`;
- set `outputDir` to `dist/theme`;
- set `viteConfig: false` by default;
- create the organized source directories without moving theme files;
- add Liquid Loom as a development dependency when needed;
- preserve all existing package fields and scripts;
- add namespaced scripts rather than replacing common script names;
- minimally extend `.gitignore` without replacing it.

Recommended scripts:

```json
{
  "loom:build": "liquid-loom build",
  "loom:watch": "liquid-loom watch",
  "loom:dev": "liquid-loom dev",
  "loom:doctor": "liquid-loom doctor"
}
```

Do not overwrite an existing script with the same name unless its value already matches.

### Package manager handling

Detect the package manager using lockfiles and invocation metadata.

Priority should be deterministic and documented. An explicit `--package-manager` option overrides detection.

The command should support:

```bash
npx liquid-loom@latest init
pnpm dlx liquid-loom@latest init
```

as well as execution from an already installed dependency.

Support:

```text
--package-manager npm|pnpm|yarn|bun
--no-install
--dry-run
--yes
--theme-dir <path>
```

No interactive confirmation is allowed when stdin is not a TTY unless `--yes` is provided.

## Using Liquid Loom without migration

Immediately after `init`, a developer can keep all existing theme files where they are and add only new work under `src`.

Example existing repository:

```text
sections/header.liquid
sections/product-main.liquid
snippets/price.liquid
assets/theme.css
```

New feature:

```text
src/theme/sections/product/upsell.liquid
src/theme/snippets/product/upsell-price.liquid
```

Build result:

```text
dist/theme/sections/header.liquid
dist/theme/sections/product-main.liquid
dist/theme/sections/upsell.liquid
dist/theme/snippets/price.liquid
dist/theme/snippets/upsell-price.liquid
dist/theme/assets/theme.css
```

This is the most important adoption path. A developer receives value from organized new code without paying an up-front migration cost.

## Incremental migration

Add:

```bash
liquid-loom migrate
```

Migration moves ownership from the native Shopify layer to the organized layer while keeping the final Shopify path identical.

### Safe defaults

A migration command that moves source files should preview by default.

Example:

```bash
liquid-loom migrate sections/hero.liquid
```

Output:

```text
Migration preview

sections/hero.liquid
  -> src/theme/sections/hero.liquid

Shopify output remains:
  sections/hero.liquid

No files changed. Run again with --apply to move the file.
```

Apply:

```bash
liquid-loom migrate sections/hero.liquid --apply
```

### Organize while migrating

Support an explicit organized target as long as output identity remains unchanged.

```bash
liquid-loom migrate sections/hero.liquid \
  --to theme/sections/home/hero.liquid \
  --apply
```

The command must prove:

```text
native output == organized output
```

before moving anything.

If `--to` would change the deployable Shopify path, refuse the migration.

### Directory migration

Support a Shopify directory:

```bash
liquid-loom migrate sections --apply
```

This moves files to their direct organized equivalents without trying to invent feature folders.

### Full migration

Support:

```bash
liquid-loom migrate --all
liquid-loom migrate --all --apply
```

Default destinations:

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

The full migration intentionally does not infer feature folders. The developer can organize files later, or use `--to` for individual files while migrating incrementally.

Leaving `shopifySourceDir` configured after all managed native directories become empty is harmless. `doctor` can suggest removing it later rather than making `migrate` rewrite arbitrary user configuration code.

## Asset workflow

Existing themes often already have an asset pipeline. Liquid Loom must not require replacing it.

### Existing-theme default

`viteConfig: false`

Behavior:

- native `assets/*` are copied unchanged;
- `src/public/*` can add new passthrough assets;
- no Vite build runs;
- no `assets/theme.js` or `assets/style.css` reservation exists;
- `doctor` reports that Liquid Loom asset bundling is disabled, not broken.

If `src/entrypoints` exists while bundling is disabled, `doctor` should warn that those files are not compiled.

### Later Vite adoption

Enabling Vite is a separate opt-in operation. It should only be allowed after reserved output collisions are checked.

This can be documented in `0.2.0`; a dedicated `adopt-vite` command is not required for the first implementation unless it materially simplifies onboarding.

## Build pipeline changes

The current build assumes one organized `sourceRoot`. Refactor discovery and planning around source entries.

Suggested internal shape:

```ts
interface SourceEntry {
  layerId: string;
  kind: "shopify" | "organized";
  root: string;
  relativePath: string;
  displayPath: string;
}
```

The pipeline becomes:

```text
resolve config
  -> resolve source layers
  -> discover files in each layer
  -> map every source entry to one Shopify output
  -> validate one global ownership map
  -> stage/copy/cache static files
  -> optionally run Vite
  -> validate budgets
  -> promote atomically
```

### Native discovery

Do not recursively scan an entire repository when `shopifySourceDir` is `.`.

Discover only Shopify-managed directories:

```text
assets
blocks
config
layout
locales
sections
snippets
templates
```

This avoids `node_modules`, `src`, `dist`, and unrelated repository files by construction.

### Output safety

The current rule that `outputRoot` cannot be inside `sourceRoot` is too coarse when the native theme root is the project root.

Replace it with managed-source overlap checks:

- output cannot equal the project root;
- output must stay inside the project;
- output cannot be inside the organized source root;
- output cannot overlap a native managed theme directory;
- native root `.` with output `dist/theme` is valid because `dist` is not a native managed theme directory.

### Platform minimum

Validation should move from checking a hard-coded source location to checking the final mapped plan.

The final ownership map must contain:

```text
layout/theme.liquid
```

It does not matter whether that file came from:

```text
layout/theme.liquid
```

or:

```text
src/theme/layout/theme.liquid
```

This makes platform validation source-strategy independent.

## Cache and stale-output correctness

The manifest must record source-layer identity in addition to the relative source path.

A migration can change source identity while preserving output identity:

```text
shopify:sections/hero.liquid
  -> loom:theme/sections/home/hero.liquid
```

Both own `sections/hero.liquid` at different times.

Stale-output cleanup must therefore be based on current output ownership, not only on whether an old source key disappeared. A migrated file must never be copied to a new source owner and then deleted as stale because the previous source key vanished.

Add a regression test specifically for this transition.

## Watch and dev behavior

`watch` must observe:

- the organized source root;
- only the native Shopify managed directories that exist;
- Vite config only when Vite is enabled;
- Liquid Loom config.

It must not watch the whole repository when `shopifySourceDir` is `.`.

`dev` keeps the same contract:

```text
build merged output -> watch -> shopify theme dev --path dist/theme
```

Developers who already run a separate asset watcher can continue doing so. Liquid Loom will treat changes written into the native `assets/` directory as source changes and rebuild the merged output.

## CLI loading architecture

The current CLI resolves project configuration eagerly at module load.

Refactor to lazy per-command configuration before adding `init` and `migrate`.

Commands such as `init` need to run correctly before a Liquid Loom config exists, while build commands still require a resolved build context.

Suggested separation:

```text
CLI parsing
  -> command-specific input discovery
  -> load/resolve project config only if command needs it
```

This also makes command unit tests easier.

## Mutation planner

`init` and `migrate` should share a pure planning layer rather than mixing discovery, prompts, and file writes.

```text
discover current state
  -> create mutation plan
  -> validate plan
  -> render preview
  -> confirm
  -> apply transaction
```

A plan should be serializable enough for tests and future machine-readable output.

Suggested operation types:

```ts
type Mutation =
  | { type: "create"; path: string; content: string }
  | { type: "update"; path: string; before: string; after: string }
  | { type: "move"; from: string; to: string };
```

### Transaction guarantees

For filesystem moves:

- validate every source and destination before the first mutation;
- create parent directories first;
- use same-filesystem `rename` when possible;
- record completed moves;
- if a later operation fails, roll completed moves back in reverse order;
- never delete an existing destination to make a migration succeed.

For text-file changes during init:

- calculate complete replacements before writing;
- retain original contents in memory for rollback;
- do not rewrite formatting beyond the fields Liquid Loom owns.

## Diagnostics

`doctor` should become adoption-aware.

Example hybrid report:

```text
✓ source-strategy      existing Shopify + organized source
✓ shopify-source       184 files from .
✓ organized-source     7 files from src
✓ output-ownership     191 unique Shopify paths
✓ asset-workflow       existing assets preserved; Vite disabled
✓ output-safety        dist/theme is isolated from managed source
```

When a collision exists, `doctor` should use the same ownership diagnostics as `build`.

A separate `status` command is not required for the first version unless user testing shows that `doctor` is too diagnostic-oriented for adoption progress.

## Backward compatibility

Current `0.1.x` projects must work without configuration changes.

When `shopifySourceDir` is absent:

- only the organized source layer exists;
- `sourceDir` defaults to `src`;
- `viteConfig` defaults to `vite.config.js`;
- current Vite reservations remain active;
- current mapping behavior remains unchanged.

Public functions that currently accept a single `sourceRoot` should either retain that signature or gain additive options. Do not force existing programmatic consumers onto the internal layer abstraction.

## Tests

### Unit tests

Add coverage for:

- native Shopify identity mapping;
- invalid native nesting;
- organized mapping unchanged from `0.1.x`;
- hybrid build planning;
- cross-layer filename collisions;
- case-insensitive cross-layer collisions;
- Unicode-normalized cross-layer collisions;
- final-plan Shopify minimum validation;
- output safety with `shopifySourceDir: "."` and `outputDir: "dist/theme"`;
- `viteConfig: false` behavior;
- source-layer-aware cache keys;
- migration source identity changing while output identity remains constant;
- stale cleanup after migration;
- migration `--to` refusing output-path changes;
- rollback when a migration operation fails.

### Integration fixtures

Create an `existing-theme` fixture that looks like a conventional Shopify repository and does not start with Liquid Loom structure.

Prove these journeys:

1. run `init` and verify zero existing theme files changed;
2. build immediately and compare deployable files with the original theme;
3. add a new organized section and build both sources together;
4. edit a native file and see the merged output update;
5. migrate one file and prove output bytes/path are unchanged;
6. migrate one file into a feature subfolder with `--to` and prove output identity;
7. migrate all supported files and prove deployable output equivalence;
8. create a cross-layer collision and verify the actionable error;
9. run with no Vite config and preserve native assets;
10. run on Windows, macOS, and Linux through the existing portability matrix.

### Published-package smoke

Extend package smoke tests to install the packed `liquid-loom` CLI into an existing-theme fixture, run non-interactive init, build, migrate one file, and build again.

This is required before release because existing-theme adoption is primarily a packaging/onboarding feature, not only an internal library feature.

## Implementation sequence

Do not implement all behavior in one unreviewable refactor. Use four bounded PRs, each leaving `main` releasable.

### PR 1: source-layer foundation

- add optional `shopifySourceDir`;
- add `viteConfig: false`;
- introduce internal source descriptors;
- add native Shopify discovery/mapping;
- build one global ownership plan;
- update output-safety rules;
- update platform-minimum validation;
- make cache/stale cleanup migration-safe;
- keep existing CLI behavior backward compatible.

Exit condition: a manually configured hybrid fixture can build native + organized source safely.

### PR 2: safe existing-theme init

- refactor CLI config loading to be lazy;
- add pure init planner;
- detect existing theme and package manager;
- generate non-invasive config;
- merge namespaced scripts and gitignore entries;
- support dry-run, yes, no-install, theme-dir, package-manager;
- add rollback tests.

Exit condition: a developer can adopt Liquid Loom without moving one existing theme file.

### PR 3: incremental migration

- add migration planner;
- add single-file, directory, and all modes;
- add `--to` with output-identity proof;
- preview by default and `--apply` for mutations;
- implement rollback journal;
- improve ownership collision diagnostics.

Exit condition: partial and full migration preserve deployable paths and content.

### PR 4: product proof and release hardening

- extend `doctor` for hybrid projects;
- add existing-theme package smoke;
- document existing-theme onboarding and migration;
- update README positioning from new-project-first to new-or-existing;
- run real dev-store smoke using a migrated existing-theme fixture;
- release as `0.2.0` through the existing trusted publishing pipeline.

Exit condition: one public install path works from an ordinary existing Shopify theme through live Shopify preview.

## Acceptance criteria for `0.2.0`

`0.2.0` is ready only when all of the following are true:

- `0.1.x` scaffolded projects require no config changes;
- `liquid-loom init` changes no existing Shopify theme file;
- an unmodified existing theme can build through Liquid Loom with equivalent deployable theme files when Vite is disabled;
- new organized source can coexist with native source;
- native and organized source collisions fail before output mutation;
- migrating a file can preserve its exact deployable Shopify path;
- partial migration leaves remaining native source functional;
- full migration preserves deployable output identity;
- existing assets remain usable without Vite;
- Vite remains available for new projects and explicit opt-in;
- all mutation commands have preview/confirmation semantics and rollback coverage;
- packed-package smoke exercises the existing-theme path;
- Windows, macOS, and Linux CI are green;
- one real Shopify development-store preview succeeds from a hybrid or migrated project.

## Product positioning after implementation

The product should no longer imply that adoption requires a new theme.

Primary message:

> Modern tooling for the Shopify theme you already have, with a better structure you can adopt at your own pace.

Supporting idea:

```text
Keep today's theme.
Use Liquid Loom for tomorrow's code.
Migrate the rest only when it is worth it.
```

This is a stronger adoption story than asking developers to replace a workflow that already works for them.
