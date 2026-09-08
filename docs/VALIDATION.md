# Validation plan

Liquid Loom already has strong repository-level validation. The next risk is product risk: whether Shopify developers actually prefer this workflow on real projects.

`0.1.x` should optimize for evidence, not framework breadth.

## Release evidence

Before calling the first release proven, collect all of the following:

- a published `liquid-loom` and `create-liquid-loom` package through npm trusted publishing;
- one clean install from the public npm package into a new project;
- one real Shopify development-store preview using the generated `dist/theme`;
- at least three external Shopify developers completing setup, one source edit, one rebuild, and one live preview;
- one short case study comparing the workflow with a conventional flat theme repository.

## Early-adopter session

Ask each tester to perform the same small task without coaching after installation:

1. create or clone a Liquid Loom theme;
2. add a new feature-organized section such as `src/theme/sections/marketing/promo-banner.liquid`;
3. build the theme;
4. confirm `dist/theme/sections/promo-banner.liquid` was produced;
5. trigger one deliberate filename collision and interpret the error;
6. run `pnpm doctor`;
7. preview the result with Shopify CLI.

Capture:

- setup friction;
- confusing terminology or commands;
- whether feature-oriented source feels materially better;
- whether the generated `dist/theme` model is easy to understand;
- any workflow the tool makes harder than a conventional theme repository;
- whether the developer would choose the tool for their next custom theme and why.

Do not add a framework feature just because one tester asks for it. Look for repeated needs.

## Case study template

Keep the public case study short and falsifiable:

### Project

- theme size and rough number of sections/snippets;
- solo developer or team;
- existing Shopify workflow.

### Before

- source organization;
- build tooling;
- recurring pain points;
- representative build time on the same machine.

### With Liquid Loom

- source organization;
- commands used;
- build time on the same machine;
- collision or failure behavior observed;
- what improved;
- what did not improve.

### Verdict

State who should use Liquid Loom and who should stay with a conventional Shopify theme structure.

## Browser smoke

A development-store browser smoke suite should be added after a stable test store and authentication strategy exist. The initial suite only needs to prove critical storefront behavior:

- home page renders;
- product page renders and variant selection works;
- add-to-cart succeeds;
- predictive search returns results;
- cart page renders the added line item;
- no uncaught browser errors occur during the flow.

Keep this opt-in for contributors without Shopify credentials. Do not make public CI depend on a private merchant or long-lived store secret.

## Decision gate for `0.2`

Do not prioritize plugin hooks, a recipe registry, or a broad extension API until external use identifies repeated extension needs. If early users mostly need migration help, diagnostics, or better docs, solve those first.
