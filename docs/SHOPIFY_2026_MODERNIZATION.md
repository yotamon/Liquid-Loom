# Shopify 2026 platform modernization

Liquid Loom's core architecture still fits Shopify theme development in 2026: it keeps Liquid and Shopify CLI authoritative, produces a canonical Shopify theme, makes output ownership explicit, and lets established themes adopt tooling without an up-front rewrite.

The next modernization step is therefore not a framework rewrite. It is a change in **defaults and reference architecture** so that fresh Liquid Loom projects demonstrate Shopify's strongest current theme primitives instead of treating Vite + Tailwind as the center of the product.

This plan builds on the `0.3` project-intelligence work. The deterministic project model, `explain`, explicit `shopifyLiquidMode`, and preview-aware diagnostics remain part of the foundation.

## Decision

Liquid Loom should be described as:

> A deterministic engineering layer for Shopify Liquid themes: safer source architecture, incremental adoption, agent-readable project understanding, modern Shopify-native composition, and optional advanced asset tooling.

Vite and Tailwind stay supported. They stop being the default explanation for why Liquid Loom exists.

## Core invariants that do not change

1. Liquid remains the storefront runtime.
2. Shopify CLI remains the canonical preview/deploy tool.
3. `dist/theme` remains a normal, inspectable Shopify theme.
4. Every deployable Shopify path has exactly one source owner.
5. Ownership is planned and validated before publish.
6. Failed builds never replace the last-known-good output.
7. Existing themes can adopt Liquid Loom without moving source.
8. Migration remains preview-first and preserves Shopify output identity.
9. Existing Sass/PostCSS/Webpack/Vite/Tailwind pipelines remain valid for adopted themes.
10. The project model reports provable relationships rather than evaluating or guessing Liquid.
11. Developer-preview Shopify syntax never becomes a stable requirement implicitly.

## Target architecture

```text
authored Shopify/Liquid source
        |
        +-- native component assets
        +-- theme blocks / app blocks
        +-- optional Vite or Tailwind assets
        +-- explicit stable/preview Liquid mode
        |
        v
Liquid Loom
        |
        +-- ownership plan
        +-- project intelligence
        +-- diagnostics
        +-- transactional build
        +-- migration safety
        |
        v
canonical Shopify theme
        |
        +-- Shopify CLI preview/push
        +-- compiled GitHub deployment branch/repo
```

## 1. Shopify-native component assets become the fresh-project default

Shopify supports `{% stylesheet %}` and `{% javascript %}` in sections, blocks, and snippets. Shopify now subsets stylesheet-tag CSS by the current page render tree, making component-local CSS a real platform feature rather than just a source-organization convention.

### Target

Fresh projects should prefer component-local assets for component-local behavior:

```liquid
{% stylesheet %}
	.product-card { ... }
{% endstylesheet %}

{% javascript %}
	customElements.define(...)
{% endjavascript %}
```

Global CSS should remain only for genuinely global concerns such as base styles, typography, design tokens, shared layout primitives, accessibility defaults, and intentionally global utilities.

### Vite and Tailwind

Vite and Tailwind remain first-class supported integrations, but they become explicit asset strategies instead of the architectural default.

A future scaffolder can expose a small choice such as:

```text
native      Shopify-native component assets + minimal global assets
vite        Vite for projects that need bundling/modules
 tailwind   Tailwind + Vite for teams that intentionally choose it
```

Do not introduce a generic asset plugin API merely to support these three paths.

### Acceptance criteria

- a default fresh scaffold builds without requiring a storefront Vite bundle;
- component CSS/JS is colocated with its Liquid component where practical;
- global assets are intentionally small and documented;
- Vite and Tailwind remain tested supported paths;
- existing-theme `init` continues to preserve the current asset pipeline.

Reference: <https://shopify.dev/docs/storefronts/themes/best-practices/javascript-and-stylesheet-tags>

## 2. Theme blocks become the primary reference composition model

Liquid Loom already understands root `blocks/*.liquid`, block references, app blocks, and preview block relationships. The reference storefront should now demonstrate that model deeply rather than treating blocks as a small flexible-content example.

### Product page target

Move the product page toward merchant-reorderable components:

```text
Main product
|
+-- Product media
+-- Product information group
|   +-- Vendor
|   +-- Title
|   +-- Price
|   +-- @app
+-- Variant picker
+-- Purchase group
|   +-- Quantity
|   +-- Buy buttons
|   +-- @app
+-- Description
```

The decomposition should stay intentionally small and Shopify-native. Liquid Loom should not invent its own component runtime or schema abstraction.

### Acceptance criteria

- merchants can reorder the supported product information blocks in Theme Editor;
- expected surfaces accept `@app` blocks;
- reusable content primitives are theme blocks where reuse creates merchant value;
- source continues to map through the existing organized-source ownership contract;
- no-JavaScript fallbacks and accessible markup remain part of the reference theme.

