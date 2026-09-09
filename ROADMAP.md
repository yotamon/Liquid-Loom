# Roadmap

Liquid Loom favors a small, dependable core over a broad abstraction layer. The immediate goal is to prove the workflow on real Shopify projects before expanding the framework surface.

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

## 0.3 - Extension surface, if earned

Only after repeated consumer needs justify a public extension API:

- documented hooks around planning, validation, and post-build analysis;
- a stable extension compatibility contract;
- additional source-root support if multiple real repositories require it;
- asset-pipeline integration hooks when existing-theme evidence shows a repeated need;
- machine-readable build/ownership reports for CI and observability consumers;
- additional starter variants when they demonstrate distinct real-world workflows;
- a community recipe registry if a community actually forms around reusable recipes.

## Non-goals

- Hiding Liquid, Shopify CLI, or Online Store 2.0 concepts.
- Replacing Shopify's official Theme Store policy or approved starting point.
- Bundling analytics vendors, credentials, store data, or client-specific workflows.
- Becoming a general storefront framework unrelated to Shopify themes.
- Adding abstractions solely to make the project appear more framework-like.
- Requiring migration before an existing theme can receive value from Liquid Loom.

See [Validation](docs/VALIDATION.md) for the evidence expected before broadening the public API.
