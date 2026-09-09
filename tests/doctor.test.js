import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadProjectConfig } from "../build-scripts/lib/config.js";
import { diagnoseProject } from "../build-scripts/lib/doctor.js";

const temporaryDirectories = [];

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function write(root, relativePath, contents = "") {
	const file = path.join(root, ...relativePath.split("/"));
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, contents);
}

async function project() {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "liquid-loom-doctor-"));
	temporaryDirectories.push(projectRoot);
	return projectRoot;
}

describe("project doctor", () => {
	it("recognizes a healthy, portable project contract", async () => {
		const projectRoot = await project();
		await write(projectRoot, "package.json", '{"name":"store","description":"Theme","license":"MIT"}');
		await write(projectRoot, "README.md", "# Store");
		await write(projectRoot, "LICENSE", "MIT");
		await write(projectRoot, ".gitignore", "node_modules/\ndist/\n.cache/\n");
		await write(projectRoot, "vite.config.js", "export default {};");
		await write(projectRoot, "src/theme/layout/theme.liquid", "{{ content_for_layout }}");
		await write(projectRoot, "src/theme/templates/index.json", '{"sections":{},"order":[]}');
		await write(projectRoot, "src/theme/config/settings_schema.json", "[]");

		const result = await diagnoseProject(await loadProjectConfig(projectRoot));
		assert.equal(result.healthy, true);
		assert.equal(result.checks.every((check) => check.status === "pass"), true);
	});

	it("reports missing project essentials and configured private content", async () => {
		const projectRoot = await project();
		await write(projectRoot, "notes.md", "private-client");
		await write(projectRoot, "liquid-loom.config.mjs", 'export default { forbiddenTerms: ["private-client"] };\n');

		const result = await diagnoseProject(await loadProjectConfig(projectRoot));
		assert.equal(result.healthy, false);
		assert.equal(result.checks.some((check) => check.name === "private-content" && check.status === "fail"), true);
		assert.equal(result.checks.some((check) => check.name === "theme-source" && check.status === "fail"), true);
	});

	it("treats missing docs as warnings for adopted themes and explains disabled bundling", async () => {
		const projectRoot = await project();
		await write(projectRoot, "package.json", '{"name":"legacy-theme","private":true}');
		await write(projectRoot, ".gitignore", "node_modules/\ndist/\n.cache/\n");
		await write(projectRoot, "layout/theme.liquid", "{{ content_for_layout }}");
		await write(projectRoot, "sections/hero.liquid", "<section>Hero</section>");
		await write(projectRoot, "src/entrypoints/theme.js", "export {};");
		await write(
			projectRoot,
			"liquid-loom.config.mjs",
			'export default { shopifySourceDir: ".", sourceDir: "src", viteConfig: false, performance: false };\n'
		);

		const result = await diagnoseProject(await loadProjectConfig(projectRoot));
		assert.equal(result.healthy, true);
		assert.equal(result.checks.some((check) => check.name === "package-metadata" && check.status === "warn"), true);
		assert.equal(result.checks.some((check) => check.name === "documentation" && check.status === "warn"), true);
		assert.equal(result.checks.some((check) => check.name === "source-mode" && /native Shopify/.test(check.message)), true);
		assert.equal(result.checks.some((check) => check.name === "vite-config" && /Disabled/.test(check.message)), true);
		assert.equal(result.checks.some((check) => check.name === "asset-entrypoints" && check.status === "warn"), true);
		assert.equal(result.checks.some((check) => check.name === "performance" && /Disabled/.test(check.message)), true);
	});

	it("fails a hybrid project when native and organized source collide", async () => {
		const projectRoot = await project();
		await write(projectRoot, "package.json", '{"name":"legacy","description":"Theme","license":"MIT"}');
		await write(projectRoot, "README.md", "# Legacy");
		await write(projectRoot, "LICENSE", "MIT");
		await write(projectRoot, ".gitignore", "node_modules/\ndist/\n.cache/\n");
		await write(projectRoot, "layout/theme.liquid", "{{ content_for_layout }}");
		await write(projectRoot, "sections/hero.liquid", "native");
		await write(projectRoot, "src/theme/sections/home/hero.liquid", "organized");
		await write(projectRoot, "liquid-loom.config.mjs", 'export default { shopifySourceDir: ".", viteConfig: false };\n');

		const result = await diagnoseProject(await loadProjectConfig(projectRoot));
		assert.equal(result.healthy, false);
		assert.equal(
			result.checks.some((check) => check.name === "theme-source" && /Multiple source files map/.test(check.message)),
			true
		);
	});
});
