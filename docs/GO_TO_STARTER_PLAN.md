# Liquid Loom: go-to Shopify-native theme starter implementation plan

> **Status:** Proposed implementation roadmap, 2026-11-10. **Tracking:** [Epic #36](https://github.com/yotamon/Liquid-Loom/issues/36). Engineering implementation in the tickets below has **not** been completed by this planning PR.

## 1. Product decision

**North star:** Be the natural starting point for Shopify theme developers and small agencies building custom, merchant-editable Liquid themes. Deliver exceptional default UX, fast first preview, deterministic builds, and safe agent assistance while preserving Shopify's runtime and tools.

**Primary developer:** Shopify freelancer or small/medium agency engineer working on custom merchant themes. **Secondary:** teams incrementally adopting better tooling in an established theme. **Not the target:** headless storefronts, a competing Liquid runtime, mandatory React/Vue, or a drop-in Theme Store-approved commercial theme.

**Product promise:** 'Shopify-native custom themes, with a starter worth keeping and an engineering workflow worth trusting.' Not merely 'Liquid + Vite + Tailwind'.

### Why this approach

- Shopify CLI and official starter themes already cover minimal bootstrapping and platform deployment. Differentiate on developer workflow and a polished, genuinely useful custom-theme foundation rather than reimplementing those tools.
- Liquid Loom already has incremental existing-theme `init`, deterministic one-owner output, transactions, migration, `doctor` / `check` / `explain`, agent-readable static project metadata and pack-tested scaffolds. Protect those assets.
- A passing CI build and Theme Check are **not** real-store evidence. Shopify merchant editor, option selection, cart actions, localization, and theme deployment must be evaluated in Shopify itself.
- A public client case study is **not required**. Use a reproducible dev-store demo, honest metrics, and independent developer trials until a real client case study is available.

## 2. Verified baseline and known gaps

| Area                | Current repo state                                                                                                                    | Necessary proof or change                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Source/build core   | Dual source, collision detection, transactional staging, migration and project-model APIs implemented                                 | Preserve invariants and backwards-compatible consumer behavior                                                    |
| Reference commerce  | Shopify-native blocks and standard actions; #35 merged high-variant option values and search work                                     | No-JS product safety, invalid-option states, failure handling, browser/history and cart/runtime testing           |
| Release pipeline    | Packed-package smoke, cross-platform CI and Trusted Publishing documented                                                             | Independent unauthenticated npm registry checks, provenance and current public package/version verification (#12) |
| Real-store evidence | Not recorded as complete                                                                                                              | Shopify dev-store fixture, merchant editor, live buyer smoke and recorded evidence (#13)                          |
| Starter onboarding  | Create and existing-theme init paths exist                                                                                            | Measure/fix friction from installation through first preview on actual consumers                                  |
| Shopify agent files | `AGENTS.md` / `DESIGN.md` absent from reference source; theme discovery currently constrained to canonical directories                | Support exact-case root Markdown files through build and deployments (#44)                                        |
| Docs/versioning     | Manifest versions 0.2.0; roadmap includes internally implemented later work; architecture doc incorrectly calls Vite/Tailwind default | Reconcile code, marketing claims, current release and public registry (#47)                                       |
| External adoption   | Three independent Shopify developer sessions not recorded complete                                                                    | Pilot and repeat-usage evidence (#14, #48)                                                                        |

Baseline is code/documentation inspection, not a claim about live npm registry versions or completed merchant-store acceptance.

## 3. Non-negotiable engineering principles

1. Standard Shopify Liquid, Theme Editor, CLI, theme blocks and native assets remain authoritative. No invented storefront or cart runtime.
2. Every Shopify output path has exactly one owner; source collisions, Unicode and case conflicts always fail safely.
3. Transactional build, last-known-good output, migration identity, cross-platform portability and existing-theme zero-migration adoption never regress.
4. Offline build remains possible without credentials. Never put private store credentials or merchant data into example fixtures or public CI.
5. Native CSS/JS is the default; Vite and Tailwind are optional. Keep starter dependency weight proportional to value.
6. Browser and Shopify acceptance must verify behavior, not replace tests with static grep/assertions.
7. AI context assists developers but is not a correctness guarantee. `explain --json` reports only provable static relationships.
8. A small set of polished, accessible merchant-editable patterns beats a huge component catalog.
9. Changes land in small PRs tied to tickets. Optimize for functional increments; do not burn CI cycles on every intermediate commit.

## 4. Release gates and execution order

Releases are **outcome-based**. The A/B/C/D labels are roadmap gates, **not semver promises**. Decide version numbers from actual published registry state, breaking changes and proven acceptance.

### Gate A: trusted Shopify runtime (release blocker)

**Outcome:** Safe real-store purchase and navigation flows, with measured accessibility/performance and documented limitations.

| Order | Ticket                                                  | Deliverable                                                                                              |
| ----- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A0    | [#13](https://github.com/yotamon/Liquid-Loom/issues/13) | Dev store + seeded fixture, reproducible manual acceptance, then opt-in browser smoke                    |
| A1    | [#37](https://github.com/yotamon/Liquid-Loom/issues/37) | No-JS/invalid-option safe purchase; option-value selection, cart failure and browser navigation coverage |
| A2    | [#38](https://github.com/yotamon/Liquid-Loom/issues/38) | End-to-end buyer flows: product, collection/search, cart, responsive controls and editor states          |
| A3    | [#39](https://github.com/yotamon/Liquid-Loom/issues/39) | Repeatable mobile/desktop performance + accessibility evidence                                           |

**A exit:** Real Shopify dev store proves there is no wrong-variant purchase, missing critical cart path, or critical navigation/accessibility blocker. Theme Editor product block reordering, app blocks, English/German search and account settings are validated. Core smoke is reproducible. Scores and any remaining limitations are linked.

**Fixture matrix:** normal / sold-out / unavailable product; 250+ variants with later selections; nonexistent option combinations; combined listing when supported; multiple option dimensions; different prices/images; selling plan; changed quantity; JS disabled; slow/failing Section Rendering; stale/cancelled requests; browser Back; predictive search keyboard/locale; filters and pagination; empty cart/search; customer accounts on/off; app blocks; merchant changes; mobile and desktop.

**Separation:** public CI remains credential-free. Run Shopify-backed browser tests only via manually triggered or protected secret-backed workflows. Do not claim production certification from Shopify Theme Check.

### Gate B: best daily-driver starter (release blocker except B4 optimization)

**Outcome:** A developer can create or adopt a theme, make a real change, preview and deploy with less friction than a hand-assembled stack.

| Order | Ticket                                                  | Deliverable                                                                          |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| B1    | [#40](https://github.com/yotamon/Liquid-Loom/issues/40) | Measured installation, first-run preflight, store auth and existing-theme onboarding |
| B2    | [#41](https://github.com/yotamon/Liquid-Loom/issues/41) | Small polished starter pattern set and merchant-editable tokens                      |
| B3    | [#42](https://github.com/yotamon/Liquid-Loom/issues/42) | Actionable, deterministic troubleshooting from real failure transcripts              |
| B4    | [#43](https://github.com/yotamon/Liquid-Loom/issues/43) | Optional native/Vite/Tailwind presets and lighter default install                    |

**B exit:** Fresh and existing-theme quickstart commands work from packed consumers. Developer can edit a block/section, see Shopify preview, and understand mapped output. Existing theme is not rewritten or forced to change asset pipeline. The pattern showcase looks coherent on small screens, is keyboard accessible and merchant editable. B4 may ship in a following compatible release if its dependency refactor is risky.

**Target onboarding outcomes (proposed, not measured):** median first preview <=10 minutes for pre-authenticated devs; >=90% successful first build in evaluated supported environments; record failures with denominator and setup state. Compare at least five fresh trials and three existing-theme trials before calling the targets met.

### Gate C: Shopify-native agent context and safe deployment

**Outcome:** A developer or compatible coding agent can understand the project and carry design conventions into the real Shopify theme.

| Order | Ticket                                                  | Deliverable                                                                                                         |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| C1    | [#44](https://github.com/yotamon/Liquid-Loom/issues/44) | Exact-case theme-root `AGENTS.md` and `DESIGN.md` through mapping, ownership, scaffold, build, package and CLI flow |
| C2    | [#45](https://github.com/yotamon/Liquid-Loom/issues/45) | Tested opt-in compiled branch deployment and merchant-editor drift policy                                           |

**C exit:** `dist/theme/AGENTS.md` and `dist/theme/DESIGN.md` are preserved, with case/size protections and no leaked secrets. Test Shopify CLI >=4.8.4 and Shopify GitHub sync against a real store. Confirm these are optional root-level developer context files (<=50 KB each), distinct from `templates/agents.md.liquid` used for customer-facing shopping agents. Safe deployments do not force-push or pretend generated source can reverse-sync Theme Editor writes.

**Agent validation:** Compare a fixed small task with and without local context (same source/project); inspect incorrect file edits and unnecessary file reads, but avoid claiming statistical improvements from one demonstration.

### Gate D: public credibility and developer adoption

**Outcome:** Honest docs/showcase, reliable registry releases, independent Shopify developers choosing Liquid Loom again.

| Order | Ticket                                                                                                            | Deliverable                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| D1    | [#47](https://github.com/yotamon/Liquid-Loom/issues/47) + [#12](https://github.com/yotamon/Liquid-Loom/issues/12) | Version/changelog/documentation reconciliation and independent public npm/provenance validation |
| D2    | [#46](https://github.com/yotamon/Liquid-Loom/issues/46)                                                           | New-project-first README, usable docs and verified demo storefront/screenshots/tutorial         |
| D3    | [#14](https://github.com/yotamon/Liquid-Loom/issues/14) + [#48](https://github.com/yotamon/Liquid-Loom/issues/48) | Independent pilot, funnel feedback and repeat adoption evidence                                 |

**D exit:** Both public packages can be installed from the registry by an unauthenticated consumer; provenance, version and release notes agree; a real demo is viewable; three independent devs complete a full real workflow; recurring blockers are addressed. Expand to ten participants and repeat-use evidence after initial acceptance. A client case study is a nice-to-have, not a launch gate.

**Release safety:** Only explicit manual approval can publish npm, write a merchant production theme or merge breaking changes. Validate the intended release from its packed/published artifacts; run final heavy CI once per PR/final candidate instead of on every small commit.

### Deferred until evidence

- [#15](https://github.com/yotamon/Liquid-Loom/issues/15): starter source and type declaration consolidation. Existing byte-for-byte sync tests are sufficient unless maintenance cost is observed.
- General-purpose plugins/hooks, arbitrary source mapping, a visual component marketplace, auto-PR writing agents, cross-store credentials, headless runtime and paid-theme parity.
- Full customer case study, unless a willing real customer and permission exist.

## 5. Critical path and parallel work

```text
Dev store and fixture (#13)
  -> Purchase correctness (#37)
  -> Buyer journeys (#38) -> Merchant-ready patterns (#41) -> Demo/docs (#46)
  -> Accessibility/performance (#39) ----------^

Public package verification (#12)
  -> First run and setup (#40) -> Better diagnostics (#42) -> Docs (#46)
  -> Version/release readiness (#47) ------------------------^

Root agent context (#44) -> Safe compiled deployment (#45)
                                  |
Docs/demo (#46) + onboarding (#40) -> external pilots (#14/#48)
                                  |
                           PUBLIC RELEASE DECISION
```

Work in parallel where independent: A runtime fixes + B onboarding + C context mapping + D documentation baseline. Do not start polish/release marketing before fundamental product/cart correctness is proven.

## 6. Validation and definition of done (applies to each implementation ticket)

**Code:** file-by-file scope and public API impact identified; no silent output changes; root `src` and embedded scaffolder copy agree; docs and types updated where relevant.

**Testing:** focused unit/integration tests for change, negative and rollback paths; packed consumer test for CLI/scaffolder changes; Theme Check, full clean build and cross-platform matrix at final PR validation; browser/store evidence when behavior depends on Shopify.

**Security/privacy:** no secrets or merchant PII in public fixtures/logs; no forced telemetry; protect output paths and external-command inputs; preserve safe migration semantics.

**UX:** clear error states, accessibility and localization considerations, non-JS fallback, merchant editor behavior, mobile handling where applicable.

**Documentation:** commands executed against actual package/fixture; release notes distinguish implemented/unreleased/published; note user actions (store login, credentials, deployment).

**PR discipline:** preferably one focused issue per PR; mark blocked tests openly; implement first, avoid CI-heavy loops, run focused checks early and full quality gate at end. Never silently merge release blockers based solely on local tests.

## 7. Scorecard and measurement method

| Metric                      | Calculation/source                                                                                                     | Target / interpretation                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| First-preview time          | First correct command to successful Shopify dev preview, with preconfigured store auth; report median and distribution | <=10 minutes; do not mix auth-setup time without labeling                                           |
| Clean first build           | Successful build / attempted first builds, per OS/Node/package manager                                                 | >=90% among evaluated supported environments; disclose sample size                                  |
| Buyer-flow pass rate        | Verified critical scenarios / applicable critical scenarios on seeded dev store                                        | 100% critical scenarios before public production-ready wording                                      |
| Accessibility               | Lighthouse/axe + manual keyboard/reader sampling, mobile and desktop, representative real content                      | Aspirational controlled >=90 accessibility per core page; fix critical violations                   |
| Performance                 | Repeated Lighthouse runs and Core Web Vitals, record network/content/device settings                                   | Controlled mobile target >=75 per core page, no regressions; never claim this is field data         |
| Independent adoption        | Completed first edit+preview, second project/session, and specific qualitative blockers                                | 3 independent full pilots as minimum, 10 next, aim for >=5 voluntary repeat uses (nonblocking goal) |
| Packaging/release integrity | Public npm versions + provenance + clean consumer install/build, both packages                                         | 100% required release checks                                                                        |

No hidden analytics. Start with voluntary structured notes and issue feedback; aggregate and anonymize. If future opt-in telemetry is proposed, review privacy and data collection explicitly first.

## 8. Go/no-go decision record

For each gate, record date, tested commit/version, store fixture/environment (where applicable), linked evidence, unresolved defects, owner decision and clear go/no-go. If blocked by access to a Shopify dev store, keep static engineering progressing but do **not** label the runtime gate complete.

Do not close #12, #13 or #14 because CI was green. Do not launch a new public npm release because code was merged. No Shopify production deployment without explicit merchant owner approval.

## 9. Reference contracts (recheck when implementing)

- [Shopify CLI for themes](https://shopify.dev/docs/storefronts/themes/tools/cli)
- [High-variant product option values](https://shopify.dev/docs/storefronts/themes/product-merchandising/variants/support-high-variant-products)
- [Theme agent context (`AGENTS.md`, `DESIGN.md`)](https://shopify.dev/docs/storefronts/themes/agentic-workflows)
- [Theme performance best practices](https://shopify.dev/docs/storefronts/themes/best-practices/performance)
- [Theme accessibility](https://shopify.dev/docs/storefronts/themes/best-practices/accessibility)
- [Shopify Theme Store requirements](https://shopify.dev/docs/storefronts/themes/store/requirements): benchmark thresholds provide context, not certification for Liquid Loom.

## 10. First PR batch to start implementing

1. #37: eliminate the wrong-variant purchase risk and lock down no-JS/failure behavior.
2. #13: establish a real development-store fixture and manual buyer smoke; add automation only after auth and fixture are stable.
3. #40: instrument and simplify first install/preview, including package managers and actionable preflight.
4. #44: root context files and ownership mapping; can proceed independently once output contract is verified.
5. #47: correct documented versions/defaults early so the public surface does not overclaim current release state.

**Owner actions required before Shopify-specific acceptance:** provide/authorize a development store, choose a non-production preview theme, make relevant products and test settings available, and approve any future npm publish or production deployment. Everything else can be prototyped and unit-tested without store access.

---

**Scope control:** This document is a plan, not a claim that any open ticket has shipped. Update the gate scorecard and links as individual PRs land.
