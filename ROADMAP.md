# Roadmap

Liquid Loom favors a small, dependable core over a broad abstraction layer. The immediate goal is to prove the workflow on real Shopify projects before expanding the framework surface.

## 0.1 - Ship and validate

- Keep source-to-output mapping aligned with Shopify's documented directory contract.
- Publish `liquid-loom` and `create-liquid-loom` through npm trusted publishing.
- Validate a clean public-package install and build.
- Run the reference storefront against a real Shopify development store.
- Put at least three external Shopify developers through the core edit/build/preview workflow.
- Publish one concise before/after case study.
- Fix onboarding and diagnostics issues discovered by those sessions.

## 0.2 - Product proof

Priorities should come from `0.1` usage. Likely candidates:

- opt-in browser smoke tests against a Shopify development store;
- migration guidance for common flat or legacy theme layouts;
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
