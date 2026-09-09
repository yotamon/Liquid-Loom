import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
	BuildCollisionError,
	assertSafeOutput,
	buildTheme,
	createBuildPlan,
	discoverSourceEntries,
	mapShopifyPath,
	validateThemePlan
} from "../build-scripts/lib/theme-builder.js";

const temporaryDirectories = [];

async function project() {
	const root = await mkdtemp(path.join(os.tmpdir(), "liquid-loom-hybrid-"));
	temporaryDirectories.push(root);
	return root;
}

async function write(root, relativePath, contents = "") {
	const file = path.join(root, ...relativePath.split("/"));
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, contents);
	return file;
}

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("native Shopify mapping", () => {
	it("preserves valid native Shopify paths", () => {
		assert.equal(mapShopifyPath("sections/hero.liquid"), "sections/hero.liquid");
		assert.equal(mapShopifyPath("assets/theme.css"), "assets/theme.css");
		assert.equal(mapShopifyPath("templates/product.json"), "templates/product.json");
		assert.equal(mapShopifyPath("templates/customers/account.json"), "templates/customers/account.json");
		assert.equal(mapShopifyPath("templates/metaobject/book.json"), "templates/metaobject/book.json");
	});

	it("rejects paths Shopify does not support", () => {
		assert.throws(() => mapShopifyPath("sections/home/hero.liquid"), /sections\/ is flat/);
		assert.throws(
			() => mapShopifyPath("templates/customers/account/default.json"),
			/Unsupported Shopify template nesting/
		);
		assert.throws(() => mapShopifyPath("src/theme.liquid"), /Unsupported Shopify source path/);
	});
});

describe("dual-source planning", () => {
	it("discovers only managed Shopify directories plus organized source", async () => {
		const root = await project();
		await write(root, "layout/theme.liquid", "theme");
		await write(root, "sections/hero.liquid", "hero");
		await write(root, "templates/customers/account.json", "{}");
		await write(root, "notes/private.txt", "ignore");
		await write(root, "src/theme/snippets/product/price.liquid", "price");
		await write(root, "src/public/icon.svg", "<svg />");

		const entries = await discoverSourceEntries({
			projectRoot: root,
			sourceRoot: path.join(root, "src"),
			shopifySourceRoot: root
		});
		assert.equal(
			entries.some((entry) => entry.displayPath === "notes/private.txt"),
			false
		);
		assert.equal(entries.filter((entry) => entry.kind === "shopify").length, 3);
		assert.equal(entries.filter((entry) => entry.kind === "organized").length, 2);
	});

	it("uses one global ownership map across native, organized, and generated output", () => {
		const native = {
			layerId: "shopify",
			kind: "shopify",
			root: "/theme",
			relativePath: "sections/hero.liquid",
			displayPath: "sections/hero.liquid"
		};
		const organized = {
			layerId: "loom",
			kind: "organized",
			root: "/theme/src",
			relativePath: "theme/sections/home/hero.liquid",
			displayPath: "src/theme/sections/home/hero.liquid"
		};
		assert.throws(
			() => createBuildPlan([native, organized]),
			(error) => error instanceof BuildCollisionError && error.destination === "sections/hero.liquid"
		);

		const nativeAsset = { ...native, relativePath: "assets/theme.js", displayPath: "assets/theme.js" };
		assert.throws(
			() => createBuildPlan([nativeAsset], { reservedOutputs: ["assets/theme.js"] }),
			(error) => error instanceof BuildCollisionError && error.sources.includes("<generated:assets/theme.js>")
		);
	});

	it("validates Shopify's upload minimum from the final plan, not a particular source layer", () => {
		const plan = createBuildPlan([
			{
				layerId: "shopify",
				kind: "shopify",
				root: "/theme",
				relativePath: "layout/theme.liquid",
				displayPath: "layout/theme.liquid"
			}
		]);
		assert.deepEqual(validateThemePlan(plan), { valid: true, missing: [] });
		assert.deepEqual(validateThemePlan({ files: [] }), { valid: false, missing: ["layout/theme.liquid"] });
	});
});

describe("hybrid output safety and cache", () => {
	it("allows dist/theme beside a root Shopify theme but rejects managed-directory overlap", async () => {
		const root = await project();
		assert.doesNotThrow(() =>
			assertSafeOutput({
				projectRoot: root,
				sourceRoot: path.join(root, "src"),
				shopifySourceRoot: root,
				outputRoot: path.join(root, "dist", "theme")
			})
		);
		assert.throws(
			() =>
				assertSafeOutput({
					projectRoot: root,
					sourceRoot: path.join(root, "src"),
					shopifySourceRoot: root,
					outputRoot: path.join(root, "sections", "generated")
				}),
			/overlap Shopify source directory/
		);
	});

	it("keeps an output when ownership migrates from native to organized source", async () => {
		const root = await project();
		const sourceRoot = path.join(root, "src");
		const outputRoot = path.join(root, "dist", "theme");
		const cacheFile = path.join(root, ".cache", "manifest.json");
		await write(root, "layout/theme.liquid", "theme");
		const nativeHero = await write(root, "sections/hero.liquid", "hero");

		const first = await buildTheme({
			projectRoot: root,
			sourceRoot,
			shopifySourceRoot: root,
			outputRoot,
			cacheFile,
			reservedOutputs: []
		});
		assert.equal(first.total, 2);
		const firstManifest = JSON.parse(await readFile(cacheFile, "utf8"));
		assert.equal(firstManifest.version, 2);
		assert.equal(firstManifest.files["shopify:sections/hero.liquid"].output, "sections/hero.liquid");

		const organizedHero = path.join(sourceRoot, "theme", "sections", "home", "hero.liquid");
		await mkdir(path.dirname(organizedHero), { recursive: true });
		await rename(nativeHero, organizedHero);

		const second = await buildTheme({
			projectRoot: root,
			sourceRoot,
			shopifySourceRoot: root,
			outputRoot,
			cacheFile,
			reservedOutputs: []
		});
		assert.equal(second.removed, 0);
		assert.equal(await readFile(path.join(outputRoot, "sections", "hero.liquid"), "utf8"), "hero");
		const secondManifest = JSON.parse(await readFile(cacheFile, "utf8"));
		assert.equal(secondManifest.files["loom:theme/sections/home/hero.liquid"].output, "sections/hero.liquid");
	});
});
