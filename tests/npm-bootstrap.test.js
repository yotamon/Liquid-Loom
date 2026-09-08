import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { createBootstrapPackage } from "../build-scripts/lib/npm-bootstrap.js";

const temporaryDirectories = [];

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createPackageFixture(packageJson) {
	const root = await mkdtemp(path.join(os.tmpdir(), "liquid-loom-npm-bootstrap-"));
	temporaryDirectories.push(root);
	await mkdir(path.join(root, "dist"), { recursive: true });
	await writeFile(path.join(root, "dist", "index.js"), "export {};\n");
	await writeFile(path.join(root, "README.md"), "# Fixture\n");
	await writeFile(path.join(root, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
	return root;
}

describe("npm bootstrap package", () => {
	it("creates an isolated public 0.0.0 package without changing the release package", async () => {
		const sourceRoot = await createPackageFixture({
			name: "liquid-loom-fixture",
			version: "0.1.0",
			files: ["dist", "README.md"],
			publishConfig: { access: "public", provenance: true }
		});
		const targetRoot = path.join(path.dirname(sourceRoot), `${path.basename(sourceRoot)}-bootstrap`);
		temporaryDirectories.push(targetRoot);

		const prepared = await createBootstrapPackage({ sourceRoot, targetRoot });

		assert.equal(prepared.version, "0.0.0");
		assert.deepEqual(prepared.publishConfig, { access: "public", provenance: false });
		assert.equal(await readFile(path.join(targetRoot, "dist", "index.js"), "utf8"), "export {};\n");
		assert.equal(JSON.parse(await readFile(path.join(sourceRoot, "package.json"), "utf8")).version, "0.1.0");
	});

	it("refuses private packages and packages without an explicit files allowlist", async () => {
		const privateRoot = await createPackageFixture({
			name: "private-fixture",
			version: "0.1.0",
			private: true,
			files: ["dist"]
		});
		const noFilesRoot = await createPackageFixture({ name: "no-files-fixture", version: "0.1.0" });

		await assert.rejects(
			createBootstrapPackage({ sourceRoot: privateRoot, targetRoot: path.join(privateRoot, "bootstrap") }),
			/private and cannot be bootstrapped/
		);
		await assert.rejects(
			createBootstrapPackage({ sourceRoot: noFilesRoot, targetRoot: path.join(noFilesRoot, "bootstrap") }),
			/must declare publishable files/
		);
	});
});
