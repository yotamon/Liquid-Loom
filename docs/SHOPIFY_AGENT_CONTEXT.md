# Shopify-native agent context

Liquid Loom supports Shopify's optional theme-root `AGENTS.md` and `DESIGN.md`. These files guide compatible coding agents and Shopify's Sidekick. Shopify does not render them as storefront templates.

## Start a new theme

The reference source ships `src/theme/AGENTS.md` and `src/theme/DESIGN.md`. They build into:

```text
dist/theme/AGENTS.md
dist/theme/DESIGN.md
```

The two files are included in the published scaffolder. Edit them for a real merchant: architecture guidance belongs in `AGENTS.md`; brand/design decisions belong in `DESIGN.md`. Keep both under **50 KB each**.

## Adopt an existing theme

When your `shopifySourceDir` points to a conventional Shopify theme, native root `AGENTS.md` and `DESIGN.md` are preserved. You may instead author them in `src/theme/`, but don't keep both copies: Liquid Loom rejects duplicate ownership of the same Shopify output. Wrong-case native names such as `agents.md` or `Design.md` are rejected rather than silently omitted.

The ownership model also reports the pair as the `theme-context` feature, available from `liquid-loom explain theme-context --json`.

`liquid-loom watch` and `liquid-loom dev` also watch native root context files **when they exist at startup**. If you add one of these files while watch mode is running, restart watch mode to include it. Other repository-root files are not watched.

## Deployment and round trips

Shopify CLI **4.8.4+** includes these root files in theme push, pull, and package. The opt-in deployment-branch workflow copies them from compiled output too, rather than leaving them on the authored branch.

Shopify's GitHub integration can sync edits in both directions, but **Liquid Loom's compiled source branch is not losslessly bidirectional**. If a merchant or Sidekick edits `DESIGN.md` in Shopify, pull and reconcile the changed file into the authoritative organized source before the next deployment. Review generated-branch commits first, especially if Shopify's Theme Editor changed theme settings.

## Security and boundaries

These Markdown files travel to Shopify. **Do not put credentials, client secrets, internal URLs, merchant PII, or confidential engineering instructions in them.** They are guidance, not access controls or guaranteed agent behavior.

Root `AGENTS.md` is different from `templates/agents.md.liquid`, the optional storefront page for shopping agents.

Source: [Shopify agentic workflows for themes](https://shopify.dev/docs/storefronts/themes/agentic-workflows).
