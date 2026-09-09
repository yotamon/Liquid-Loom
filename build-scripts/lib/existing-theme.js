import { spawn } from "node:child_process";
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { createBuildPlan, discoverSourceEntries, mapShopifyPath, mapThemePath } from "./theme-builder.js";

const PACKAGE_MANAGER_LOCKS = [
	["pnpm", "pnpm-lock.yaml"],
	["npm", "package-lock.json"],
	["yarn", "yarn.lock"],
	["bun", "bun.lock"],
	["bun", "bun.lockb"]
];
const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn", "bun"]);
const CONFIG_FILES = ["liquid-loom.config.ts", "liquid-loom.config.mts", "liquid-loom.config.js", "liquid-loom.config.mjs"];
const LOOM_SCRIPTS = {
	"loom:build": "liquid-loom build",
	"loom:watch": "liquid-loom watch",
	"loom:dev": "liquid-loom dev",
	"loom:doctor": "liquid-loom doctor"
};

async function fileExists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

function toPosix(value) {
	return value.split(path.sep).join("/");
}

function normalizeProjectRelative(value, label) {
	const normalized = path.posix.normalize(String(value).replaceAll("\\", "/").replace(/^\.\//, ""));
	if (!normalized || normalized === "." || path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) {
		throw new Error(`${label} must be a path inside the project.`);
	}
	return normalized;
}

function themeDirConfigValue(projectRoot, themeRoot) {
	const relative = toPosix(path.relative(projectRoot, themeRoot));
	return relative || ".";
}

export async function detectShopifyTheme(projectRoot, themeDir = ".") {
	const relative = themeDir === "." ? "." : normalizeProjectRelative(themeDir, "Theme directory");
	const themeRoot = path.resolve(projectRoot, relative);
	const layoutFile = path.join(themeRoot, "layout", "theme.liquid");
	if (!(await fileExists(layoutFile))) {
		throw new Error(`No Shopify theme found at ${relative}. Expected layout/theme.liquid.`);
	}
	return themeRoot;
}

export async function detectPackageManager(projectRoot, explicit) {
	if (explicit) {
		if (!PACKAGE_MANAGERS.has(explicit)) throw new Error(`Unsupported package manager: ${explicit}`);
		return explicit;
	}
	try {
		const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));
		const declared = typeof packageJson.packageManager === "string" ? packageJson.packageManager.split("@")[0] : undefined;
		if (PACKAGE_MANAGERS.has(declared)) return declared;
	} catch {
		// Fall through to lockfile and invocation detection.
	}
	for (const [manager, lockFile] of PACKAGE_MANAGER_LOCKS) {
		if (await fileExists(path.join(projectRoot, lockFile))) return manager;
	}
	const userAgent = process.env.npm_config_user_agent;
	if (typeof userAgent === "string") {
		const invoked = userAgent.split(" ")[0]?.split("/")[0];
		if (PACKAGE_MANAGERS.has(invoked)) return invoked;
	}
	return "npm";
}

async function countThemeFiles(themeRoot) {
	let total = 0;
	for (const directory of ["assets", "blocks", "config", "layout", "locales", "sections", "snippets", "templates"]) {
		const root = path.join(themeRoot, directory);
		if (!(await fileExists(root))) continue;
		const stack = [root];
		while (stack.length) {
			const current = stack.pop();
			for (const entry of await readdir(current, { withFileTypes: true })) {
				if (entry.isDirectory()) stack.push(path.join(current, entry.name));
				else if (entry.isFile()) total += 1;
			}
		}
	}
	return total;
}

function packageNameFromRoot(projectRoot) {
	return path
		.basename(projectRoot)
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "") || "shopify-theme";
}

