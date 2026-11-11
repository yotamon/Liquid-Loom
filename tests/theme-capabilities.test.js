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
			const match = source.match(/{% schema %}([\s\S]*?){% endschema %}/);
			assert.ok(match, `${name} must have a Shopify section schema`);
			const schema = JSON.parse(match[1]);
			assert.ok(schema.presets?.length > 0, `${name} must be addable in Theme Editor`);
			assert.match(source, /{% stylesheet %}/);
			assert.match(source, /@media \(max-width: 750px\)/);
			assert.doesNotMatch(source, /{% javascript %}/);
		}
		const faq = await read("src/theme/sections/pages/faq.liquid");
		const faqSchema = JSON.parse(faq.match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
		assert.ok(faqSchema.blocks.some((block) => block.type === "question"));
		assert.match(faq, /<details[^>]+block\.shopify_attributes/);
		assert.match(faq, /<summary>/);
		const imageText = await read("src/theme/sections/pages/image-with-text.liquid");
		assert.match(imageText, /image_tag: loading: 'lazy'/);
		assert.match(imageText, /section\.settings\.button_link != blank/);
	});

	it("keeps native editorial content patterns merchant-editable and mirrored into the starter", async () => {
		for (const name of ["rich-text", "multicolumn"]) {
			const source = await read(`src/theme/sections/pages/${name}.liquid`);
			const starter = await read(`packages/create-liquid-loom/template/src/theme/sections/pages/${name}.liquid`);
			assert.equal(source, starter, `${name} must match the generated starter`);
			const schemaBlock = source.split("{% schema %}")[1]?.split("{% endschema %}")[0];
			assert.ok(schemaBlock, `${name} must have a schema`);
			const schema = JSON.parse(schemaBlock);
			assert.ok(schema.name.length <= 25);
			assert.ok(schema.presets.length > 0);
			assert.ok(source.includes("{% stylesheet %}"));
			assert.equal(source.includes("{% javascript %}"), false);
		}
		const rich = await read("src/theme/sections/pages/rich-text.liquid");
		const richSchema = JSON.parse(rich.split("{% schema %}")[1].split("{% endschema %}")[0]);
		assert.ok(richSchema.settings.some((setting) => setting.id === "alignment"));
		assert.ok(rich.includes("section.settings.button_link != blank"));
		const multi = await read("src/theme/sections/pages/multicolumn.liquid");
		const multiSchema = JSON.parse(multi.split("{% schema %}")[1].split("{% endschema %}")[0]);
		assert.ok(multiSchema.blocks.some((block) => block.type === "column"));
		assert.equal(multiSchema.presets[0].blocks.length, 3);
		assert.ok(multi.includes("block.shopify_attributes"));
		assert.match(multi, /image_tag:\s*loading: 'lazy'/);
		assert.ok(multi.includes("@media (max-width: 600px)"));
		assert.ok(multi.includes("block.settings.link != blank"));
	});

	it("localizes cart controls and displays subscription allocations for purchased variants", async () => {
		const cart = await read("src/theme/sections/cart/main-cart.liquid");
		assert.match(cart, /item\.selling_plan_allocation\.selling_plan\.name/);
		assert.match(cart, /name="update"/);
		assert.match(cart, /cart\.quantity_for/);
		assert.match(cart, /cart\.total/);
		assert.match(cart, /scope="col"/);
		assert.doesNotMatch(cart, /<th>Product<\/th>/);
		const [english, german] = await Promise.all([
			read("src/theme/locales/en.default.json"),
			read("src/theme/locales/de.json")
		]);
		const en = JSON.parse(english);
		const de = JSON.parse(german);
		for (const key of ["product", "quantity", "total", "update", "quantity_for"]) {
			assert.ok(en.cart[key]);
			assert.ok(de.cart[key]);
		}
		assert.ok(en.cart.quantity_for.includes("{{ product }}"));
		assert.ok(de.cart.quantity_for.includes("{{ product }}"));
		assert.equal(cart, await read("packages/create-liquid-loom/template/src/theme/sections/cart/main-cart.liquid"));
	});

	it("paginates server-rendered search results and handles products, pages, and articles", async () => {
		const source = await read("src/theme/sections/search/main-search.liquid");
		const starter = await read("packages/create-liquid-loom/template/src/theme/sections/search/main-search.liquid");
		assert.equal(source, starter, "Search must be mirrored in the packaged starter");
		assert.match(source, /paginate search\.results by section\.settings\.results_per_page/);
		assert.match(source, /paginate \| default_pagination/);
		assert.match(source, /search\.results_count > 0/);
		assert.match(source, /item\.object_type == 'article'/);
		assert.match(source, /item\.object_type == 'page'/);
		assert.match(source, /render 'price', product: item/);
		assert.match(source, /search\.pagination/);
		const schema = JSON.parse(source.split("{% schema %}")[1].split("{% endschema %}")[0]);
		const pageSize = schema.settings.find((setting) => setting.id === "results_per_page");
		assert.ok(pageSize);
		assert.ok(pageSize.min > 0 && pageSize.max <= 50);
		for (const language of ["en.default", "de"]) {
			const locale = JSON.parse(await read(`src/theme/locales/${language}.json`));
			assert.ok(locale.search.article && locale.search.page && locale.search.pagination);
			assert.ok(locale.search.results_count.one && locale.search.results_count.other);
		}
	});

	it("offers native Shopify collection sorting with or without filters", async () => {
		const source = await read("src/theme/sections/collections/main-collection.liquid");
		const starter = await read(
			"packages/create-liquid-loom/template/src/theme/sections/collections/main-collection.liquid"
		);
		assert.equal(source, starter, "Collection section must match the packaged starter");
		assert.match(source, /collection\.filters\.size > 0 or collection\.sort_options\.size > 0/);
		assert.match(source, /collection\.sort_by \| default: collection\.default_sort_by/);
		assert.match(source, /for option in collection\.sort_options/);
		assert.match(source, /name="sort_by"/);
		assert.match(source, /option\.value == active_sort_by/);
		assert.match(source, /collection\.url \| sort_by: active_sort_by/);
		assert.match(source, /paginate \| default_pagination/);
		assert.match(source, /aria-label="{{ 'collections\.pagination' \| t \| escape }}"/);
		for (const language of ["en.default", "de"]) {
			const locale = JSON.parse(await read(`src/theme/locales/${language}.json`));
			for (const key of ["apply", "sort_by", "pagination"]) assert.ok(locale.collections[key]);
		}
	});

	it("keeps mobile search reachable and localized without inert starter links", async () => {
		for (const name of ["global/header", "pages/main-404", "home/hero"]) {
			const source = await read(`src/theme/sections/${name}.liquid`);
			const embedded = await read(`packages/create-liquid-loom/template/src/theme/sections/${name}.liquid`);
			assert.equal(source, embedded);
		}
		const header = await read("src/theme/sections/global/header.liquid");
		assert.match(header, /mobile-menu__search" href="{{ routes\.search_url }}"/);
		assert.match(header, /accessibility\.mobile_navigation/);
		assert.match(header, /accessibility\.primary_navigation/);
		assert.match(header, /accessibility\.menu/);
		const hero = await read("src/theme/sections/home/hero.liquid");
		assert.match(hero, /primary_link \| default: routes\.all_products_collection_url/);
		assert.match(hero, /secondary_label != blank and section\.settings\.secondary_link != blank/);
		const notFound = await read("src/theme/sections/pages/main-404.liquid");
		for (const key of ["title", "description", "return_home"])
			assert.match(notFound, new RegExp(`errors\\.not_found\\.${key}`));
		for (const language of ["en.default", "de"]) {
			const locale = JSON.parse(await read(`src/theme/locales/${language}.json`));
			for (const key of ["primary_navigation", "mobile_navigation", "menu"]) assert.ok(locale.accessibility[key]);
			for (const key of ["title", "description", "return_home"]) assert.ok(locale.errors.not_found[key]);
		}
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
