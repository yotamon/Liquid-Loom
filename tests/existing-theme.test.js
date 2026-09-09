import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
	applyMigration,
	detectPackageManager,
	detectShopifyTheme,
	initializeExistingTheme,
	planExistingThemeInit,
	planMigration
} from "../build-scripts/lib/existing-theme.js";
import { buildTheme } from "../build-scripts/lib/theme-builder.js";

const temporaryDirectories = [];

async function createProject() {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "liquid-loom-existing-"));
	temporaryDirectories.push(projectRoot);
	return projectRoot;
}

async function write(root, relativePath, contents = "") {
	const file = path.join(root, ...relativePath.split("/"));
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, contents);
	return file;
}

async function exists(file) {
	try {
		await access(file);
		return true;
	} catch {
		return false;
	}
}

async function createNativeTheme(projectRoot, prefix = "") {
	const root = prefix ? path.join(projectRoot, prefix) : projectRoot;
	await write(root, "layout/theme.liquid", "<main>{{ content_for_layout }}</main>");
	await write(root, "sections/hero.liquid", "<section>native hero</section>");
	await write(root, "snippets/price.liquid", "{{ product.price }}");
	await write(root, "assets/theme.css", "body{}");
	await write(root, "templates/index.json", '{"sections":{},"order":[]}');
	return root;
}

