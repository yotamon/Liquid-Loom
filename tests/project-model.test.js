import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createProjectModel, formatProjectModel, selectProjectModel } from "../build-scripts/lib/project-model.js";

const temporaryDirectories = [];

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function write(root, relativePath, contents) {
	const file = path.join(root, ...relativePath.split("/"));
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, contents);
}

async function createFixture() {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "liquid-loom-model-"));
	temporaryDirectories.push(projectRoot);
	const sourceRoot = path.join(projectRoot, "src");

	await write(sourceRoot, "theme/layout/theme.liquid", "<main>{{ content_for_layout }}</main>");
	await write(
		sourceRoot,
		"theme/sections/products/main-product.liquid",
		`{% render 'price' %}
{% block 'buy-buttons', product: product %}{% endblock %}
{% partial 'product-form' %}
  <form>{{ product.title }}</form>
{% endpartial %}
{{ 'theme.css' | asset_url }}`
	);
	await write(sourceRoot, "theme/snippets/product/price.liquid", "<span>{{ product.price | money }}</span>");
	await write(sourceRoot, "theme/blocks/product/buy-buttons.liquid", "<button>Add</button>");
	await write(
		sourceRoot,
		"theme/templates/product.json",
		JSON.stringify({ sections: { main: { type: "main-product", settings: {} } }, order: ["main"] })
	);
	await write(sourceRoot, "public/theme.css", "body{}");

	return {
		projectRoot,
		reservedOutputs: [],
		shopifyLiquidMode: "july-2026-preview",
		shopifySourceRoot: undefined,
		sourceRoot
	};
}

describe("project model", () => {
	it("builds a deterministic semantic model from organized Shopify source", async () => {
		const model = await createProjectModel(await createFixture());

		assert.equal(model.version, 1);
		assert.equal(model.liquidMode, "july-2026-preview");
		assert.equal(model.summary.files, 6);
		assert.equal(model.summary.unresolvedReferences, 0);
		assert.deepEqual(model.generatedOutputs, []);
		assert.deepEqual(model.preview.blockTag, ["src/theme/sections/products/main-product.liquid"]);
		assert.deepEqual(model.preview.partialTag, ["src/theme/sections/products/main-product.liquid"]);

		const product = model.features.find((feature) => feature.name === "product");
		assert.ok(product);
		assert.deepEqual(product.partials, ["product-form"]);
		assert.deepEqual(
			product.references.map(({ kind, name }) => `${kind}:${name}`),
			["asset:theme.css", "block:buy-buttons", "section:main-product", "snippet:price"]
		);
	});

	it("treats reserved Vite assets as known outputs instead of false unresolved references", async () => {
		const config = await createFixture();
		await rm(path.join(config.sourceRoot, "public", "theme.css"));
		config.reservedOutputs = ["assets/theme.css", "assets/theme.js"];

		const model = await createProjectModel(config);
		assert.deepEqual(model.generatedOutputs, ["assets/theme.css", "assets/theme.js"]);
		assert.equal(model.summary.unresolvedReferences, 0);
		assert.deepEqual(model.unresolvedReferences, []);
	});

	it("models stable static theme blocks without marking them as preview syntax", async () => {
		const config = await createFixture();
		await write(
			config.sourceRoot,
			"theme/sections/home/hero.liquid",
			`{% content_for 'block', type: "button", id: "hero-button", label: "Shop now" %}`
		);
		await write(config.sourceRoot, "theme/blocks/shared/button.liquid", "<a>{{ label }}</a>");

		const model = await createProjectModel(config);
		const hero = model.files.find((file) => file.output === "sections/hero.liquid");
		assert.deepEqual(hero.references, [{ kind: "block", name: "button", output: "blocks/button.liquid" }]);
		assert.equal(hero.preview.blockTag, false);
		assert.equal(model.preview.blockTag.includes(hero.source), false);
		assert.equal(model.summary.unresolvedReferences, 0);
	});

	it("selects semantic features and formats a stable human-readable explanation", async () => {
		const model = await createProjectModel(await createFixture());
		const selection = selectProjectModel(model, "product");

		assert.equal(selection.feature.name, "product");
		assert.ok(selection.files.some((file) => file.output === "sections/main-product.liquid"));
		assert.ok(selection.files.some((file) => file.output === "templates/product.json"));

		const formatted = formatProjectModel(model, "product");
		assert.match(formatted, /Feature: product/);
		assert.match(formatted, /sections\/main-product\.liquid/);
		assert.match(formatted, /partial/i);
	});

	it("reports unresolved static references without failing the model", async () => {
		const config = await createFixture();
		await write(
			config.sourceRoot,
			"theme/sections/search/main-search.liquid",
			"{% render 'missing-result' %}"
		);

		const model = await createProjectModel(config);
		assert.deepEqual(model.unresolvedReferences, [
			{
				from: "sections/main-search.liquid",
				kind: "snippet",
				name: "missing-result",
				output: "snippets/missing-result.liquid"
			}
		]);
	});

	it("groups native Shopify files semantically when an existing theme has not migrated", async () => {
		const config = await createFixture();
		config.shopifySourceRoot = config.projectRoot;
		await rm(config.sourceRoot, { recursive: true, force: true });
		await write(config.projectRoot, "layout/theme.liquid", "{{ content_for_layout }}");
		await write(config.projectRoot, "sections/main-product.liquid", "{% render 'price' %}");
		await write(config.projectRoot, "sections/main-collection-product-grid.liquid", "<div>Grid</div>");
		await write(config.projectRoot, "snippets/price.liquid", "{{ product.price }}");
		await write(
			config.projectRoot,
			"templates/product.json",
			'{"sections":{"main":{"type":"main-product"}},"order":["main"]}'
		);

		const model = await createProjectModel(config);
		const product = model.features.find((feature) => feature.name === "product");
		const collection = model.features.find((feature) => feature.name === "collection");
		assert.ok(product);
		assert.ok(collection);
		assert.deepEqual(product.outputs, ["sections/main-product.liquid", "templates/product.json"]);
		assert.deepEqual(collection.outputs, ["sections/main-collection-product-grid.liquid"]);
	});

	it("supports file-path lookup and rejects unknown targets", async () => {
		const model = await createProjectModel(await createFixture());
		const selection = selectProjectModel(model, "main-product");
		assert.equal(selection.files.length, 1);
		assert.equal(selection.files[0].output, "sections/main-product.liquid");
		assert.throws(() => selectProjectModel(model, "does-not-exist"), /No Liquid Loom feature or source matches/);
	});
});
