import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { defineConfig, loadProjectConfig } from "../build-scripts/lib/config.js";

const temporaryDirectories = [];

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createProject() {
	const root = await mkdtemp(path.join(os.tmpdir(), "liquid-loom-config-"));
	temporaryDirectories.push(root);
	return root;
}

describe("project config", () => {
	it("provides portable defaults relative to the consuming project", async () => {
		const projectRoot = await createProject();
		const config = await loadProjectConfig(projectRoot);

		assert.equal(config.projectRoot, projectRoot);
		assert.equal(config.sourceRoot, path.join(projectRoot, "src"));
		assert.equal(config.outputRoot, path.join(projectRoot, "dist", "theme"));
		assert.deepEqual(config.reservedOutputs, ["assets/style.css", "assets/theme.js"]);
	});

	it("loads a TypeScript configuration file and merges custom settings", async () => {
		const projectRoot = await createProject();
		await writeFile(
			path.join(projectRoot, "liquid-loom.config.ts"),
			`export default {
				sourceDir: "storefront",
				outputDir: "build/shopify",
				forbiddenTerms: ["private-client"],
				performance: { maxBuildMs: 2500, maxThemeBytes: 2000000 }
			};\n`
		);

		const config = await loadProjectConfig(projectRoot);

		assert.equal(config.sourceRoot, path.join(projectRoot, "storefront"));
		assert.equal(config.outputRoot, path.join(projectRoot, "build", "shopify"));
		assert.deepEqual(config.forbiddenTerms, ["private-client"]);
		assert.equal(config.performance.maxBuildMs, 2500);
		assert.equal(config.performance.maxAssetBytes, 500_000);
	});

	it("returns the same strongly-typed shape from defineConfig", () => {
		const input = { sourceDir: "theme-src" };
		assert.equal(defineConfig(input), input);
	});

	it("rejects non-portable paths and invalid performance budgets", async () => {
		const projectRoot = await createProject();
		await writeFile(
			path.join(projectRoot, "liquid-loom.config.mjs"),
			'export default { outputDir: "../outside", performance: { maxBuildMs: -1 } };\n'
		);

		await assert.rejects(loadProjectConfig(projectRoot), /outputDir must be a project-relative path/i);
	});
});