async function buildInitFiles({ projectRoot, themeRoot, packageVersion }) {
	const mutations = [];
	const packageFile = path.join(projectRoot, "package.json");
	let packageJson;
	if (await fileExists(packageFile)) {
		packageJson = JSON.parse(await readFile(packageFile, "utf8"));
	} else {
		packageJson = { name: packageNameFromRoot(projectRoot), private: true };
	}
	packageJson.scripts = { ...(packageJson.scripts ?? {}) };
	for (const [name, command] of Object.entries(LOOM_SCRIPTS)) {
		if (packageJson.scripts[name] && packageJson.scripts[name] !== command) {
			throw new Error(`package.json already defines ${name}; Liquid Loom will not overwrite it.`);
		}
		packageJson.scripts[name] = command;
	}
	packageJson.devDependencies = { ...(packageJson.devDependencies ?? {}) };
	packageJson.devDependencies["liquid-loom"] = `^${packageVersion}`;
	mutations.push({ path: packageFile, content: `${JSON.stringify(packageJson, null, 2)}\n` });

	for (const configName of CONFIG_FILES) {
		if (await fileExists(path.join(projectRoot, configName))) {
			throw new Error(`${configName} already exists. Refusing to replace an existing Liquid Loom configuration.`);
		}
	}
	const configFile = path.join(projectRoot, "liquid-loom.config.mjs");
	const themeDir = themeDirConfigValue(projectRoot, themeRoot);
	mutations.push({
		path: configFile,
		content: `import { defineConfig } from "liquid-loom";\n\nexport default defineConfig({\n\tshopifySourceDir: ${JSON.stringify(themeDir)},\n\tsourceDir: "src",\n\toutputDir: "dist/theme",\n\tviteConfig: false\n});\n`
	});

	const gitignoreFile = path.join(projectRoot, ".gitignore");
	let gitignore = (await fileExists(gitignoreFile)) ? await readFile(gitignoreFile, "utf8") : "";
	const additions = [];
	for (const entry of ["dist/", ".cache/"]) {
		if (!gitignore.split(/\r?\n/).some((line) => line.trim() === entry || line.trim() === entry.replace(/\/$/, ""))) additions.push(entry);
	}
	if (additions.length) {
		if (gitignore && !gitignore.endsWith("\n")) gitignore += "\n";
		gitignore += `${additions.join("\n")}\n`;
		mutations.push({ path: gitignoreFile, content: gitignore });
	}
	return mutations;
}

async function applyTextTransaction(mutations) {
	const originals = [];
	try {
		for (const mutation of mutations) {
			const existed = await fileExists(mutation.path);
			originals.push({ path: mutation.path, existed, content: existed ? await readFile(mutation.path) : undefined });
			await mkdir(path.dirname(mutation.path), { recursive: true });
			await writeFile(mutation.path, mutation.content);
		}
	} catch (error) {
		for (const original of originals.reverse()) {
			if (original.existed) await writeFile(original.path, original.content);
			else await rm(original.path, { force: true });
		}
		throw error;
	}
}

function runInstall(packageManager, projectRoot) {
	return new Promise((resolve, reject) => {
		const child =
			process.platform === "win32"
				? spawn(process.env.ComSpec, ["/d", "/s", "/c", `${packageManager} install`], {
						cwd: projectRoot,
						stdio: "inherit"
					})
				: spawn(packageManager, ["install"], { cwd: projectRoot, stdio: "inherit" });
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (code === 0) resolve();
			else reject(new Error(`${packageManager} install failed${signal ? ` with ${signal}` : ` with exit code ${code}`}.`));
		});
	});
}

export async function planExistingThemeInit({ projectRoot, themeDir = ".", packageManager, packageVersion }) {
	const themeRoot = await detectShopifyTheme(projectRoot, themeDir);
	const manager = await detectPackageManager(projectRoot, packageManager);
	const mutations = await buildInitFiles({ projectRoot, themeRoot, packageVersion });
	return {
		packageManager: manager,
		themeRoot,
		themeFiles: await countThemeFiles(themeRoot),
		mutations: await Promise.all(
			mutations.map(async (mutation) => ({
				path: toPosix(path.relative(projectRoot, mutation.path)),
				action: (await fileExists(mutation.path)) ? "update" : "create"
			}))
		)
	};
}

export async function initializeExistingTheme({
	projectRoot,
	themeDir = ".",
	packageManager,
	packageVersion,
	install = true,
	dryRun = false
}) {
	const themeRoot = await detectShopifyTheme(projectRoot, themeDir);
	const manager = await detectPackageManager(projectRoot, packageManager);
	const mutations = await buildInitFiles({ projectRoot, themeRoot, packageVersion });
	const plan = {
		packageManager: manager,
		themeRoot,
		themeFiles: await countThemeFiles(themeRoot),
		mutations: mutations.map((mutation) => ({
			path: toPosix(path.relative(projectRoot, mutation.path)),
			action: "write"
		}))
	};
	if (dryRun) return { ...plan, applied: false };

	await applyTextTransaction(mutations);
	for (const directory of [
		"src/public",
		"src/theme/blocks",
		"src/theme/config",
		"src/theme/layout",
		"src/theme/locales",
		"src/theme/sections",
		"src/theme/snippets",
		"src/theme/templates"
	]) {
		await mkdir(path.join(projectRoot, ...directory.split("/")), { recursive: true });
	}
	if (install) await runInstall(manager, projectRoot);
	return { ...plan, applied: true };
}

