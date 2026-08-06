import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { inspectBuild, validatePerformanceBudgets } from "../build-scripts/lib/performance.js";

const temporaryDirectories = [];

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("performance budgets", () => {
	it("reports total size and the largest deployable asset", async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), "liquid-loom-budget-"));
		temporaryDirectories.push(root);
		await mkdir(path.join(root, "assets"));
		await writeFile(path.join(root, "assets", "theme.js"), "123456");
		await writeFile(path.join(root, "layout.liquid"), "123");

		const report = await inspectBuild(root);

		assert.equal(report.fileCount, 2);
		assert.equal(report.totalBytes, 9);
		assert.deepEqual(report.largestAsset, { file: "assets/theme.js", size: 6 });
	});

	it("fails with actionable errors when size or time budgets regress", async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), "liquid-loom-budget-"));
		temporaryDirectories.push(root);
		await mkdir(path.join(root, "assets"));
		await writeFile(path.join(root, "assets", "theme.js"), "123456");

		await assert.rejects(
			validatePerformanceBudgets(root, { maxAssetBytes: 5, maxBuildMs: 99, maxThemeBytes: 5 }, 100),
			(error) =>
				/theme size/.test(error.message) && /largest asset/.test(error.message) && /build time/.test(error.message)
		);
	});
});
