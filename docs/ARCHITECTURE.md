# Architecture

Liquid Loom has three boundaries: authoring source, build orchestration, and deployable Shopify output.

The framework deliberately does not invent a second storefront runtime. Liquid remains Liquid, Shopify CLI remains the deployment and preview tool, and the generated theme follows Shopify's documented directory contract.

## Invariants

1. Every supported source file maps to exactly one portable Shopify output path.
2. A complete mapping plan is validated before any source file is published.
3. Generated assets and static assets cannot own the same output path.
4. A failed build cannot modify the last-known-good theme or cache.
5. Clean operations cannot target the source tree, repository root, or a path outside the project.
6. The installed CLI always operates on the consuming working directory.
7. Authoring folders may be deeper than Shopify output, but generated output may only use Shopify-supported nesting.
8. Platform validity and starter opinion are separate: Shopify's upload minimum is `layout/theme.liquid`; the reference storefront can require more for its own features.

## Build transaction

```text
CLI
 |
 +--> acquire project lock
 |
 +--> create isolated staging output/cache
 |
 +--> discover source files
 |
 +--> create and validate complete mapping plan
 |      - traversal guard
 |      - case-insensitive collision guard
 |      - Unicode-normalized collision guard
 |      - generated-output reservation guard
 |
 +--> copy/cache static source into staging
 |
 +--> run Vite/Tailwind bundle into staging
 |
 +--> enforce performance budgets
 |
 +--> atomically promote staged output + cache
 |
 +--> release lock
```

Incremental builds seed staging from the prior successful output. Clean builds begin from empty staging. If mapping, bundling, budget validation, or promotion fails, the previous output remains deployable.

## Shopify mapping contract

Shopify deployable themes use flat root directories, with documented nesting only under `templates/customers` and `templates/metaobject`.

Liquid Loom therefore treats authoring organization and output organization separately:

- `layout`, `blocks`, `sections`, `snippets`, `config`, and `locales` flatten by filename;
- feature-oriented template folders flatten by filename into `templates`;
- `templates/customers/*` and `templates/metaobject/*` preserve their Shopify-supported nesting;
- deeper nesting inside those reserved template directories fails explicitly;
- `public/**` flattens into `assets`;
- Vite-reserved outputs such as `assets/theme.js` and `assets/style.css` cannot be claimed by static source.

The mapping plan canonicalizes destination keys with Unicode NFC and locale-independent lowercase comparison. Original display paths remain available in errors.

## Platform minimum

`validateThemeSource` checks the minimum Shopify currently requires for a theme upload: `theme/layout/theme.liquid` in authoring source, which maps to `layout/theme.liquid` in output.

The reference storefront also includes `config/settings_schema.json`, `templates/index.json`, and other files because the starter needs them. Those are starter capabilities, not framework-level platform requirements.

## Cache

The manifest records SHA-256 content hash, output path, and byte length for each mapped file. A file is skipped only when its hash and path match and the expected staged output exists. Stale outputs are removed through path-guarded manifest resolution.

## Configuration

`liquid-loom.config.ts`, `.mts`, `.js`, or `.mjs` is loaded from the consuming project. Defaults resolve against `process.cwd()`. Public type declarations provide editor completion without requiring TypeScript at storefront runtime.

## Packages and starter synchronization

- The repository root publishes `liquid-loom` and exposes CLI plus programmatic build APIs.
- `packages/create-liquid-loom` publishes the atomic scaffolder with an embedded starter.
- The root `src` tree is the reference storefront source.
- A test requires the embedded scaffolder `src` tree to remain byte-for-byte synchronized with the reference source.
- Package smoke validation installs the packed CLI into a newly generated project and runs a real production build.

The duplicated embedded template is intentionally guarded rather than reorganized before `0.1.0`. A single-source-of-truth packaging refactor should happen only if it simplifies the published package without making release mechanics harder.

## Extension strategy

Prefer explicit configuration and small programmatic APIs. New framework hooks are not a `0.1` goal.

A new source category or extension point should only be added when it has:

1. a concrete Shopify use case;
2. mapping and collision semantics;
3. tests across the published package shape;
4. evidence from more than one consumer when the API broadens the public surface.

Store-specific behavior belongs in the consuming theme, not in framework core.