function defaultMigrationTarget(nativePath) {
	const normalized = normalizeProjectRelative(nativePath, "Migration source");
	const [directory, ...rest] = normalized.split("/");
	if (directory === "assets") return `public/${rest.join("/")}`;
	return `theme/${normalized}`;
}

function normalizeMigrationTarget(target) {
	let normalized = normalizeProjectRelative(target, "Migration target");
	if (normalized.startsWith("src/")) normalized = normalized.slice(4);
	if (!normalized.startsWith("theme/") && !normalized.startsWith("public/")) {
		throw new Error("Migration target must be under theme/ or public/ inside the Liquid Loom source root.");
	}
	return normalized;
}

export async function planMigration(config, { target, all = false, to } = {}) {
	if (!config.shopifySourceRoot) throw new Error("This project has no shopifySourceDir. Run liquid-loom init first.");
	if (all && target) throw new Error("Use either a migration target or --all, not both.");
	if (!all && !target) throw new Error("Provide a Shopify file/directory to migrate, or use --all.");
	if (to && all) throw new Error("--to is only supported for a single file migration.");

	const entries = await discoverSourceEntries({
		projectRoot: config.projectRoot,
		sourceRoot: config.sourceRoot,
		shopifySourceRoot: config.shopifySourceRoot
	});
	const nativeEntries = entries.filter((entry) => entry.kind === "shopify");
	let selected;
	if (all) {
		selected = nativeEntries;
		if (!selected.length) throw new Error("No Shopify source files remain to migrate.");
	} else {
		const normalizedTarget = normalizeProjectRelative(target, "Migration source");
		selected = nativeEntries.filter(
			(entry) => entry.relativePath === normalizedTarget || entry.relativePath.startsWith(`${normalizedTarget}/`)
		);
		if (!selected.length) throw new Error(`No Shopify source files matched: ${normalizedTarget}`);
	}
	if (to && selected.length !== 1) throw new Error("--to requires a migration target that resolves to exactly one file.");

	const moves = [];
	for (const entry of selected) {
		const destination = to ? normalizeMigrationTarget(to) : defaultMigrationTarget(entry.relativePath);
		const nativeOutput = mapShopifyPath(entry.relativePath);
		const organizedOutput = mapThemePath(destination);
		if (nativeOutput !== organizedOutput) {
			throw new Error(`Migration would change Shopify output from ${nativeOutput} to ${organizedOutput}.`);
		}
		const destinationPath = path.join(config.sourceRoot, ...destination.split("/"));
		if (await fileExists(destinationPath)) throw new Error(`Migration destination already exists: ${destination}`);
		moves.push({
			from: path.join(config.shopifySourceRoot, ...entry.relativePath.split("/")),
			fromDisplay: entry.displayPath,
			to: destinationPath,
			toDisplay: toPosix(path.relative(config.projectRoot, destinationPath)),
			output: nativeOutput,
			destination
		});
	}

	const selectedPaths = new Set(selected.map((entry) => entry.relativePath));
	const futureEntries = entries
		.filter((entry) => entry.kind !== "shopify" || !selectedPaths.has(entry.relativePath))
		.concat(
			moves.map((move) => ({
				layerId: "loom",
				kind: "organized",
				root: config.sourceRoot,
				relativePath: move.destination,
				displayPath: move.toDisplay
			}))
		);
	createBuildPlan(futureEntries, { reservedOutputs: config.reservedOutputs });
	return moves;
}

export async function applyMigration(config, options) {
	const moves = await planMigration(config, options);
	if (!options.apply) return { applied: false, moves };
	const completed = [];
	try {
		for (const move of moves) {
			await mkdir(path.dirname(move.to), { recursive: true });
			await rename(move.from, move.to);
			completed.push(move);
		}
	} catch (error) {
		const rollbackErrors = [];
		for (const move of completed.reverse()) {
			try {
				await mkdir(path.dirname(move.from), { recursive: true });
				await rename(move.to, move.from);
			} catch (rollbackError) {
				rollbackErrors.push(rollbackError);
			}
		}
		if (rollbackErrors.length) {
			throw new AggregateError([error, ...rollbackErrors], "Migration failed and rollback was incomplete.");
		}
		throw error;
	}
	return { applied: true, moves };
}
