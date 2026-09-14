# Project model

Liquid Loom can describe a Shopify theme as deterministic project data instead of asking developers or coding agents to infer the architecture from directory names alone.

The project model is intentionally a **read-only understanding layer**. It does not change Liquid, invent dependencies, or add a runtime abstraction on top of Shopify.

## CLI

Explain the whole project:

```bash
liquid-loom explain
```

Explain one semantic feature:

```bash
liquid-loom explain product
```

Use the deterministic machine-readable form for coding agents, CI, or other tooling:

```bash
liquid-loom explain --json
liquid-loom explain product --json
```

`explain` works from source. A build is not required first.

## What the model contains

The model describes:

- the source file that owns every Shopify output;
- native Shopify source and organized Liquid Loom source through the same view;
- semantic feature groups such as `product`, `collection`, `cart`, and `search`;
- static `render`, `include`, `section`, and preview `block` references;
- static `asset_url` references;
- section references declared by JSON templates and section groups;
- July 2026 preview `partial` regions;
- files using July 2026 preview `block` or `partial` tags;
- static references whose target is not present in the merged source plan.

A simplified model looks like this:

```json
{
  "version": 1,
  "liquidMode": "stable",
  "features": [
    {
      "name": "product",
      "files": ["src/theme/sections/products/main-product.liquid"],
      "outputs": ["sections/main-product.liquid"],
      "references": []
    }
  ],
  "files": [],
  "preview": {
    "blockTag": [],
    "partialTag": []
  },
  "unresolvedReferences": []
}
```

The actual JSON includes per-file references, partial regions, source kind, Shopify output type, and summary counts.

## Feature inference

For organized Liquid Loom source, the authored taxonomy is authoritative. For example:

```text
src/theme/sections/product/upsell.liquid
src/theme/snippets/product/price.liquid
src/theme/blocks/product/buy-buttons.liquid
```

are grouped under `product` while still producing conventional Shopify output paths.

For native existing-theme source, Liquid Loom uses conservative Shopify-oriented filename signals. A file such as `sections/main-product.liquid` can therefore join the `product` model before it is migrated into organized source.

This keeps `explain` useful during zero-migration adoption.

## Static analysis, not a Liquid interpreter

Liquid Loom only reports relationships it can prove from source text and JSON structure.

It deliberately does **not**:

- evaluate Liquid;
- execute JavaScript;
- fetch store data;
- guess dynamic snippet, section, block, or asset names;
- pretend an unresolved reference is valid;
- turn inferred relationships into build dependencies.

This boundary is important for coding agents. A smaller truthful model is safer than a richer model containing guessed architecture.

## Determinism

The JSON output is designed for tooling:

- entries are sorted;
- paths are project-relative display paths or Shopify output paths;
- no timestamps are included;
- no random identifiers are included;
- repeated runs over unchanged source produce the same model.

That makes the output suitable for agent context, CI artifacts, architectural diffs, and future observability tooling.

## Programmatic API

```js
import { createProjectModel, selectProjectModel } from "liquid-loom";

const model = await createProjectModel(config);
const product = selectProjectModel(model, "product");
```

The public TypeScript declarations expose the complete model contract.

## Agent workflow

A coding agent can use the model as a first architectural query before editing a theme:

```text
1. liquid-loom explain product --json
2. inspect only the relevant source files
3. make the requested change
4. liquid-loom check
5. liquid-loom doctor
6. build and run Shopify Theme Check
```

Liquid Loom remains the source-of-truth layer for ownership and mapping. Shopify remains the runtime and deployment target.
