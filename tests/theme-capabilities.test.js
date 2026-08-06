import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) => readFile(path.join(root, ...relativePath.split("/")), "utf8");

describe("reference theme capabilities", () => {
	it("ships composable Shopify theme blocks and keeps block validation enabled", async () => {
		for (const block of ["button", "heading", "image", "text"]) {
			assert.match(await read(`src/theme/blocks/${block}.liquid`), /block\.shopify_attributes/);
		}
		assert.match(await read("src/theme/sections/pages/flexible-content.liquid"), /content_for 'blocks'/);
		assert.doesNotMatch(await read(".theme-check.yml"), /JSONMissingBlock:\s*\n\s*enabled: false/);
	});

	it("includes modern discovery and merchandising primitives", async () => {
		assert.match(await read("src/theme/sections/collections/main-collection.liquid"), /collection\.filters/);
		assert.match(await read("src/theme/sections/search/predictive-search.liquid"), /predictive_search\.resources/);
		assert.match(await read("src/entrypoints/theme.js"), /class PredictiveSearch/);
		const product = await read("src/theme/sections/products/main-product.liquid");
		assert.match(product, /selling_plan_groups/);
		assert.match(product, /data-product-variants/);
	});
});