## 3. Standard storefront events and actions

Shopify now provides a standard communication layer between Liquid storefronts, apps, and agents. The reference storefront should speak that protocol rather than forcing integrations to inspect custom DOM or intercept requests.

### Stable scope

Implement the relevant documented events for interactions owned by the reference storefront, including appropriate page, product, collection, search, and cart events.

Use Shopify standard actions as the integration contract. Override an action only when the reference theme can provide a better local UI than Shopify's safe default behavior.

These events are not an analytics system. Analytics stays on Shopify Web Pixels.

### Acceptance criteria

- events follow Shopify's documented payload contracts;
- action overrides retain Shopify-compatible fallback behavior;
- integrations do not depend on undocumented DOM conventions or global `fetch` interception;
- event/action behavior is included in real-store/browser smoke coverage.

References:

- <https://shopify.dev/docs/storefronts/themes/best-practices/standard-events-and-actions>
- <https://shopify.dev/docs/api/storefront-events-and-actions/events>
- <https://shopify.dev/docs/api/storefront-events-and-actions/actions>

## 4. Adopt `color_palette` for the reference design-token model

Shopify recommends `color_palette` for new themes and is focusing future color-system development there.

### Target

The reference theme should define one semantic palette in `settings_schema.json`, for example:

```json
{
	"type": "color_palette",
	"id": "colors",
	"default": {
		"background": "#F8F7F2",
		"foreground": "#111820",
		"surface": "#FFFFFF",
		"accent": "#176C5B",
		"accent_contrast": "#FFFFFF"
	}
}
```

Section/block color controls can reference palette entries as defaults while remaining locally overrideable.

CSS custom properties remain the runtime design-token bridge. This keeps the rendered theme inspectable and works equally well with native CSS, Vite, or Tailwind.

Reference: <https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings>

## 5. Modern customer accounts

The reference header should use Shopify's `<shopify-account>` storefront component whenever customer accounts are enabled.

### Target

- render the component in a location available on desktop and mobile;
- expose the menu through a merchant setting with `customer-account-main-menu` as the default;
- customize only through supported CSS variables, parts, and slots;
- render nothing account-specific when customer accounts are disabled.

Reference: <https://shopify.dev/docs/storefronts/themes/customer-engagement/account-component>

## 6. First-class compiled GitHub deployment workflow

Liquid Loom repositories can contain authored `src`, tests, package metadata, configuration, and build tooling. Shopify's GitHub theme integration only connects correctly to a branch that already has canonical Shopify theme structure.

That constraint should become a supported Liquid Loom workflow instead of tribal knowledge.

### Target model

```text
main / feature branches
|
+-- authored source
+-- Liquid Loom config
+-- tests and tooling
|
+-- CI: validate + build
        |
        v
shopify-production branch (or deployment repo)
|
+-- assets/
+-- blocks/
+-- config/
+-- layout/
+-- locales/
+-- sections/
+-- snippets/
+-- templates/
        |
        v
Shopify GitHub integration
```

### Deliverables

- documented deployment-branch and deployment-repository strategies;
- an opt-in generated GitHub Actions workflow or maintained recipe;
- validation before publishing compiled output;
- loop protection for Shopify-originated commits on a connected branch;
- explicit guidance for teams that allow Theme Editor/code-editor changes to write back into GitHub;
- no hosted Liquid Loom deployment service.

Reference: <https://shopify.dev/docs/storefronts/themes/tools/github>

## 7. Shopify CLI 4.8+ development-store workflow

Shopify CLI 4.8 added `shopify store` commands for creating, listing, inspecting, and deleting dev stores. Liquid Loom should align its real-store validation guidance with that workflow.

### Target

Document and optionally script an opt-in flow such as:

```text
shopify store create dev --demo-data
        |
        v
liquid-loom build
        |
        v
shopify theme dev --path dist/theme
        |
        v
browser smoke
        |
        v
shopify store delete
```

Public CI must continue to work without Shopify credentials. Real-store automation belongs in protected/opt-in workflows.

Reference: <https://shopify.dev/docs/storefronts/themes/tools/development-stores>

## 8. Agent-friendly contracts build on `0.3`, not around Shopify

PR #25 added the deterministic project model, `explain`, JSON output, preview-aware relationships, and explicit `shopifyLiquidMode`. The modernization should extend that strategy rather than create a separate agent framework.

### Target

- keep `doctor`, `check`, and `explain` deterministic and script-friendly;
- ensure new block/component/deployment concepts appear truthfully in the project model where statically provable;
- add architectural diff/report features only if real agent or CI workflows demonstrate the need;
- prefer standard Shopify primitives so agents can use Shopify's own documentation and AI tooling;
- keep generated deployment output visibly disposable and authored source visibly authoritative.

