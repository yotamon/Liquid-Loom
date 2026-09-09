# Roadmap

Liquid Loom favors a small, dependable core over a broad abstraction layer. The immediate goal is to prove the workflow on real Shopify projects before expanding the framework surface.

## 0.1 - Ship and validate

Completed:

- [x] Keep source-to-output mapping aligned with Shopify's documented directory contract.
- [x] Publish `liquid-loom` and `create-liquid-loom` through npm Trusted Publishing with provenance.
- [x] Validate packed consumer installs and both CLI binaries in CI.

Now proving:

- [ ] Validate a clean install directly from the public npm registry.
- [ ] Run the reference storefront against a real Shopify development store.
- [ ] Put at least three external Shopify developers through the core edit/build/preview workflow.
- [ ] Publish one concise before/after case study.
- [ ] Fix onboarding and diagnostics issues discovered by those sessions.

## 0.2 - Existing-theme adoption

The first external feedback exposed switching cost as a larger adoption problem than missing framework surface. `0.2` should make Liquid Loom useful inside the Shopify theme a developer already has.

Primary scope:

- adopt Liquid Loom without moving existing Shopify theme files;
- build native Shopify source and organized Liquid Loom source together;
- keep existing asset tooling by default instead of forcing Vite/Tailwind;
- add a safe `liquid-loom init` path for existing themes;
- support previewable partial and full migration into `src` while preserving deployable Shopify paths;
- keep collisions explicit across native and organized source instead of introducing silent precedence;
- validate the complete existing-theme path in packed-package CI and a real Shopify development store.

The accepted design is tracked in [Existing-theme adoption design](docs/EXISTING_THEME_ADOPTION.md).

Secondary candidates after the adoption path is proven:

- opt-in browser smoke tests against a Shopify development store;
- machine-readable build reports when CI/observability consumers need them;
- improved multi-entry asset recipes;
- packaging cleanup that removes starter duplication without complicating npm delivery.

## 0.3 - Extension surface, if earned

Only after repeated consumer needs justify a public extension API:

- documented hooks around planning, validation, and post-build analysis;
- a stable extension compatibility contract;
- additional starter variants when they demonstrate distinct real-world workflows;
- a community recipe registry if a community actually forms around reusable recipes.

## Non-goals

- Hiding Liquid, Shopify CLI, or Online Store 2.0 concepts.
- Replacing Shopify's official Theme Store policy or approved starting point.
- Bundling analytics vendors, credentials, store data, or client-specific workflows.
- Becoming a general storefront framework unrelated to Shopify themes.
- Adding abstractions solely to make the project appear more framework-like.

See [Validation](docs/VALIDATION.md) for the evidence expected before broadening the public API.
