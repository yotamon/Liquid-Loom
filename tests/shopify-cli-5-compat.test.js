import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const source = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const mirrored = async (name) => {
	const [reference, embedded] = await Promise.all([
		source(`src/theme/${name}`),
		source(`packages/create-liquid-loom/template/src/theme/${name}`)
	]);
	assert.equal(embedded, reference, `Packed Shopify starter drifted at ${name}`);
	return reference;
};

describe("Shopify CLI 5 and Theme Check 4 compatibility", () => {
	it("keeps framework and starter on the tested Shopify CLI 5 major", async () => {
		const [framework, starter, lock] = await Promise.all([
			source("package.json").then(JSON.parse),
			source("packages/create-liquid-loom/template/package.json").then(JSON.parse),
			source("pnpm-lock.yaml")
		]);
		assert.equal(framework.devDependencies["@shopify/cli"], "^5.0.1");
		assert.equal(starter.devDependencies["@shopify/cli"], "^5.0.1");
		assert.match(lock, /@shopify\/cli@5\.0\.1/);
	});

	it("does not put a Liquid filter expression inside the product form tag", async () => {
		const liquid = await mirrored("blocks/product-purchase.liquid");
		assert.match(liquid, /assign product_form_id = 'ProductForm-' \| append: block\.id/);
		assert.match(liquid, /form 'product', product, id: product_form_id/);
		assert.doesNotMatch(liquid, /form 'product'[^\n]*\|\s*append/);
	});

	it("declares predictive-search class styling in its own section", async () => {
		const liquid = await mirrored("sections/search/predictive-search.liquid");
		assert.match(liquid, /class="predictive-search__results"/);
		assert.match(liquid, /{% stylesheet %}[\s\S]*\.predictive-search__results\s*\{/);
	});
});
