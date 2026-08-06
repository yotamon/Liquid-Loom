import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

describe("project doctor", () => {
	it("recognizes a healthy, portable project contract", async () => {
		const projectRoot = await mkdtemp(path.join(os.tmpdir(), "liquid-loom-doctor-"));
		temporaryDirectories.push(projectRoot);
		await write(projectRoot, "package.json", '{"name":"store","description":"Theme","license":"MIT"}');
		await write(projectRoot, "README.md", "# Store");
		await write(projectRoot, "LICENSE", "MIT");
		await write(projectRoot, ".gitignore", "node_modules/\ndist/\n.cache/\n");
		await write(projectRoot, "vite.config.js", "export default {};");
		await write(projectRoot, "src/theme/layout/theme.liquid", "{{ content_for_layout }}");
		await write(projectRoot, "src/theme/templates/index.json", '{"sections":{},"order":[]}');
		await write(projectRoot, "src/theme/config/settings_schema.json", "[]");

		const result = await diagnoseProject({
			projectRoot,
			sourceRoot: path.join(projectRoot, "src"),
			outputRoot: path.join(projectRoot, "dist", "theme"),
			viteConfig: path.join(projectRoot, "vite.config.js"),
			forbiddenTerms: []
		});

		assert.equal(result.healthy, true);
		assert.equal(
			result.checks.every((check) => check.status === "pass"),
			true
		);
	});

	it("reports missing project essentials and configured private content", async () => {
		const projectRoot = await mkdtemp(path.join(os.tmpdir(), "liquid-loom-doctor-"));
		temporaryDirectories.push(projectRoot);
		await write(projectRoot, "notes.md", "private-client");

		const result = await diagnoseProject({
			projectRoot,
			sourceRoot: path.join(projectRoot, "src"),
			outputRoot: path.join(projectRoot, "dist", "theme"),
			viteConfig: path.join(projectRoot, "vite.config.js"),
			forbiddenTerms: ["private-client"]
		});

		assert.equal(result.healthy, false);
		assert.equal(
			result.checks.some((check) => check.name === "private-content" && check.status === "fail"),
			true
		);
		assert.equal(
			result.checks.some((check) => check.name === "theme-source" && check.status === "fail"),
			true
		);
	});
});
