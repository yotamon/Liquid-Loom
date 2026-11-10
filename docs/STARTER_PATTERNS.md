# Starter content sections

Liquid Loom includes a deliberately small set of Shopify-native, merchant-editable patterns. These are reference components, not a custom runtime or a component marketplace.

## Frequently asked questions (`faq.liquid`)

In **Customize > Add section**, choose **FAQ**. Add, remove and reorder Question blocks. Each question uses native HTML `details` and `summary`, so keyboard interaction and disclosure work without JavaScript.

- Edit the eyebrow, section heading and optional introduction in Theme Editor.
- Add up to 12 question blocks. Merchants should replace the sample question and answer before publishing.
- Answers are Shopify rich text, making links and formatting editable.
- The section is responsive and uses the existing brand color and typography tokens.

**Authored:** `src/theme/sections/pages/faq.liquid`  
**Deployed:** `dist/theme/sections/faq.liquid`

## Image with text (`image-with-text.liquid`)

In **Customize > Add section**, choose **Image with text**. Select an image and choose whether it appears left or right on desktop. On narrow screens the image comes first for predictable reading order.

- Optional eyebrow and editable heading/description.
- Optional button appears only when both label and destination are present.
- Responsive Shopify `image_tag` with lazy loading and widths/sizes.
- Merchants must provide meaningful image alt text in Shopify Files when the image conveys content.
- Uses existing page width, radius, and color tokens. No additional JavaScript dependency.

**Authored:** `src/theme/sections/pages/image-with-text.liquid`  
**Deployed:** `dist/theme/sections/image-with-text.liquid`

## Rich text (`rich-text.liquid`)

In **Customize > Add section**, choose **Rich text** for a compact about-us introduction, editorial message, or short landing-page feature.

- Edit the optional eyebrow, heading, rich text, and left/center alignment directly in Theme Editor.
- The button is displayed only when both its text and URL are configured.
- The reading order is logical for keyboard and screen-reader users and does not require JavaScript.
- The text width is deliberately limited for readability.

**Authored:** `src/theme/sections/pages/rich-text.liquid`  
**Deployed:** `dist/theme/sections/rich-text.liquid`

## Multicolumn (`multicolumn.liquid`)

In **Customize > Add section**, choose **Multicolumn** for customer benefits, key product features, or a small editorial gallery.

- Preset supplies three editable Column blocks; merchants can add, delete or reorder up to 12.
- Each block supports an optional image, heading, rich text and link. Buttons/links appear only with both label and URL.
- Choose two, three or four columns on desktop; the responsive layout collapses to two and then one column.
- Uploaded images use responsive Shopify image markup. Provide accurate image alt text in Shopify Files for content-bearing images.
- Native `<ul>` / `<li>` markup preserves a coherent semantic list without an extra runtime.

**Authored:** `src/theme/sections/pages/multicolumn.liquid`  
**Deployed:** `dist/theme/sections/multicolumn.liquid`

## Quality boundary

The repository tests syntax and scaffold parity, while Shopify Theme Check validates generated output. Real Theme Editor testing is still needed to verify block reordering, image choices, mobile appearance, and accessibility with realistic merchant copy. Do not confuse these starter examples with a Theme Store-approved theme or an audited production design system.
