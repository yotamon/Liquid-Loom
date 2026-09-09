import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
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

async function write(root, relativePath, contents) {
	const file = path.join(root, ...relativePath.split("/"));
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, contents);
}

const tarballs = await readdir(artifacts);
const packageTarball = tarballs.find((file) => /^liquid-loom-\d.*\.tgz$/.test(file));
const creatorTarball = tarballs.find((file) => /^create-liquid-loom-\d.*\.tgz$/.test(file));
if (!packageTarball) throw new Error("Liquid Loom package tarball was not created.");
if (!creatorTarball) throw new Error("Create Liquid Loom package tarball was not created.");

const packageSpec = `file:${path.join(artifacts, packageTarball)}`;
const workspace = await mkdtemp(path.join(os.tmpdir(), "liquid-loom-package-smoke-"));
const target = path.join(workspace, "storefront");
const existingTarget = path.join(workspace, "existing-theme");

try {
	await scaffoldProject({ targetDirectory: target, projectName: "package-smoke", install: false });
	const packageFile = path.join(target, "package.json");
	const packageJson = JSON.parse(await readFile(packageFile, "utf8"));
	packageJson.devDependencies["liquid-loom"] = packageSpec;
	packageJson.devDependencies["create-liquid-loom"] = `file:${path.join(artifacts, creatorTarball)}`;
	await writeFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);

	await run("npm", ["install", "--ignore-scripts"], target);
	await run("npm", ["exec", "--", "liquid-loom", "--version"], target);
	await run("npm", ["exec", "--", "create-liquid-loom", "--version"], target);
	await run("npm", ["run", "build"], target);

	await mkdir(existingTarget, { recursive: true });
	await write(
		existingTarget,
		"package.json",
		`${JSON.stringify(
			{
				name: "existing-theme-smoke",
				description: "Existing Shopify theme smoke fixture",
				license: "MIT",
				private: true,
				devDependencies: { "liquid-loom": packageSpec }
			},
			null,
			2
		)}\n`
	);
	await write(existingTarget, "layout/theme.liquid", "<main>{{ content_for_layout }}</main>");
	await write(existingTarget, "sections/hero.liquid", "<section>existing hero</section>");
	await write(existingTarget, "assets/theme.css", "body{}");
	await write(existingTarget, ".gitignore", "node_modules/\n");

	await run("npm", ["install", "--ignore-scripts"], existingTarget);
	await run("npm", ["exec", "--", "liquid-loom", "init", "--no-install", "--yes"], existingTarget);
	await run("npm", ["run", "loom:build"], existingTarget);
	await write(existingTarget, "src/theme/sections/product/upsell.liquid", "<section>upsell</section>");
	await run("npm", ["run", "loom:build"], existingTarget);
	await run("npm", ["exec", "--", "liquid-loom", "migrate", "sections/hero.liquid", "--apply"], existingTarget);
	await run("npm", ["run", "loom:build"], existingTarget);

	if ((await readFile(path.join(existingTarget, "dist", "theme", "sections", "hero.liquid"), "utf8")) !== "<section>existing hero</section>") {
		throw new Error("Existing-theme migration changed the deployed hero output.");
	}
	if ((await readFile(path.join(existingTarget, "dist", "theme", "sections", "upsell.liquid"), "utf8")) !== "<section>upsell</section>") {
		throw new Error("Hybrid source did not produce the organized upsell output.");
	}

	console.log("✓ Packed CLIs scaffold new themes and adopt/migrate existing Shopify themes");
} finally {
	try {
		await rm(workspace, { force: true, maxRetries: 10, recursive: true, retryDelay: 200 });
	} catch (error) {
		if (process.platform !== "win32" || error.code !== "EPERM") throw error;
		console.warn(`Package smoke succeeded; Windows deferred temporary cleanup: ${workspace}`);
	}
}
