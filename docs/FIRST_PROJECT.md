# Try Liquid Loom on one real edit

This is the shortest useful Liquid Loom test. It is designed for Shopify developers evaluating the workflow, not for benchmarking every feature.

You can complete the local part without a Shopify store. A development store is only needed for the final live-preview step.

## 1. Scaffold

```bash
corepack enable
pnpm create liquid-loom@latest liquid-loom-test
cd liquid-loom-test
```

## 2. Prove the local build

```bash
pnpm build
pnpm doctor
```

You should get a successful production build under `dist/theme` and a healthy project report.

## 3. Make one feature-organized edit

Create:

```text
src/theme/sections/marketing/promo-banner.liquid
```

with a minimal valid Shopify section, for example:

```liquid
<section class="promo-banner">
  <p>{{ section.settings.text }}</p>
</section>

{% schema %}
{
  "name": "Promo banner",
  "settings": [
    {
      "type": "text",
      "id": "text",
      "label": "Text",
      "default": "Hello from Liquid Loom"
    }
  ],
  "presets": [{ "name": "Promo banner" }]
}
{% endschema %}
```

Then run:

```bash
pnpm build
```

Confirm that Liquid Loom produced:

```text
dist/theme/sections/promo-banner.liquid
```

The point of the test is the authoring model: your source can be organized under `sections/marketing/`, while Shopify receives the flat `sections/` directory it expects.

## 4. See a safety failure on purpose

Create another file with the same final filename in a different feature directory, for example:

```text
src/theme/sections/home/promo-banner.liquid
```

Run:

```bash
pnpm build
```

The build should fail before publishing output and tell you which source paths collide. Delete the duplicate when you are done.

## 5. Preview in Shopify

If you have access to a Shopify development store:

```bash
pnpm dev
```

Liquid Loom builds and watches the project, then launches Shopify CLI against `dist/theme`.

Make one Liquid or CSS edit and confirm the preview loop feels understandable.

## 6. Tell us what was worse

The useful question is not whether the demo worked. It is whether you would choose this workflow for your next custom theme.

[Share first-project feedback](https://github.com/yotamon/Liquid-Loom/issues/new?template=early_adopter_feedback.yml). Failed setup attempts are useful feedback too.

Please call out anything that felt more confusing, slower, or less flexible than a conventional Shopify theme repository.
