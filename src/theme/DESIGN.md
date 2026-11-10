# Storefront design intent

## Purpose

This starter is a calm, merchant-neutral foundation for modern storefronts. It should make product imagery, product information and buying controls feel trustworthy and legible while leaving brand choices to the merchant.

## Design rules

- **Brand voice:** concise, welcoming and product-forward. Do not invent discounts, shipping policies, reviews or scarcity claims.
- **Colors:** use the merchant's `color_palette` settings and semantic CSS variables: `--color-background`, `--color-foreground`, `--color-surface`, `--color-muted`, `--color-border`, `--color-accent`, `--color-accent-contrast`. Never hard-code a brand palette in a component.
- **Typography:** keep the existing system/sans-serif stack unless the merchant changes it. Establish hierarchy with the existing heading, eyebrow and body styles.
- **Layout:** respect `--page-width` and the `.page-width` container. Use generous but responsive whitespace. Keep product media prominent on desktop and controls readable on small screens.
- **Shape:** respect `--radius-sm`, `--radius-md`, `--radius-lg` and `--shadow-soft`; do not create a competing token system.
- **Components:** use the existing `.button`, `.field`, `.product-card` and `.section` conventions. Make states visible: loading, unavailable, sold out, empty and error.
- **Motion:** subtle, functional transitions only. Honor reduced-motion preferences and never rely on animation to convey state.
- **Accessibility:** retain visible keyboard focus, semantic labels, adequate contrast, accessible status messages, and readable tap targets.

## How to evolve this file

Treat these as defaults, not a brand identity. When a merchant supplies visual direction, record the specific design decisions and their reasons here, and then implement them through supported Shopify settings and source. Do not claim a visual token is adjustable unless Theme Editor actually exposes it.