function resolvedExistingThemeConfig(root) {
	return {
		projectRoot: root,
		sourceRoot: path.join(root, "src"),
		shopifySourceRoot: root,
		outputRoot: path.join(root, "dist", "theme"),
		cacheFile: path.join(root, ".cache", "manifest.json"),
		reservedOutputs: [],
		viteConfig: false,
		viteEnabled: false,
		performance: {
			maxAssetBytes: 500_000,
			maxBuildMs: 10_000,
			maxThemeBytes: 5_000_000
		},
		performanceEnabled: false,
		forbiddenTerms: []
	};
}

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("existing Shopify theme detection", () => {
	it("detects root and nested Shopify themes and rejects missing themes", async () => {
		const root = await createProject();
		await createNativeTheme(root, "theme");
		assert.equal(await detectShopifyTheme(root, "theme"), path.join(root, "theme"));
		await assert.rejects(detectShopifyTheme(root), /No Shopify theme found/);
		await assert.rejects(detectShopifyTheme(root, "../outside"), /inside the project/);
	});

	it("detects package managers deterministically", async () => {
		const root = await createProject();
		assert.equal(await detectPackageManager(root, "pnpm"), "pnpm");
		await assert.rejects(() => detectPackageManager(root, "deno"), /Unsupported package manager/);

		await write(root, "package.json", '{"packageManager":"yarn@4.0.0"}');
		assert.equal(await detectPackageManager(root), "yarn");

		await write(root, "package.json", "not-json");
		await write(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'");
		assert.equal(await detectPackageManager(root), "pnpm");
	});
});

describe("liquid-loom init", () => {
	it("plans and applies a zero-migration setup without touching Shopify source", async () => {
		const root = await createProject();
		await createNativeTheme(root);
		await write(
			root,
			"package.json",
			JSON.stringify({ name: "client-theme", description: "Client theme", license: "MIT", scripts: { test: "node --test" } })
		);
		await write(root, ".gitignore", "node_modules/\n");

		const plan = await planExistingThemeInit({ projectRoot: root, packageVersion: "0.2.0", packageManager: "npm" });
		assert.equal(plan.themeFiles, 5);
		assert.equal(plan.packageManager, "npm");
		assert.equal(plan.mutations.some((item) => item.path === "liquid-loom.config.mjs" && item.action === "create"), true);
		assert.equal(await readFile(path.join(root, "sections", "hero.liquid"), "utf8"), "<section>native hero</section>");

		const dryRun = await initializeExistingTheme({
			projectRoot: root,
			packageVersion: "0.2.0",
			packageManager: "npm",
			install: false,
			dryRun: true
		});
		assert.equal(dryRun.applied, false);
		assert.equal(await exists(path.join(root, "liquid-loom.config.mjs")), false);

		const result = await initializeExistingTheme({
			projectRoot: root,
			packageVersion: "0.2.0",
			packageManager: "npm",
			install: false
		});
		assert.equal(result.applied, true);
		assert.equal(await exists(path.join(root, "src", "theme", "sections")), true);
		assert.equal(await readFile(path.join(root, "sections", "hero.liquid"), "utf8"), "<section>native hero</section>");

		const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
		assert.equal(pkg.scripts.test, "node --test");
		assert.equal(pkg.scripts["loom:build"], "liquid-loom build");
		assert.equal(pkg.devDependencies["liquid-loom"], "^0.2.0");
		const ignore = await readFile(path.join(root, ".gitignore"), "utf8");
		assert.match(ignore, /dist\//);
		assert.match(ignore, /\.cache\//);

		const configText = await readFile(path.join(root, "liquid-loom.config.mjs"), "utf8");
		assert.match(configText, /shopifySourceDir: "\."/);
		assert.match(configText, /viteConfig: false/);
		assert.match(configText, /performance: false/);
	});

	it("refuses to replace config or conflicting namespaced scripts", async () => {
		const root = await createProject();
		await createNativeTheme(root);
		await write(root, "liquid-loom.config.ts", "export default {};");
		await assert.rejects(
			initializeExistingTheme({ projectRoot: root, packageVersion: "0.2.0", packageManager: "npm", install: false }),
			/already exists/
		);

		await rm(path.join(root, "liquid-loom.config.ts"));
		await write(root, "package.json", JSON.stringify({ scripts: { "loom:build": "something-else" } }));
		await assert.rejects(
			initializeExistingTheme({ projectRoot: root, packageVersion: "0.2.0", packageManager: "npm", install: false }),
			/will not overwrite/
		);
	});

	it("rolls back setup files and source directories when dependency installation fails", async () => {
		const root = await createProject();
		await createNativeTheme(root);
		await write(root, "package.json", '{"name":"client","scripts":{"test":"keep"}}');
		await write(root, ".gitignore", "node_modules/\n");
		const beforePackage = await readFile(path.join(root, "package.json"), "utf8");
		const beforeIgnore = await readFile(path.join(root, ".gitignore"), "utf8");

		await assert.rejects(
			initializeExistingTheme({
				projectRoot: root,
				packageVersion: "0.2.0",
				packageManager: "npm",
				install: true,
				installRunner: async () => {
					await write(root, "package-lock.json", "temporary lock");
					throw new Error("install failed");
				}
			}),
			/install failed/
		);

		assert.equal(await readFile(path.join(root, "package.json"), "utf8"), beforePackage);
		assert.equal(await readFile(path.join(root, ".gitignore"), "utf8"), beforeIgnore);
		assert.equal(await exists(path.join(root, "liquid-loom.config.mjs")), false);
		assert.equal(await exists(path.join(root, "src")), false);
		assert.equal(await exists(path.join(root, "package-lock.json")), false);
		assert.equal(await exists(path.join(root, "sections", "hero.liquid")), true);
	});
});

describe("dual-source builds and migration", () => {
	it("builds native Shopify files and new organized files together", async () => {
		const root = await createProject();
		await createNativeTheme(root);
		await initializeExistingTheme({ projectRoot: root, packageVersion: "0.2.0", packageManager: "npm", install: false });
		await write(root, "src/theme/sections/product/upsell.liquid", "<section>upsell</section>");

		const config = resolvedExistingThemeConfig(root);
		const summary = await buildTheme({
			projectRoot: root,
			sourceRoot: config.sourceRoot,
			shopifySourceRoot: config.shopifySourceRoot,
			outputRoot: config.outputRoot,
			cacheFile: config.cacheFile,
			reservedOutputs: config.reservedOutputs
		});
		assert.equal(summary.total, 6);
		assert.equal(await readFile(path.join(config.outputRoot, "sections", "hero.liquid"), "utf8"), "<section>native hero</section>");
		assert.equal(await readFile(path.join(config.outputRoot, "sections", "upsell.liquid"), "utf8"), "<section>upsell</section>");
		assert.equal(await readFile(path.join(config.outputRoot, "assets", "theme.css"), "utf8"), "body{}");
	});

	it("fails instead of silently choosing between native and organized owners", async () => {
		const root = await createProject();
		await createNativeTheme(root);
		await initializeExistingTheme({ projectRoot: root, packageVersion: "0.2.0", packageManager: "npm", install: false });
		await write(root, "src/theme/sections/home/hero.liquid", "<section>organized hero</section>");
		const config = resolvedExistingThemeConfig(root);
		await assert.rejects(
			buildTheme({
				projectRoot: root,
				sourceRoot: config.sourceRoot,
				shopifySourceRoot: config.shopifySourceRoot,
				outputRoot: config.outputRoot,
				cacheFile: config.cacheFile,
				reservedOutputs: config.reservedOutputs
			}),
			/Multiple source files map to sections\/hero\.liquid/
		);
	});

	it("previews and applies an output-preserving single-file migration", async () => {
		const root = await createProject();
		await createNativeTheme(root);
		await initializeExistingTheme({ projectRoot: root, packageVersion: "0.2.0", packageManager: "npm", install: false });
		const config = resolvedExistingThemeConfig(root);

		const preview = await applyMigration(config, { target: "sections/hero.liquid", to: "theme/sections/home/hero.liquid" });
		assert.equal(preview.applied, false);
		assert.equal(preview.moves[0].output, "sections/hero.liquid");
		assert.equal(await exists(path.join(root, "sections", "hero.liquid")), true);

		const applied = await applyMigration(config, {
			target: "sections/hero.liquid",
			to: "src/theme/sections/home/hero.liquid",
			apply: true
		});
		assert.equal(applied.applied, true);
		assert.equal(await exists(path.join(root, "sections", "hero.liquid")), false);
		assert.equal(
			await readFile(path.join(root, "src", "theme", "sections", "home", "hero.liquid"), "utf8"),
			"<section>native hero</section>"
		);

		const summary = await buildTheme({
			projectRoot: root,
			sourceRoot: config.sourceRoot,
			shopifySourceRoot: config.shopifySourceRoot,
			outputRoot: config.outputRoot,
			cacheFile: config.cacheFile,
			reservedOutputs: config.reservedOutputs
		});
		assert.equal(await readFile(path.join(config.outputRoot, "sections", "hero.liquid"), "utf8"), "<section>native hero</section>");
		assert.equal(summary.removed, 0);
	});

	it("supports directory/full migration and rejects unsafe plans", async () => {
		const root = await createProject();
		await createNativeTheme(root);
		await initializeExistingTheme({ projectRoot: root, packageVersion: "0.2.0", packageManager: "npm", install: false });
		const config = resolvedExistingThemeConfig(root);

		const sectionMoves = await planMigration(config, { target: "sections" });
		assert.equal(sectionMoves.length, 1);
		assert.equal(sectionMoves[0].destination, "theme/sections/hero.liquid");
		await assert.rejects(
			planMigration(config, { target: "sections/hero.liquid", to: "theme/snippets/hero.liquid" }),
			/change Shopify output/
		);
		await assert.rejects(planMigration(config, { all: true, target: "sections" }), /either a migration target or --all/);
		await assert.rejects(planMigration(config, {}), /Provide a Shopify file/);

		const all = await planMigration(config, { all: true });
		assert.equal(all.length, 5);
		assert.equal(all.some((move) => move.destination === "public/theme.css"), true);
	});

	it("detects destination and future ownership collisions before moving files", async () => {
		const root = await createProject();
		await createNativeTheme(root);
		await initializeExistingTheme({ projectRoot: root, packageVersion: "0.2.0", packageManager: "npm", install: false });
		const config = resolvedExistingThemeConfig(root);
		await write(root, "src/theme/sections/hero.liquid", "already here");
		await assert.rejects(planMigration(config, { target: "sections/hero.liquid" }), /destination already exists/i);

		await rm(path.join(root, "src", "theme", "sections", "hero.liquid"));
		await write(root, "src/theme/sections/home/other.liquid", "other");
		await assert.rejects(
			planMigration(config, { target: "sections/hero.liquid", to: "theme/sections/home/other.liquid" }),
			/change Shopify output/
		);
	});
});
