# Theme architecture and agent guidance

This file describes the **deployed Shopify theme**. It ships with the theme and is accessible to Shopify's coding assistants. Do not include merchant secrets, internal URLs, credentials, private customer data, or repository-only instructions.

## Non-negotiables

- Shopify Liquid, Online Store 2.0, native theme blocks, app blocks, and Theme Editor are the runtime and composition model. Do not invent a client-side application framework.
- Preserve JSON templates, section and block schemas, merchant settings, translations, and native Shopify form/cart behavior.
- Build product options from `product.options_with_values` and `option_values` requests. Shopify limits `product.variants` enumeration to 250; never depend on enumerating every variant.
- Keep keyboard focus, screen-reader status, contrast, reduced-motion preferences, and a safe no-JavaScript purchase fallback.
- Use Shopify's standard storefront events and actions when supported. Do not assume every store has custom action overrides.

## Composition

- Layout: `layout/theme.liquid`; page composition: `templates/*.json`; merchant-editable sections: `sections/`; reusable merchant-editable blocks: `blocks/`; static display helpers: `snippets/`.
- Prefer a theme block when the merchant should reorder or configure a component. Prefer a snippet for a reusable implementation detail.
- Use `{% stylesheet %}` and `{% javascript %}` in the relevant section or block for component-local behavior. Reserve global assets for global tokens and shared site-wide behavior.
- Put all buyer-visible text in locale JSON and keep supported locales in sync.

## Design

Read `DESIGN.md` before making visual changes. Use the theme's existing semantic CSS tokens and merchant-configured color palette, not hard-coded brand colors or unrelated UI libraries.

## Development workflow

The authored project may use Liquid Loom's feature-organized `src/theme/` source. The deployable output has standard Shopify directory names; do not edit generated `dist/theme/` files as the authoritative source. Before editing organized source, use `liquid-loom explain [feature] --json` when that CLI is available. Confirm the output ownership, then make the smallest Shopify-compatible edit. Run `liquid-loom check`, a build, Shopify Theme Check and real-store preview for behavior that depends on Shopify.

This theme-level file is separate from the optional public `templates/agents.md.liquid` storefront page for shopping agents.
