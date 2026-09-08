import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { createBootstrapPackage } from "../build-scripts/lib/npm-bootstrap.js";
import { npmInvocation } from "../build-scripts/npm-release-setup.js";

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

describe("npm command invocation", () => {
	it("uses cmd.exe explicitly on Windows so npm.cmd can execute without shell mode", () => {
		assert.deepEqual(npmInvocation(["whoami"], { platform: "win32", comspec: "C:\\Windows\\System32\\cmd.exe" }), {
			command: "C:\\Windows\\System32\\cmd.exe",
			args: ["/d", "/s", "/c", "npm whoami"]
		});
	});

	it("keeps npm arguments as an argv array outside Windows", () => {
		assert.deepEqual(npmInvocation(["publish", "--tag", "bootstrap"], { platform: "linux" }), {
			command: "npm",
			args: ["publish", "--tag", "bootstrap"]
		});
	});

	it("rejects shell metacharacters in Windows npm arguments", () => {
		assert.throws(
			() => npmInvocation(["publish", "package & calc"], { platform: "win32", comspec: "cmd.exe" }),
			/Unsafe npm argument/
		);
	});
});
