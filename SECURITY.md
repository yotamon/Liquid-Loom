# Security policy

## Supported versions

Security fixes are applied to the latest version on the default branch.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting feature for this repository. Include:

- the affected command or file;
- a minimal reproduction;
- the expected and observed behavior;
- the practical impact;
- any suggested remediation.

Avoid including real store credentials, customer information, access tokens, or private storefront data in the report.

## Scope

Useful reports include unsafe filesystem behavior, path traversal, accidental secret inclusion, build-output corruption, dependency compromise, or storefront code that creates a meaningful client-side security risk.

Liquid Loom never needs Shopify credentials for `build`, `check`, `analyze`, `test`, or `public-ready`. Authentication is handled by Shopify CLI only when previewing or pushing a theme.
