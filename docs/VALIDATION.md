# Validation plan

Liquid Loom already has strong repository-level validation and a provenance-backed public npm release. The next risk is product risk: whether Shopify developers actually prefer this workflow on real projects.

`0.1.x` should optimize for evidence, not framework breadth.

## Release evidence

Current evidence:

- [x] `liquid-loom` and `create-liquid-loom` published through npm Trusted Publishing;
- [x] packed-package consumer smoke in CI, including both CLI binaries and a fresh production build;
- [ ] one clean install from the public npm registry into a new project;
- [ ] one real Shopify development-store preview using the generated `dist/theme`;
- [ ] at least three external Shopify developers completing setup, one source edit, one rebuild, and one live preview;
- [ ] one short case study comparing the workflow with a conventional flat theme repository.

Do not treat stars, README views, or package-page visits as substitutes for these workflow outcomes.

## Early-adopter session

Ask each tester to perform the same small task without coaching after installation:

1. create a Liquid Loom theme from the public scaffolder;
2. run a clean local build;
3. add a new feature-organized section such as `src/theme/sections/marketing/promo-banner.liquid`;
4. build the theme and confirm `dist/theme/sections/promo-banner.liquid` was produced;
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

The public [first-project feedback form](https://github.com/yotamon/Liquid-Loom/issues/new?template=early_adopter_feedback.yml) mirrors these questions so feedback from unmoderated trials is comparable with guided sessions.

Do not add a framework feature just because one tester asks for it. Look for repeated needs.

## Adoption funnel

For the first users, prefer a small set of observable milestones over vanity metrics:

1. developer discovers the project;
2. developer runs the public scaffolder;
3. first local build succeeds;
4. developer makes one source edit and understands the generated Shopify output;
5. live preview succeeds against a development store;
6. developer returns for a second session or says they would use Liquid Loom on the next custom theme.

The first meaningful target is not hundreds of installs. It is roughly ten developers reaching a successful scaffold, five reaching a real Shopify preview, and at least two independently choosing the workflow again.

Do not add invasive product telemetry just to measure this phase. Use npm download trends as a weak discovery signal and collect qualitative workflow evidence through issues, Discussions, and early-adopter sessions.

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
