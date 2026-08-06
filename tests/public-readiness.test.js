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

		assert.deepEqual(await scanForbiddenContent(root, ["private-client"]), []);
	});

	it("reports project-configured private terms without embedding them in scanner output", async () => {
		const root = await createFixture();
		const privateTerm = ["private", "-client"].join("");
		await writeFile(path.join(root, "legacy.txt"), `Remove ${privateTerm} before publishing.\n`);

		const findings = await scanForbiddenContent(root, [privateTerm]);

		assert.equal(findings.length, 1);
		assert.equal(findings[0].file, "legacy.txt");
		assert.equal(findings[0].line, 1);
	});

	it("checks binary filenames as well as text contents", async () => {
		const root = await createFixture();
		const privateTerm = ["private", "-client"].join("");
		await writeFile(path.join(root, `${privateTerm}-logo.png`), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

		const findings = await scanForbiddenContent(root, [privateTerm]);

		assert.equal(findings.length, 1);
		assert.equal(findings[0].category, "legacy-path");
	});

	it("ignores generated and dependency directories", async () => {
		const root = await createFixture();
		const privateTerm = ["private", "-client"].join("");
		await mkdir(path.join(root, "dist"), { recursive: true });
		await mkdir(path.join(root, "node_modules", "fixture"), { recursive: true });
		await writeFile(path.join(root, "dist", "theme.txt"), privateTerm);
		await writeFile(path.join(root, "node_modules", "fixture", "index.js"), privateTerm);

		assert.deepEqual(await scanForbiddenContent(root, [privateTerm]), []);
	});
});
