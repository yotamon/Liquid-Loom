import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function npm(args, cwd) {
	return new Promise((resolve, reject) => {
		const child =
			process.platform === "win32"
				? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", ["npm", ...args].join(" ")], {
						cwd,
						stdio: ["ignore", "pipe", "pipe"]
					})
				: spawn("npm", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
		let output = "";
		let errors = "";
		child.stdout.on("data", (chunk) => {
			output += chunk;
		});
		child.stderr.on("data", (chunk) => {
			errors += chunk;
		});
		child.once("error", reject);
		child.once("close", (code) => {
			if (code !== 0) {
				reject(new Error("npm " + args.slice(0, 3).join(" ") + " failed (" + code + "): " + errors.slice(-1500)));
				return;
			}
			resolve(output.trim());
		});
	});
}

async function write(workspace, relative, value) {
	const target = path.join(workspace, ...relative.split("/"));
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, value);
}

async function latestVersion(name, cwd) {
	const output = await npm(["view", name + "@latest", "version", "--json"], cwd);
	const version = JSON.parse(output);
	if (typeof version !== "string") throw new Error("Unexpected public npm version metadata for " + name);
	return version;
}

const workspace = await mkdtemp(path.join(os.tmpdir(), "liquid-loom-registry-"));
try {
	const [frameworkVersion, creatorVersion] = await Promise.all([
		latestVersion("liquid-loom", workspace),
		latestVersion("create-liquid-loom", workspace)
	]);
	console.log("Public npm versions: liquid-loom " + frameworkVersion + ", create-liquid-loom " + creatorVersion);
	if (frameworkVersion !== creatorVersion) {
		throw new Error("Public npm package versions differ. Align public releases before recommending @latest.");
	}

	const fresh = path.join(workspace, "fresh-store");
	await npm(
		[
			"exec",
			"--yes",
			"--package=create-liquid-loom@latest",
			"--",
			"create-liquid-loom",
			fresh,
			"--no-install",
			"--package-manager",
			"npm"
		],
		workspace
	);
	const freshManifest = JSON.parse(await readFile(path.join(fresh, "package.json"), "utf8"));
	if (freshManifest.devDependencies["liquid-loom"] !== "^" + frameworkVersion) {
		throw new Error("Fresh public scaffold targets an unexpected framework version.");
	}
	await npm(["install", "--ignore-scripts", "--no-audit", "--no-fund"], fresh);
	const installed = await npm(["exec", "--", "liquid-loom", "--version"], fresh);
	if (installed !== frameworkVersion) throw new Error("Fresh installed version does not match public registry.");
	await npm(["run", "build"], fresh);
	const layout = await readFile(path.join(fresh, "dist", "theme", "layout", "theme.liquid"), "utf8");
	if (!layout.includes("content_for_layout")) throw new Error("Fresh scaffold did not produce a Shopify layout.");
	console.log("PASS: public create-liquid-loom fresh scaffold installs and builds.");

	const existing = path.join(workspace, "existing-store");
	await mkdir(existing);
	await write(
		existing,
		"package.json",
		JSON.stringify(
			{
				name: "registry-existing-theme",
				version: "1.0.0",
				private: true,
				devDependencies: { "liquid-loom": frameworkVersion }
			},
			null,
			2
		) + "\n"
	);
	await write(existing, "layout/theme.liquid", "<main>{{ content_for_layout }}</main>");
	await write(existing, "sections/hero.liquid", "<section>Existing theme</section>");
	await write(existing, "assets/theme.css", "body{}");
	await write(existing, ".gitignore", "node_modules/\ndist/\n.cache/\n");
	await npm(["install", "--ignore-scripts", "--no-audit", "--no-fund"], existing);
	await npm(["exec", "--", "liquid-loom", "init", "--yes", "--no-install"], existing);
	await npm(["run", "loom:build"], existing);
	const deployedHero = await readFile(path.join(existing, "dist", "theme", "sections", "hero.liquid"), "utf8");
	if (deployedHero !== "<section>Existing theme</section>") {
		throw new Error("Existing theme content changed during npm registry adoption.");
	}
	console.log("PASS: public liquid-loom adopts and builds an existing Shopify theme.");
	console.log("PASS: public npm cold-install acceptance (no merchant store involved).");
} finally {
	await rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
}
