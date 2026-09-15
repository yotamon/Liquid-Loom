# Roadmap

Liquid Loom favors a small, dependable engineering layer over a broad storefront abstraction. Shopify owns the runtime, Liquid contract, CLI, and platform. Liquid Loom focuses on source architecture, deterministic ownership, safe adoption, diagnostics, and project understanding around those primitives.

## 0.1 - Ship and validate

Completed:

- [x] Keep source-to-output mapping aligned with Shopify's documented directory contract.
- [x] Publish `liquid-loom` and `create-liquid-loom` through npm Trusted Publishing with provenance.
- [x] Validate packed consumer installs and both CLI binaries in CI.

Still proving in public use:

- [ ] Validate a clean install directly from the public npm registry.
- [ ] Run the reference storefront against a real Shopify development store.
- [ ] Put at least three external Shopify developers through a real edit/build/preview workflow.
- [ ] Publish one concise before/after case study.
- [ ] Fix onboarding and diagnostics issues discovered by those sessions.

## 0.2 - Existing-theme adoption

The first external feedback exposed switching cost as a larger adoption problem than missing framework surface. The implementation therefore makes Liquid Loom useful inside the Shopify theme a developer already has.

Implemented:

- [x] adopt Liquid Loom without moving existing Shopify theme files;
- [x] build native Shopify source and organized Liquid Loom source together;
- [x] keep existing asset tooling by default instead of forcing Vite/Tailwind;
- [x] add a safe, previewable `liquid-loom init` path for existing themes;
- [x] add preview-first partial, directory, and full migration into `src`;
- [x] prove output identity before migration so Shopify references do not need rewriting;
- [x] keep collisions explicit across native, organized, and generated source;
- [x] make hybrid cache/stale-output behavior source-layer aware;
- [x] add hybrid-aware `doctor`, watch, check, public types, and programmatic APIs;
- [x] validate packed `init -> hybrid build -> migrate -> build` behavior in package smoke;
- [x] document the architecture, safety invariants, and operational workflow.

Now proving:

- [ ] run `0.2.x` against at least one real established Shopify theme;
- [ ] preview the merged output against a Shopify development store;
- [ ] observe at least three external developers using zero-migration adoption;
- [ ] observe whether developers voluntarily migrate source after receiving value from hybrid mode;
- [ ] document repository shapes or asset pipelines that still create adoption friction.

See [Existing-theme adoption](docs/EXISTING_THEME_ADOPTION.md) for the implemented contract and [Validation](docs/VALIDATION.md) for the evidence plan.

## 0.3 - Project intelligence and Shopify-native evolution

Liquid Loom should make a theme easier to understand for both developers and coding agents without becoming a second Liquid runtime.

Implemented:

- [x] deterministic machine-readable project model with no timestamps or random identifiers;
- [x] `liquid-loom explain [target]` for whole-project, feature, and path-oriented architecture queries;
- [x] `--json` output suitable for coding agents, CI, and future observability tooling;
- [x] semantic feature grouping across organized source and unmigrated native Shopify source;
- [x] static relationship discovery for snippets, sections, blocks, assets, JSON templates, and preview partials;
- [x] unresolved-reference reporting without guessing dynamic Liquid relationships;
- [x] explicit `stable` and `july-2026-preview` Liquid modes;
- [x] `doctor` warnings for preview syntax and declared preview projects;
- [x] public TypeScript contracts for the project model.

Now proving:

- [ ] evaluate `liquid-loom explain --json` in real Codex and other coding-agent workflows;
- [ ] measure whether project-model context reduces unnecessary repository reads and incorrect cross-feature edits;
- [ ] validate semantic grouping against several established themes with different naming conventions;
- [ ] add machine-readable architectural diffs only if real workflows need them;
- [ ] track Shopify's July 2026 Liquid preview and move behavior into stable expectations only after Shopify publishes a stable contract;
- [ ] continue treating Tailwind and Vite as excellent integrations, not as Liquid Loom's reason to exist.

See [Project model](docs/PROJECT_MODEL.md) and [Shopify Liquid July 2026 developer preview](docs/LIQUID_JULY_2026_PREVIEW.md).

## 0.4 - Shopify 2026 platform modernization

Modernize fresh-project defaults and the reference storefront around Shopify's current native theme capabilities without weakening the `0.2` ownership/migration guarantees or the `0.3` project-intelligence model.

Planned:

- [ ] make Shopify-native `{% stylesheet %}` / `{% javascript %}` component assets the preferred fresh-project path where practical;
- [ ] keep Vite and Tailwind as explicit, tested optional asset strategies rather than Liquid Loom's product identity;
- [ ] make theme blocks and merchant-reorderable composition central to the reference storefront, especially product information and purchase surfaces;
- [ ] implement relevant Shopify standard storefront events/actions in the reference theme;
- [ ] move the reference color system to `color_palette` plus semantic CSS custom properties;
- [ ] adopt the `<shopify-account>` component with a merchant-configurable account menu;
- [ ] add a documented/generated compiled branch or deployment-repository workflow for Shopify GitHub integration;
- [ ] align opt-in real-store testing with Shopify CLI 4.8+ dev-store commands;
- [ ] extend project intelligence only where new block/component/deployment relationships are statically provable;
- [ ] preserve explicit `stable` / `july-2026-preview` modes and keep preview syntax outside the stable release gate;
- [ ] preserve zero-migration adoption and existing asset pipelines for established themes;
- [ ] expand package, Theme Check, browser, Theme Editor, and deployment-loop validation around the new defaults.

See [Shopify 2026 platform modernization](docs/SHOPIFY_2026_MODERNIZATION.md) for the full architecture decisions, compatibility constraints, implementation order, and acceptance criteria.

## 0.5 - Extension surface, if earned

Only after repeated consumer needs justify a public extension API:

- documented hooks around planning, validation, and post-build analysis;
- a stable extension compatibility contract;
- additional source-root support if multiple real repositories require it;
- asset-pipeline integration hooks when existing-theme evidence shows a repeated need;
- architectural/ownership report hooks for CI and observability consumers;
- additional starter variants when they demonstrate distinct real-world workflows;
- a community recipe registry if a community actually forms around reusable recipes.

## Non-goals

- Hiding Liquid, Shopify CLI, or Online Store 2.0 concepts.
- Replacing Shopify's official Theme Store policy or approved starting point.
- Competing with Shopify on the Liquid runtime, Shopify CLI, or Tailwind itself.
- Treating Vite or Tailwind integration as the framework's durable moat.
- Bundling analytics vendors, credentials, store data, or client-specific workflows.
- Becoming a general storefront framework unrelated to Shopify themes.
- Adding abstractions solely to make the project appear more framework-like.
- Requiring migration before an existing theme can receive value from Liquid Loom.
- Guessing dynamic Liquid relationships in order to make the project model look more complete.
- Making developer-preview Liquid syntax the default before Shopify stabilizes it.
- Introducing a second storefront runtime to imitate headless frameworks.

See [Validation](docs/VALIDATION.md) for the evidence expected before broadening the public API.
