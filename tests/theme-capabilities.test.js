import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) => readFile(path.join(root, ...relativePath.split("/")), "utf8");

describe("reference theme capabilities", () => {
	it("ships composable Shopify theme blocks and keeps block validation enabled", async () => {
		for (const block of [
			"button",
			"heading",
			"image",
			"text",
			"product-vendor",
			"product-title",
			"product-price",
			"product-purchase",
			"product-description"
		]) {
			assert.match(await read(`src/theme/blocks/${block}.liquid`), /block\.shopify_attributes/);
		}
		assert.match(await read("src/theme/sections/pages/flexible-content.liquid"), /content_for 'blocks'/);
		assert.match(await read("src/theme/sections/products/main-product.liquid"), /content_for 'blocks'/);
		assert.match(await read("src/theme/templates/product.json"), /product-purchase/);
		assert.doesNotMatch(await read(".theme-check.yml"), /JSONMissingBlock:\s*\n\s*enabled: false/);
	});

	it("uses Shopify-native component assets and standard storefront interoperability", async () => {
		assert.match(await read("liquid-loom.config.ts"), /viteConfig:\s*false/);
		assert.match(await read("src/theme/sections/global/header.liquid"), /{% javascript %}/);
		assert.match(await read("src/theme/sections/global/header.liquid"), /<shopify-account/);
		assert.match(await read("src/theme/blocks/product-purchase.liquid"), /Shopify\.actions\.updateCart/);
		assert.match(await read("src/theme/sections/products/main-product.liquid"), /standard_event_data/);
		assert.match(await read("src/theme/sections/collections/main-collection.liquid"), /view-event-trigger="intersect"/);
	});

	it("provides responsive, merchant-editable content sections without a JavaScript runtime", async () => {
		const sectionPaths = ["faq", "image-with-text"];
		for (const name of sectionPaths) {
			const source = await read(`src/theme/sections/pages/${name}.liquid`);
			const starter = await read(`packages/create-liquid-loom/template/src/theme/sections/pages/${name}.liquid`);
			assert.equal(starter, source, `${name} must match the packed scaffold`);
			const match = source.match(/{% schema %}([\\s\\S]*?){% endschema %}/);
			assert.ok(match, `${name} must have a Shopify section schema`);
			const schema = JSON.parse(match[1]);
			assert.ok(schema.presets?.length > 0, `${name} must be addable in Theme Editor`);
			assert.match(source, /{% stylesheet %}/);
			assert.match(source, /@media \\(max-width: 750px\\)/);
			assert.doesNotMatch(source, /{% javascript %}/);
		}
		const faq = await read("src/theme/sections/pages/faq.liquid");
		const faqSchema = JSON.parse(faq.match(/{% schema %}([\\s\\S]*?){% endschema %}/)[1]);
		assert.ok(faqSchema.blocks.some((block) => block.type === "question"));
		assert.match(faq, /<details[^>]+block\\.shopify_attributes/);
		assert.match(faq, /<summary>/);
		const imageText = await read("src/theme/sections/pages/image-with-text.liquid");
		assert.match(imageText, /image_tag: loading: 'lazy'/);
		assert.match(imageText, /section\\.settings\\.button_link != blank/);
	});

	it("includes modern discovery, merchandising, and design-token primitives", async () => {
		assert.match(await read("src/theme/config/settings_schema.json"), /color_palette/);
		assert.match(await read("src/theme/sections/collections/main-collection.liquid"), /collection\.filters/);
		assert.match(await read("src/theme/sections/search/predictive-search.liquid"), /predictive_search\.resources/);
		assert.match(await read("src/theme/sections/search/main-search.liquid"), /class PredictiveSearch/);
		const purchase = await read("src/theme/blocks/product-purchase.liquid");
		assert.match(purchase, /selling_plan_groups/);
		assert.match(purchase, /product\.options_with_values/);
		assert.match(purchase, /data-product-option/);
		assert.match(purchase, /option_values/);
		assert.doesNotMatch(purchase, /product\.variants/);
	});
});
