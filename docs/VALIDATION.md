# Validation plan

Liquid Loom already has repository-level validation, packed-package consumer smoke, and provenance-backed npm releases. Product validation must now prove both supported adoption paths: starting fresh and adding Liquid Loom to an existing Shopify theme.

Do not treat stars, README views, or package-page visits as substitutes for workflow outcomes.

## Release evidence

Current release engineering evidence:

- [x] `liquid-loom` and `create-liquid-loom` publish through npm Trusted Publishing;
- [x] both packed CLI binaries execute from independent temporary installs;
- [x] a packed fresh scaffold completes a production build in CI;
- [x] a packed existing-theme fixture completes `init -> hybrid build -> migrate -> build` in CI;
- [x] package smoke runs on the protected release path;
- [ ] clean install of the current public version from the npm registry into a new project;
- [ ] clean install of the current public version into an existing Shopify theme;
- [ ] real Shopify development-store preview from a fresh scaffold;
- [ ] real Shopify development-store preview from an adopted existing theme;
- [ ] at least three external Shopify developers completing a real workflow;
- [ ] one concise before/after case study.

## Fresh-project session

Ask a tester to:

1. create a project from the public scaffolder;
2. run a clean local build;
3. add a feature-organized section;
4. confirm the expected `dist/theme` output;
5. trigger one deliberate filename collision and interpret the error;
6. run `doctor`;
7. preview with Shopify CLI.

Capture setup friction, source-model clarity, generated-output clarity, collision diagnostics, preview friction, and whether the developer would choose the workflow again.

## Existing-theme session

Use a real or realistic conventional Shopify theme repository. Ask the tester to:

1. run `liquid-loom init --dry-run` and explain what they expect to change;
2. apply `init` without moving any Shopify source;
3. build the untouched existing theme into `dist/theme`;
4. add one new feature under `src/theme` while keeping old source native;
5. build again and confirm both source layers are present;
6. trigger one native/organized ownership collision and interpret the error;
7. preview `liquid-loom migrate sections/<file>` without applying it;
8. apply one migration into a feature folder;
9. rebuild and verify the Shopify output path did not change;
10. run `doctor` and preview the merged output with Shopify CLI.

Capture:

- whether `init` feels safe enough for a client repository;
- whether namespaced `loom:*` scripts avoid disrupting the current workflow;
- whether keeping the existing asset pipeline lowers switching cost;
- whether the one-output/one-owner rule is understandable;
- whether migration preview creates enough confidence before file moves;
- whether incremental migration is actually preferable to a full reorganization;
- any repository shapes that the current theme detection does not handle;
- whether the developer would adopt Liquid Loom on an existing project.

## Safety regression matrix

The automated suite should continue proving:

- native and organized source can build together;
- unrelated repository files are not discovered as native theme source;
- collisions are detected across source layers;
- collision keys are case-insensitive and Unicode-normalized;
- Vite reservations participate in the same ownership plan when enabled;
- native root `.` with `dist/theme` is safe;
- output inside a managed Shopify directory is rejected;
- final plan validation accepts `layout/theme.liquid` from either source layer;
- hybrid manifests record source-layer identity;
- migrating ownership does not delete an unchanged output as stale;
- migration destinations that change Shopify output identity are rejected;
- existing migration destinations are rejected before moving files;
- failed multi-file migration attempts roll back completed moves;
- `init` refuses existing Liquid Loom configs and conflicting namespaced scripts;
- `init` preserves existing package metadata, scripts, dependencies, and Shopify source;
- disabled Vite is treated as an intentional mode, not as missing configuration;
- `doctor` warns about uncompiled `src/entrypoints` when Vite is disabled;
- Windows, macOS, Linux, Node 22, Node 24, and Node 26 canary remain covered.

## Adoption funnel

For early users, prefer observable milestones:

1. developer discovers the project;
2. developer chooses fresh or existing-theme adoption;
3. first local build succeeds;
4. developer makes one source edit and understands output ownership;
5. live Shopify preview succeeds;
6. developer returns for a second session or says they would use Liquid Loom again.

For existing themes, add two more milestones:

1. developer adopts Liquid Loom without migrating old source;
2. developer voluntarily migrates at least one file after receiving value from the hybrid workflow.

That distinction matters. A successful product should not require migration merely to justify the migration feature.

## Case study template

### Project

- theme size and approximate number of sections/snippets;
- solo developer or team;
- existing Shopify workflow and asset pipeline;
- fresh build or established client theme.

### Before

- source organization;
- build tooling;
- recurring pain points;
- representative build time on the same machine.

### Adoption

For an existing theme, record:

- files changed by `init`;
- Shopify files moved by `init` (expected: zero);
- native vs organized source counts;
- first new feature authored under `src`;
- migration steps, if any.

### With Liquid Loom

- commands used;
- build time on the same machine;
- collision/failure behavior observed;
- what improved;
- what became harder;
- whether existing asset tooling was preserved.

### Verdict

State who should use Liquid Loom and who should stay with a conventional Shopify theme structure.

## Browser smoke

A development-store browser smoke suite should be added once a stable test store and authentication strategy exist. The initial suite only needs to prove critical storefront behavior:

- home page renders;
- product page renders and variant selection works;
- add-to-cart succeeds;
- predictive search returns results;
- cart page renders the added line item;
- no uncaught browser errors occur.

Run the same suite against a fresh scaffold and an adopted existing-theme fixture when practical.

Keep this opt-in for contributors without Shopify credentials. Public CI should not depend on a private merchant or long-lived store secret.

## Decision gate after `0.2`

Do not prioritize broad plugin hooks merely because the dual-source implementation now has an internal source-layer model.

First learn whether real teams repeatedly need:

- additional source roots;
- custom mapping strategies;
- asset-pipeline integration hooks;
- migration transforms;
- machine-readable ownership/build reports.

Expose new framework surface only when repeated use justifies a stable public contract.
