# Shopify development-store browser acceptance

This is an **opt-in** Playwright smoke test of a **non-production development store**. It does not publish a theme, place an order, or use Shopify Admin APIs. It may add a test product to the browser session's cart. It must never be pointed at an unknown merchant's production storefront.

## Before running

1. Create or identify a Shopify development store you control. Preview Liquid Loom's compiled theme as an unpublished theme.
2. Add at least one **purchasable** test product with a unique, searchable name. Keep a separate test product with more than 250 variants, invalid option combinations, selling plans, and variant-specific images for the broader manual matrix in [Validation](VALIDATION.md).
3. Confirm the preview URL, product URL path and a two-character-or-longer search phrase that produces predictive search suggestions.
4. Create a protected GitHub environment named `shopify-dev`, ideally requiring a reviewer. Add a secret `LIQUID_LOOM_DEV_STORE_URL` containing the exact preview URL and (only if needed) `LIQUID_LOOM_DEV_STOREFRONT_PASSWORD`.
5. Add environment variables `LIQUID_LOOM_DEV_PRODUCT_PATH` (e.g. `/products/fixture`) and `LIQUID_LOOM_DEV_SEARCH_TERM` (a query matching a seeded product). For option-value refresh verification, also set `LIQUID_LOOM_DEV_OPTION_VALUE_ID` and `LIQUID_LOOM_DEV_EXPECTED_VARIANT_ID` as a matched pair.

Do not use production admin tokens, personal data, live orders, or real customer account credentials. The smoke deliberately does not place a checkout order.

## Run

In GitHub Actions, open **Protected Shopify development-store browser smoke**, select **Run workflow**, and explicitly confirm that the configured target is a **non-production development store**. The job installs Playwright in an isolated temporary runner, uses environment secrets, and runs `tests/shopify-browser-smoke.mjs` without modifying published themes or npm packages.

To run locally, install Playwright in a separate temporary working directory, copy `tests/shopify-browser-smoke.mjs` into it, and set the same environment variables. Set `LIQUID_LOOM_DEV_STORE_CONFIRMED=true` only after verifying the target. The script imports `playwright` dynamically, so it is **not** a dependency of the Liquid Loom framework or its normal CI.

## Checks

- Home page renders the standard main landmark.
- Product page renders a visible title and identified variant.
- Optional, explicitly identified option-value ID resolves the **expected** variant.
- Predictive search suggestions support ArrowDown and Escape without losing input semantics.
- A purchase form adds a product to the session cart; cart renders the line item (no checkout).
- JavaScript-disabled product options do not misleadingly present inert choices, and the exact selected variant remains identified when choices exist.
- No uncaught JavaScript page errors in the browser context.

The no-JavaScript purchase assertion will remain **blocked on the draft product hardening PR #50** until its runtime behavior is accepted. This script is a smoke test, not a complete accessibility audit, a performance benchmark, or proof that all 250+ variants work. The broader manual matrix in [Validation](VALIDATION.md) remains required.

## Record evidence

Attach the GitHub run URL, tested theme commit, store fixture description (without secrets), successful/failed steps, unsupported scenarios and browser version to [issue #13](https://github.com/yotamon/Liquid-Loom/issues/13). Do not close the issue just because the script exits successfully. Note any merchant app interactions, selling-plan allocation prices, Theme Editor writes, localization and accessibility checks separately.
