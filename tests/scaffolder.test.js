import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { scaffoldProject } from "../packages/create-liquid-loom/index.js";

const temporaryDirectories = [];

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createWorkspace() {
	const root = await mkdtemp(path.join(os.tmpdir(), "create-liquid-loom-"));
	temporaryDirectories.push(root);
	return root;
}

describe("create-liquid-loom", () => {
	it("creates a complete, independently installable starter", async () => {
		const workspace = await createWorkspace();
		const targetDirectory = path.join(workspace, "my-storefront");

		await scaffoldProject({ targetDirectory, projectName: "my-storefront", install: false });

		const packageJson = JSON.parse(await readFile(path.join(targetDirectory, "package.json"), "utf8"));
		assert.equal(packageJson.name, "my-storefront");
		assert.equal(packageJson.devDependencies["liquid-loom"], "^0.2.0");
		assert.match(
			await readFile(path.join(targetDirectory, "src", "theme", "layout", "theme.liquid"), "utf8"),
			/content_for_layout/
		);
		assert.match(await readFile(path.join(targetDirectory, "liquid-loom.config.ts"), "utf8"), /defineConfig/);
	});

	it("refuses to overwrite a non-empty directory", async () => {
		const workspace = await createWorkspace();
		const targetDirectory = path.join(workspace, "existing");
		await mkdir(targetDirectory);
		await writeFile(path.join(targetDirectory, "keep.txt"), "important");

		await assert.rejects(
			scaffoldProject({ targetDirectory, projectName: "existing", install: false }),
			/directory is not empty/i
		);
		assert.equal(await readFile(path.join(targetDirectory, "keep.txt"), "utf8"), "important");
	});

	it("accepts only known package-manager executables", async () => {
		const workspace = await createWorkspace();
		await assert.rejects(
			scaffoldProject({
				targetDirectory: path.join(workspace, "unsafe"),
				packageManager: "pnpm && unexpected-command"
			}),
			/unsupported package manager/i
		);
	});

	it("rejects invalid package names before creating files", async () => {
		const workspace = await createWorkspace();
		await assert.rejects(
			scaffoldProject({ targetDirectory: path.join(workspace, "unsafe"), projectName: "../unsafe", install: false }),
			/invalid project name/i
		);
	});
});
