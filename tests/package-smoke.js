import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { scaffoldProject } from "../packages/create-liquid-loom/index.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const artifacts = path.join(repositoryRoot, ".artifacts");

function run(command, args, cwd) {
	return new Promise((resolve, reject) => {
		const child =
			process.platform === "win32"
				? spawn(process.env.ComSpec, ["/d", "/s", "/c", [command, ...args].join(" ")], { cwd, stdio: "inherit" })
				: spawn(command, args, { cwd, stdio: "inherit" });
		child.once("error", reject);
		child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`))));
	});
}

const tarballs = await readdir(artifacts);
const packageTarball = tarballs.find((file) => /^liquid-loom-\d.*\.tgz$/.test(file));
const creatorTarball = tarballs.find((file) => /^create-liquid-loom-\d.*\.tgz$/.test(file));
if (!packageTarball) throw new Error("Liquid Loom package tarball was not created.");
if (!creatorTarball) throw new Error("Create Liquid Loom package tarball was not created.");

const workspace = await mkdtemp(path.join(os.tmpdir(), "liquid-loom-package-smoke-"));
const target = path.join(workspace, "storefront");

try {
	await scaffoldProject({ targetDirectory: target, projectName: "package-smoke", install: false });
	const packageFile = path.join(target, "package.json");
	const packageJson = JSON.parse(await readFile(packageFile, "utf8"));
	packageJson.devDependencies["liquid-loom"] = `file:${path.join(artifacts, packageTarball)}`;
	packageJson.devDependencies["create-liquid-loom"] = `file:${path.join(artifacts, creatorTarball)}`;
	await writeFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);

	await run("npm", ["install", "--ignore-scripts"], target);
	await run("npm", ["exec", "--", "liquid-loom", "--version"], target);
	await run("npm", ["exec", "--", "create-liquid-loom", "--version"], target);
	await run("npm", ["run", "build"], target);
	console.log("✓ Packed framework and scaffolder CLIs install and execute from an independent scaffold");
} finally {
	try {
		await rm(workspace, { force: true, maxRetries: 10, recursive: true, retryDelay: 200 });
	} catch (error) {
		if (process.platform !== "win32" || error.code !== "EPERM") throw error;
		console.warn(`Package smoke succeeded; Windows deferred temporary cleanup: ${workspace}`);
	}
}