A Liquid Loom-specific AI runtime or agent SDK is out of scope.

## 9. July 2026 Liquid preview remains explicit and experimental

Liquid Loom already supports explicit `stable` and `july-2026-preview` project modes and can report preview block/partial usage.

That is the correct policy for the modernization release.

### Policy

- do not scaffold `{% block %}` or `{% partial %}` by default;
- do not make preview syntax a stable build requirement;
- continue allowing a project to declare preview intent through `shopifyLiquidMode`;
- keep preview relationships visible to `explain` and diagnostics;
- validate preview recipes separately from stable release gates;
- reconsider the default only after Shopify publishes a stable contract.

Reference: <https://shopify.dev/docs/storefronts/themes/getting-started/developer-preview>

## 10. Existing-theme adoption must remain boring and safe

None of the platform modernization should force an established theme to refactor.

For existing themes:

- `liquid-loom init` still moves zero Shopify source files;
- current Vite/Tailwind/Sass/PostCSS/Webpack pipelines remain valid;
- native component asset tags can be adopted file-by-file;
- palettes remain optional;
- block refactors are never automatic;
- standard event/action integration is opt-in per interaction the project owns;
- migration continues to preserve output identity;
- stable mode remains the default unless preview intent is explicit.

This compatibility rule is non-negotiable.

## Implementation order for one modernization PR

The implementation should land as one coherent PR, but be built internally in dependency order so every commit remains understandable:

1. update platform-alignment docs, roadmap, and acceptance criteria;
2. update the supported Shopify CLI development-tool floor;
3. modernize palette/design-token and customer-account primitives;
4. refactor the reference storefront toward theme-block-first composition;
5. move appropriate component CSS/JS to Shopify-native tags;
6. preserve Vite/Tailwind as explicit tested asset paths;
7. implement standard storefront events/actions;
8. add compiled GitHub deployment workflow/recipe;
9. update project intelligence where new static relationships need representation;
10. expand tests, package smoke, and opt-in real-store/browser validation;
11. keep July-preview validation separate from the stable release gate.

## Compatibility rules for that PR

The implementation must not:

- change the deployable Shopify path for existing organized source;
- invalidate `0.2`/`0.3` projects merely because they use Vite or Tailwind;
- require migration in adopted themes;
- require Shopify credentials for normal unit/package CI;
- depend on preview-only Liquid syntax for stable fixtures;
- change source ownership precedence silently;
- introduce a second storefront runtime;
- hide the generated canonical Shopify theme;
- regress the deterministic project model or `explain --json` contract without an explicit versioning decision.

Any unavoidable breaking public API change requires an explicit migration note before merge.

## Validation matrix

### Public/local automated validation

- default fresh scaffold builds and passes Theme Check;
- optional Vite path builds and participates in generated-output collision checks;
- optional Tailwind path builds and participates in generated-output collision checks;
- reference and embedded starter remain synchronized;
- existing-theme `init -> hybrid build -> migrate -> build` remains green;
- packed-package smoke exercises the actual published artifact shape;
- native `{% stylesheet %}` / `{% javascript %}` content survives organized-source mapping unchanged;
- `explain --json` remains deterministic across repeated runs;
- stable fixtures require no Shopify developer preview.

### Real Shopify validation

- fresh scaffold previews against a dev store;
- product, cart, collection, and search flows work in the browser;
- required no-JavaScript fallbacks remain usable;
- product blocks can be reordered in Theme Editor;
- app blocks work in the intended surfaces;
- `<shopify-account>` works when accounts are enabled and disappears cleanly when disabled;
- palette edits propagate through semantic CSS tokens;
- standard storefront event payloads match Shopify contracts;
- the compiled deployment branch/repo is accepted by Shopify GitHub integration;
- Shopify-originated writes do not cause deployment loops.

### Adoption validation

Run the modernization against at least one established client-style theme while leaving its current asset pipeline untouched. The upgrade must provide value without requiring block, palette, native-asset, or preview migrations.

## Success criteria

The modernization is successful if a developer can accurately describe the project as:

> Shopify-native Liquid theme development with deterministic source ownership, safe adoption, agent-readable architecture, and modern platform defaults.

The next release should feel **more native to Shopify**, not more dependent on Liquid Loom-specific abstractions.

## Deferred work

Keep these deferred unless real usage earns them:

- broad plugin/hook systems;
- arbitrary source/mapping plugins;
- hosted deployment infrastructure;
- headless/Hydrogen support;
- React/Vue/Svelte storefront runtimes;
- a custom analytics layer;
- a Liquid Loom-specific AI agent runtime;
- stable defaults based on developer-preview Liquid syntax.
