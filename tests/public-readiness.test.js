import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { scanForbiddenContent } from "../build-scripts/lib/public-readiness.js";

const temporaryDirectories = [];

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createFixture() {
	const root = await mkdtemp(path.join(os.tmpdir(), "liquid-loom-scan-"));
	temporaryDirectories.push(root);
	return root;
}

describe("scanForbiddenContent", () => {
	it("returns an empty result for public-safe text files", async () => {
		const root = await createFixture();
		await writeFile(path.join(root, "README.md"), "A clean open-source project.\n");

		assert.deepEqual(await scanForbiddenContent(root), []);
	});

	it("reports legacy brand terms without embedding them in the scanner output", async () => {
		const root = await createFixture();
		const legacyBrand = ["cura", "life"].join("");
		await writeFile(path.join(root, "legacy.txt"), `Remove ${legacyBrand} before publishing.\n`);

		const findings = await scanForbiddenContent(root);

		assert.equal(findings.length, 1);
		assert.equal(findings[0].file, "legacy.txt");
		assert.equal(findings[0].line, 1);
	});

	it("checks binary filenames as well as text contents", async () => {
		const root = await createFixture();
		const legacyProduct = ["cura", "lin"].join("");
		await writeFile(path.join(root, `${legacyProduct}-logo.png`), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

		const findings = await scanForbiddenContent(root);

		assert.equal(findings.length, 1);
		assert.equal(findings[0].category, "legacy-path");
	});

	it("ignores generated and dependency directories", async () => {
		const root = await createFixture();
		const legacyProduct = ["cura", "lin"].join("");
		await mkdir(path.join(root, "dist"), { recursive: true });
		await mkdir(path.join(root, "node_modules", "fixture"), { recursive: true });
		await writeFile(path.join(root, "dist", "theme.txt"), legacyProduct);
		await writeFile(path.join(root, "node_modules", "fixture", "index.js"), legacyProduct);

		assert.deepEqual(await scanForbiddenContent(root), []);
	});
});
