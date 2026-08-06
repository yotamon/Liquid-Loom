import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { mkdtemp, mkdir, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
	BuildCollisionError,
	assertSafeOutput,
	buildProject,
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

	it("treats destination paths as case-insensitive and Unicode-normalized", () => {
		assert.throws(
			() => createBuildPlan(["theme/sections/home/Hero.liquid", "theme/sections/product/hero.liquid"]),
			(error) => error instanceof BuildCollisionError && error.destination === "sections/hero.liquid"
		);

		assert.throws(
			() => createBuildPlan(["public/caf\u00e9.svg", "public/cafe\u0301.svg"]),
			(error) => error instanceof BuildCollisionError && error.destination === "assets/caf\u00e9.svg"
		);
	});

	it("rejects static files that overwrite generated bundle outputs", () => {
		assert.throws(
			() =>
				createBuildPlan(["public/theme.js"], {
					reservedOutputs: ["assets/theme.js", "assets/style.css"]
				}),
			(error) =>
				error instanceof BuildCollisionError &&
				error.destination === "assets/theme.js" &&
				error.sources.includes("<generated:assets/theme.js>")
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

describe("buildProject", () => {
	it("recovers an abandoned build lock from a terminated process", async () => {
		const { projectRoot, sourceRoot, outputRoot, cacheFile } = await createTemporaryProject();
		await createMinimumTheme(sourceRoot);
		await mkdir(path.dirname(cacheFile), { recursive: true });
		await writeFile(`${cacheFile}.lock`, "999999999\n");

		await buildProject({ projectRoot, sourceRoot, outputRoot, cacheFile, bundle: async () => {} });

		await assert.rejects(readFile(`${cacheFile}.lock`, "utf8"), { code: "ENOENT" });
	});

	it("serializes concurrent builds that target the same project", async () => {
		const { projectRoot, sourceRoot, outputRoot, cacheFile } = await createTemporaryProject();
		await createMinimumTheme(sourceRoot);
		let activeBundles = 0;
		let maximumConcurrency = 0;
		const bundle = async () => {
			activeBundles += 1;
			maximumConcurrency = Math.max(maximumConcurrency, activeBundles);
			await new Promise((resolve) => setTimeout(resolve, 60));
			activeBundles -= 1;
		};

		await Promise.all([
			buildProject({ projectRoot, sourceRoot, outputRoot, cacheFile, bundle }),
			buildProject({ projectRoot, sourceRoot, outputRoot, cacheFile, bundle })
		]);

		assert.equal(maximumConcurrency, 1);
	});

	it("keeps the last successful output and cache when bundling fails", async () => {
		const { projectRoot, sourceRoot, outputRoot, cacheFile } = await createTemporaryProject();
		await createMinimumTheme(sourceRoot);
		await mkdir(outputRoot, { recursive: true });
		await mkdir(path.dirname(cacheFile), { recursive: true });
		await writeFile(path.join(outputRoot, "last-good.txt"), "stable");
		await writeFile(cacheFile, '{"version":1,"files":{}}\n');

		await assert.rejects(
			buildProject({
				projectRoot,
				sourceRoot,
				outputRoot,
				cacheFile,
				bundle: async ({ outputRoot: stagingRoot }) => {
					await writeFile(path.join(stagingRoot, "partial.txt"), "incomplete");
					throw new Error("bundle failed");
				}
			}),
			/bundle failed/
		);

		assert.equal(await readFile(path.join(outputRoot, "last-good.txt"), "utf8"), "stable");
		assert.equal(await readFile(cacheFile, "utf8"), '{"version":1,"files":{}}\n');
		assert.equal(
			(await readdir(path.dirname(outputRoot))).some((name) => name.includes("staging")),
			false
		);
	});

	it("publishes static and generated files together after a successful bundle", async () => {
		const { projectRoot, sourceRoot, outputRoot, cacheFile } = await createTemporaryProject();
		await createMinimumTheme(sourceRoot);
		await mkdir(outputRoot, { recursive: true });
		await writeFile(path.join(outputRoot, "obsolete.txt"), "remove me");

		await buildProject({
			projectRoot,
			sourceRoot,
			outputRoot,
			cacheFile,
			clean: true,
			bundle: async ({ outputRoot: stagingRoot }) => {
				await mkdir(path.join(stagingRoot, "assets"), { recursive: true });
				await writeFile(path.join(stagingRoot, "assets", "theme.js"), "export {};");
				await writeFile(path.join(stagingRoot, "assets", "style.css"), "body{}");
			}
		});

		assert.equal(await readFile(path.join(outputRoot, "assets", "theme.js"), "utf8"), "export {};");
		await assert.rejects(readFile(path.join(outputRoot, "obsolete.txt"), "utf8"), { code: "ENOENT" });
	});

	it("removes stale generated bundles and source maps before bundling", async () => {
		const { projectRoot, sourceRoot, outputRoot, cacheFile } = await createTemporaryProject();
		await createMinimumTheme(sourceRoot);
		await mkdir(path.join(outputRoot, "assets"), { recursive: true });
		await writeFile(path.join(outputRoot, "assets", "theme.js"), "old bundle");
		await writeFile(path.join(outputRoot, "assets", "theme.js.map"), "old map");

		await buildProject({
			projectRoot,
			sourceRoot,
			outputRoot,
			cacheFile,
			bundle: async ({ outputRoot: stagingRoot }) => {
				await writeFile(path.join(stagingRoot, "assets", "theme.js"), "new bundle");
			}
		});

		assert.equal(await readFile(path.join(outputRoot, "assets", "theme.js"), "utf8"), "new bundle");
		await assert.rejects(readFile(path.join(outputRoot, "assets", "theme.js.map"), "utf8"), { code: "ENOENT" });
	});
});
