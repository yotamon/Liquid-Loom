import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
	BuildCollisionError,
	assertSafeOutput,
	buildTheme,
	createBuildPlan,
	mapThemePath,
	validateThemeSource
} from "../build-scripts/lib/theme-builder.js";

const temporaryDirectories = [];

async function createTemporaryProject() {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "liquid-loom-"));
	temporaryDirectories.push(projectRoot);

	const sourceRoot = path.join(projectRoot, "src");
	const outputRoot = path.join(projectRoot, "dist", "theme");
	const cacheFile = path.join(projectRoot, ".cache", "manifest.json");

	return { projectRoot, sourceRoot, outputRoot, cacheFile };
}

async function writeSource(sourceRoot, relativePath, contents) {
	const filePath = path.join(sourceRoot, ...relativePath.split("/"));
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, contents);
	return filePath;
}

async function createMinimumTheme(sourceRoot) {
	await writeSource(sourceRoot, "theme/layout/theme.liquid", "<main>{{ content_for_layout }}</main>");
	await writeSource(sourceRoot, "theme/templates/index.json", '{"sections":{},"order":[]}');
	await writeSource(sourceRoot, "theme/config/settings_schema.json", "[]");
}

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("mapThemePath", () => {
	it("flattens feature-organized Liquid files into Shopify directories", () => {
		assert.equal(mapThemePath("theme/sections/marketing/hero.liquid"), "sections/hero.liquid");
		assert.equal(mapThemePath("theme/snippets/product/card.liquid"), "snippets/card.liquid");
	});

	it("preserves nested paths where Shopify supports them", () => {
		assert.equal(mapThemePath("theme/templates/customers/account.json"), "templates/customers/account.json");
		assert.equal(mapThemePath("theme/locales/en.default.json"), "locales/en.default.json");
	});

	it("maps public files into Shopify's flat assets directory", () => {
		assert.equal(mapThemePath("public/icons/cart.svg"), "assets/cart.svg");
	});

	it("rejects files outside the supported source contract", () => {
		assert.throws(() => mapThemePath("notes/private.txt"), /Unsupported source path/);
	});
});

describe("createBuildPlan", () => {
	it("reports destination collisions before anything is copied", () => {
		assert.throws(
			() => createBuildPlan(["theme/sections/home/hero.liquid", "theme/sections/product/hero.liquid"]),
			(error) => error instanceof BuildCollisionError && error.destination === "sections/hero.liquid"
		);
	});
});

describe("theme source validation", () => {
	it("reports all missing files required for a bootable Shopify theme", async () => {
		const { sourceRoot } = await createTemporaryProject();
		await mkdir(sourceRoot, { recursive: true });

		const result = await validateThemeSource(sourceRoot);

		assert.equal(result.valid, false);
		assert.deepEqual(result.missing, [
			"theme/config/settings_schema.json",
			"theme/layout/theme.liquid",
			"theme/templates/index.json"
		]);
	});
});

describe("buildTheme", () => {
	it("copies a complete source tree and writes a portable manifest", async () => {
		const { projectRoot, sourceRoot, outputRoot, cacheFile } = await createTemporaryProject();
		await createMinimumTheme(sourceRoot);
		await writeSource(sourceRoot, "theme/sections/home/hero.liquid", "<section>Hero</section>");
		await writeSource(sourceRoot, "public/icons/cart.svg", "<svg></svg>");

		const summary = await buildTheme({ projectRoot, sourceRoot, outputRoot, cacheFile });

		assert.equal(summary.copied, 5);
		assert.equal(summary.skipped, 0);
		assert.equal(await readFile(path.join(outputRoot, "sections", "hero.liquid"), "utf8"), "<section>Hero</section>");
		assert.equal(await readFile(path.join(outputRoot, "assets", "cart.svg"), "utf8"), "<svg></svg>");

		const manifest = JSON.parse(await readFile(cacheFile, "utf8"));
		assert.equal(manifest.version, 1);
		assert.equal(manifest.files["theme/sections/home/hero.liquid"].output, "sections/hero.liquid");
	});

	it("leaves Vite entrypoints and styles to the bundler", async () => {
		const { projectRoot, sourceRoot, outputRoot, cacheFile } = await createTemporaryProject();
		await createMinimumTheme(sourceRoot);
		await writeSource(sourceRoot, "entrypoints/theme.js", 'import "../styles/theme.css";');
		await writeSource(sourceRoot, "styles/theme.css", "body { display: grid; }");

		const summary = await buildTheme({ projectRoot, sourceRoot, outputRoot, cacheFile });

		assert.equal(summary.total, 3);
		assert.equal(summary.copied, 3);
	});

	it("skips unchanged files, refreshes changed files, and removes stale outputs", async () => {
		const { projectRoot, sourceRoot, outputRoot, cacheFile } = await createTemporaryProject();
		await createMinimumTheme(sourceRoot);
		const sectionPath = await writeSource(sourceRoot, "theme/sections/home/hero.liquid", "version one");
		const assetPath = await writeSource(sourceRoot, "public/icons/cart.svg", "<svg></svg>");

		await buildTheme({ projectRoot, sourceRoot, outputRoot, cacheFile });
		const unchanged = await buildTheme({ projectRoot, sourceRoot, outputRoot, cacheFile });

		assert.equal(unchanged.copied, 0);
		assert.equal(unchanged.skipped, 5);

		await writeFile(sectionPath, "version two");
		await unlink(assetPath);
		const incremental = await buildTheme({ projectRoot, sourceRoot, outputRoot, cacheFile });

		assert.equal(incremental.copied, 1);
		assert.equal(incremental.removed, 1);
		assert.equal(await readFile(path.join(outputRoot, "sections", "hero.liquid"), "utf8"), "version two");
		await assert.rejects(
			readFile(path.join(outputRoot, "assets", "cart.svg"), "utf8"),
			(error) => error.code === "ENOENT"
		);
	});

	it("refuses unsafe output targets", async () => {
		const { projectRoot, sourceRoot } = await createTemporaryProject();

		assert.throws(() => assertSafeOutput({ projectRoot, sourceRoot, outputRoot: projectRoot }), /project root/);
		assert.throws(() => assertSafeOutput({ projectRoot, sourceRoot, outputRoot: sourceRoot }), /source directory/);
		assert.throws(
			() => assertSafeOutput({ projectRoot, sourceRoot, outputRoot: path.dirname(projectRoot) }),
			/outside the project/
		);
	});

	it("rejects cache entries that point outside the build directory", async () => {
		const { projectRoot, sourceRoot, outputRoot, cacheFile } = await createTemporaryProject();
		await createMinimumTheme(sourceRoot);
		const protectedFile = path.join(projectRoot, "outside.txt");
		await writeFile(protectedFile, "keep me");
		await mkdir(path.dirname(cacheFile), { recursive: true });
		await writeFile(
			cacheFile,
			JSON.stringify({
				version: 1,
				files: {
					"theme/sections/removed.liquid": { hash: "stale", output: "../../outside.txt", size: 7 }
				}
			})
		);

		await assert.rejects(buildTheme({ projectRoot, sourceRoot, outputRoot, cacheFile }), /Unsafe manifest output path/);
		assert.equal(await readFile(protectedFile, "utf8"), "keep me");
	});
});
