import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
	it("generates package-manager-specific metadata and starter commands", async () => {
		const workspace = await createWorkspace();
		for (const manager of ["pnpm", "npm", "yarn", "bun"]) {
			const targetDirectory = path.join(workspace, "store-" + manager);
			await scaffoldProject({
				targetDirectory,
				projectName: "store-" + manager,
				packageManager: manager,
				install: false
			});
			const manifest = JSON.parse(await readFile(path.join(targetDirectory, "package.json"), "utf8"));
			const readme = await readFile(path.join(targetDirectory, "README.md"), "utf8");
			assert.equal(manifest.packageManager, manager === "pnpm" ? "pnpm@11.11.0" : undefined);
			const run = manager === "npm" || manager === "bun" ? `${manager} run` : manager;
			assert.ok(readme.includes(manager + " install"));
			assert.ok(readme.includes(run + " dev"));
			assert.ok(readme.includes(run + " build"));
			assert.ok(readme.includes(run + " doctor"));
			assert.doesNotMatch(readme, /__[A-Z_]+__/);
		}
	});

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

	it("prints the correct next command when invoked with npm", async () => {
		const workspace = await createWorkspace();
		const targetDirectory = path.join(workspace, "new-store");
		const cli = path.resolve(import.meta.dirname, "../packages/create-liquid-loom/cli.js");
		const result = spawnSync(process.execPath, [cli, targetDirectory, "--no-install", "--package-manager", "npm"], {
			cwd: workspace,
			encoding: "utf8"
		});
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /npm run dev/);
		assert.doesNotMatch(result.stdout, /pnpm dev/);
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
