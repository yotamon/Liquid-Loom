# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/) and this project uses semantic versioning.

## [Unreleased]

## [0.1.1] - 2026-09-08

### Added

- A ten-minute first-project evaluation guide for Shopify developers trying the public package.
- A first-project feedback path for early Shopify adopters, focused on real setup, build, and preview friction.
- Public adoption milestones that distinguish product evidence from stars, views, and other vanity metrics.

### Changed

- README onboarding now leads with the public npm quick start, clarifies the Shopify CLI relationship, and makes the `0.1.x` early-adopter call explicit.
- Scaffolder documentation now guides users through a local build before requiring a Shopify development store.
- Validation and roadmap status now reflect the completed `0.1.0` Trusted Publishing release and the remaining external-use evidence.

## [0.1.0] - 2026-09-08

### Added

- Cross-platform CI, CodeQL, Dependency Review, package smoke tests, and Node 26 canary coverage.
- Theme blocks, flexible content, storefront filters, predictive search, variants, and selling plans.
- Typed configuration, project diagnostics, performance budgets, and npm release automation.
- Deterministic source-to-Shopify mapping with SHA-256 incremental caching.
- Case-insensitive and Unicode-normalized collision detection.
- Transactional static and Vite builds with recoverable concurrency locks.
- Native Tailwind CSS Vite integration.
- `liquid-loom` CLI and `create-liquid-loom` scaffolder.
- Merchant-neutral Shopify Online Store 2.0 reference theme.
- Starter synchronization tests to prevent drift between the reference storefront and the embedded scaffolder source.
- External-user and real-store validation plan for the `0.1.x` release cycle.

### Changed

- Theme source validation now matches Shopify's upload minimum and requires only `layout/theme.liquid` at framework level.
- Feature-organized `config`, `locales`, and ordinary `templates` source folders flatten into Shopify-supported output paths.
- Only Shopify-supported `templates/customers/*` and `templates/metaobject/*` nesting is preserved in deployable output.
- README and roadmap now prioritize custom-theme workflow, shipping, and external adoption before speculative extension APIs.
- npm CLI bin metadata now uses registry-normalized relative paths, and package smoke tests execute both packed CLIs before release.

[Unreleased]: https://github.com/yotamon/Liquid-Loom/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/yotamon/Liquid-Loom/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/yotamon/Liquid-Loom/releases/tag/v0.1.0
