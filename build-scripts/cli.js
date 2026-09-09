#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import chokidar from "chokidar";
import { Command } from "commander";
import { build as viteBuild } from "vite";

import { loadProjectConfig } from "./lib/config.js";
import { diagnoseProject } from "./lib/doctor.js";
import {
	applyMigration,
	initializeExistingTheme,
	planExistingThemeInit,
	planMigration
} from "./lib/existing-theme.js";
import { validatePerformanceBudgets } from "./lib/performance.js";
import { scanForbiddenContent } from "./lib/public-readiness.js";
import {
	SHOPIFY_THEME_DIRECTORIES,
	assertSafeOutput,
	buildProject,
	createBuildPlan,
	discoverSourceEntries,
	validateThemePlan
} from "./lib/theme-builder.js";

const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PACKAGE_METADATA = JSON.parse(await readFile(path.join(PACKAGE_ROOT, "package.json"), "utf8"));
let projectConfigPromise;

function getProjectConfig() {
	projectConfigPromise ??= loadProjectConfig(process.cwd());
	return projectConfigPromise;
}

function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
	return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}

function printHeader(label) {
	console.log(`\n${chalk.hex("#4de3c1").bold("LIQUID LOOM")} ${chalk.dim("·")} ${chalk.bold(label)}`);
}

async function fileExists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function listFiles(directory, root = directory) {
	if (!(await fileExists(directory))) return [];
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await listFiles(entryPath, root)));
		else if (entry.isFile()) {
			files.push({
				absolute: entryPath,
				relative: path.relative(root, entryPath).split(path.sep).join("/")
			});
		}
	}
	return files;
}

async function runBuild({ clean = false, mode = "production", quiet = false } = {}) {
	const config = await getProjectConfig();
	const start = performance.now();
	if (!quiet) printHeader(mode === "production" ? "production build" : "development build");

	const summary = await buildProject({
		projectRoot: config.projectRoot,
		sourceRoot: config.sourceRoot,
		shopifySourceRoot: config.shopifySourceRoot,
		outputRoot: config.outputRoot,
		cacheFile: config.cacheFile,
		reservedOutputs: config.reservedOutputs,
		clean,
		bundle: async ({ outputRoot }) => {
			if (config.viteEnabled) {
				await viteBuild({
					configFile: config.viteConfig,
					logLevel: quiet ? "silent" : "warn",
					mode,
					build: {
						emptyOutDir: false,
						outDir: path.join(outputRoot, "assets")
					}
				});
			}
			if (config.performanceEnabled) {
				await validatePerformanceBudgets(outputRoot, config.performance, performance.now() - start);
			}
		}
	});

	if (!quiet) {
		const duration = ((performance.now() - start) / 1000).toFixed(2);
		console.log(
			`${chalk.green("✓")} ${summary.total} theme files · ${summary.copied} copied · ${summary.skipped} cached · ${summary.removed} removed · ${formatBytes(summary.bytes)} · ${duration}s`
		);
		console.log(`${chalk.dim("output")} ${path.relative(config.projectRoot, config.outputRoot)}`);
		if (!config.viteEnabled) console.log(`${chalk.dim("assets")} existing asset workflow preserved (Vite disabled)`);
	}
	return summary;
}

async function cleanProject() {
	const config = await getProjectConfig();
	assertSafeOutput(config);
	await Promise.all([
		rm(config.outputRoot, { recursive: true, force: true }),
		rm(path.dirname(config.cacheFile), { recursive: true, force: true })
	]);
	console.log(`${chalk.green("✓")} Removed generated theme output and cache`);
}

async function sourcePlan(config) {
	const entries = await discoverSourceEntries({
		projectRoot: config.projectRoot,
		sourceRoot: config.sourceRoot,
		shopifySourceRoot: config.shopifySourceRoot
	});
	return { entries, plan: createBuildPlan(entries, { reservedOutputs: config.reservedOutputs }) };
}

async function checkProject() {
	const config = await getProjectConfig();
	printHeader("project check");
	const errors = [];
	let entries = [];
	try {
		const result = await sourcePlan(config);
		entries = result.entries;
		const validation = validateThemePlan(result.plan);
		for (const file of validation.missing) errors.push(`Missing Shopify source output: ${file}`);
	} catch (error) {
		errors.push(error.message);
	}

	for (const entry of entries) {
		if (path.extname(entry.relativePath).toLowerCase() !== ".json") continue;
		try {
			JSON.parse(await readFile(path.join(entry.root, ...entry.relativePath.split("/")), "utf8"));
		} catch (error) {
			errors.push(`Invalid JSON: ${entry.displayPath} (${error.message})`);
		}
	}

	if (!(await fileExists(path.join(config.outputRoot, "layout", "theme.liquid")))) {
		errors.push("Missing build output: layout/theme.liquid");
	}

	if (errors.length) {
		for (const error of errors) console.error(`${chalk.red("×")} ${error}`);
		throw new Error(`Project check failed with ${errors.length} error${errors.length === 1 ? "" : "s"}.`);
	}
	console.log(`${chalk.green("✓")} Source ownership, JSON, and Shopify upload minimum are valid`);
}

async function analyzeProject() {
	const config = await getProjectConfig();
	printHeader("build analysis");
	const files = await listFiles(config.outputRoot);
	if (files.length === 0) throw new Error("No build found. Run liquid-loom build first.");

	const entries = await Promise.all(
		files.map(async (file) => ({
			...file,
			size: (await readFile(file.absolute)).byteLength,
			type: path.extname(file.absolute).toLowerCase() || "other"
		}))
	);
	const totalBytes = entries.reduce((total, file) => total + file.size, 0);
	const byType = Map.groupBy(entries, (file) => file.type);
	console.log(`${entries.length} files · ${formatBytes(totalBytes)} total`);
	for (const [type, typeFiles] of [...byType.entries()].sort(([left], [right]) => left.localeCompare(right))) {
		console.log(
			`  ${type.padEnd(8)} ${String(typeFiles.length).padStart(3)} files  ${formatBytes(typeFiles.reduce((total, file) => total + file.size, 0)).padStart(10)}`
		);
	}
	console.log(`\n${chalk.bold("Largest files")}`);
	for (const file of entries.sort((left, right) => right.size - left.size).slice(0, 8)) {
		console.log(`  ${formatBytes(file.size).padStart(10)}  ${file.relative}`);
	}
}

async function checkPublicReadiness() {
	const config = await getProjectConfig();
	printHeader("public-readiness scan");
	const findings = await scanForbiddenContent(config.projectRoot, config.forbiddenTerms);
	if (findings.length) {
		for (const finding of findings) {
			const location = finding.line === 0 ? finding.file : `${finding.file}:${finding.line}:${finding.column}`;
			console.error(`${chalk.red("×")} ${location} contains excluded legacy content`);
		}
		throw new Error(`Public-readiness scan found ${findings.length} issue${findings.length === 1 ? "" : "s"}.`);
	}
	console.log(`${chalk.green("✓")} No configured private terms found`);
}

async function doctorProject() {
	const config = await getProjectConfig();
	printHeader("project doctor");
	const result = await diagnoseProject(config);
	for (const item of result.checks) {
		const symbol = item.status === "pass" ? chalk.green("✓") : item.status === "warn" ? chalk.yellow("!") : chalk.red("×");
		console.log(`${symbol} ${item.name.padEnd(20)} ${item.message}`);
	}
	if (!result.healthy) throw new Error("Project doctor found blocking issues.");
	console.log(`${chalk.green("✓")} Project is ready for Liquid Loom development`);
}

async function nativeWatchTargets(config) {
	if (!config.shopifySourceRoot) return [];
	const targets = [];
	for (const directory of SHOPIFY_THEME_DIRECTORIES) {
		const candidate = path.join(config.shopifySourceRoot, directory);
		if (await fileExists(candidate)) targets.push(candidate);
	}
	return targets;
}

async function watchProject({ shopify = false } = {}) {
	const config = await getProjectConfig();
	await runBuild({ clean: true, mode: "development" });
	printHeader(shopify ? "Shopify development" : "watch mode");

	let shopifyProcess;
	if (shopify) {
		shopifyProcess = spawn(
			process.platform === "win32" ? "shopify.cmd" : "shopify",
			["theme", "dev", "--path", config.outputRoot],
			{ cwd: config.projectRoot, stdio: "inherit" }
		);
	}

	const watchTargets = [
		config.sourceRoot,
		...(await nativeWatchTargets(config)),
		config.viteEnabled ? config.viteConfig : undefined,
		config.configFile
	].filter(Boolean);
	const watcher = chokidar.watch(watchTargets, { ignoreInitial: true });
	let timer;
	let building = false;
	let queued = false;

	const rebuild = async () => {
		if (building) {
			queued = true;
			return;
		}
		building = true;
		try {
			await runBuild({ mode: "development", quiet: true });
			console.log(`${chalk.green("✓")} rebuilt ${new Date().toLocaleTimeString()}`);
		} catch (error) {
			console.error(`${chalk.red("×")} ${error.message}`);
		} finally {
			building = false;
			if (queued) {
				queued = false;
				await rebuild();
			}
		}
	};

	watcher.on("all", (event, changedPath) => {
		clearTimeout(timer);
		console.log(`${chalk.dim(event.padEnd(8))} ${path.relative(config.projectRoot, changedPath)}`);
		timer = setTimeout(rebuild, 100);
	});
	console.log(`${chalk.green("●")} watching ${watchTargets.length} Liquid Loom source target${watchTargets.length === 1 ? "" : "s"}`);

	await new Promise((resolve) => {
		let shuttingDown = false;
		const shutdown = async (exitCode) => {
			if (shuttingDown) return;
			shuttingDown = true;
			if (typeof exitCode === "number") process.exitCode = exitCode;
			clearTimeout(timer);
			await watcher.close();
			shopifyProcess?.kill();
			resolve();
		};
		shopifyProcess?.once("error", (error) => {
			console.error(`${chalk.red("×")} Shopify CLI could not start: ${error.message}`);
			void shutdown(1);
		});
		shopifyProcess?.once("exit", (code, signal) => {
			if (shuttingDown) return;
			if (signal) console.error(`${chalk.red("×")} Shopify CLI stopped with ${signal}`);
			void shutdown(code ?? 1);
		});
		watcher.once("error", (error) => {
			console.error(`${chalk.red("×")} File watcher failed: ${error.message}`);
			void shutdown(1);
		});
		process.once("SIGINT", () => void shutdown());
		process.once("SIGTERM", () => void shutdown());
	});
}

function printInitPlan(plan, projectRoot) {
	printHeader("existing theme setup");
	console.log(`Shopify theme: ${path.relative(projectRoot, plan.themeRoot) || "."}`);
	console.log(`Theme files: ${plan.themeFiles}`);
	console.log(`Package manager: ${plan.packageManager}`);
	console.log("Asset workflow: keep existing assets");
	console.log("Performance budgets: keep existing behavior");
	console.log("\nPlanned changes:");
	for (const mutation of plan.mutations) {
		console.log(`  ${mutation.action === "create" ? "+" : "~"} ${mutation.path}`);
	}
	console.log("\nExisting Shopify files moved: 0");
}

async function confirmMutation(prompt) {
	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		throw new Error("Refusing to modify a non-interactive project without --yes.");
	}
	const readline = createInterface({ input: process.stdin, output: process.stdout });
	try {
		const answer = (await readline.question(`${prompt} [y/N] `)).trim().toLowerCase();
		return answer === "y" || answer === "yes";
	} finally {
		readline.close();
	}
}

async function initExistingTheme(options) {
	const projectRoot = process.cwd();
	const args = {
		projectRoot,
		themeDir: options.themeDir,
		packageManager: options.packageManager,
		packageVersion: PACKAGE_METADATA.version
	};
	const plan = await planExistingThemeInit(args);
	printInitPlan(plan, projectRoot);
	if (options.dryRun) {
		console.log(`\n${chalk.green("✓")} Dry run only. No files changed.`);
		return;
	}
	if (!options.yes && !(await confirmMutation("Apply this setup?"))) {
		console.log(chalk.dim("No files changed."));
		return;
	}
	await initializeExistingTheme({ ...args, install: options.install });
	console.log(`\n${chalk.green("✓")} Liquid Loom added without moving existing Shopify source`);
	console.log(`${chalk.dim("next")} ${options.install ? "run" : "install dependencies, then run"} your loom:build script`);
}

function printMigrationPlan(moves) {
	printHeader("migration preview");
	for (const move of moves) {
		console.log(`${move.fromDisplay}\n  -> ${move.toDisplay}\n  = ${move.output}\n`);
	}
	console.log(`${moves.length} file${moves.length === 1 ? "" : "s"}; Shopify output paths remain unchanged`);
}

async function migrateExistingTheme(target, options) {
	const config = await getProjectConfig();
	const migrationOptions = { target, all: options.all, to: options.to };
	const moves = await planMigration(config, migrationOptions);
	printMigrationPlan(moves);
	if (!options.apply) {
		console.log(`${chalk.green("✓")} Preview only. Re-run with --apply to move source ownership.`);
		return;
	}
	await applyMigration(config, { ...migrationOptions, apply: true });
	console.log(`${chalk.green("✓")} Migrated ${moves.length} file${moves.length === 1 ? "" : "s"} transactionally`);
}

const program = new Command();
program.name("liquid-loom").description("Source-first Shopify theme tooling").version(PACKAGE_METADATA.version);

program
	.command("build")
	.description("Build a deployable Shopify theme")
	.option("--clean", "remove previous output before building")
	.option("--development", "keep readable bundles and source maps")
	.action((options) => runBuild({ clean: options.clean, mode: options.development ? "development" : "production" }));
program.command("watch").description("Rebuild when source files change").action(() => watchProject());
program.command("dev").description("Build, watch, and launch Shopify theme dev").action(() => watchProject({ shopify: true }));
program.command("clean").description("Remove generated output and cache files").action(cleanProject);
program.command("check").description("Validate source ownership, JSON, and build output").action(checkProject);
program.command("analyze").description("Report output composition and largest files").action(analyzeProject);
program.command("doctor").description("Diagnose setup, safety, metadata, and source readiness").action(doctorProject);
program.command("public-ready").description("Scan for excluded legacy content").action(checkPublicReadiness);
program
	.command("init")
	.description("Adopt Liquid Loom inside an existing Shopify theme without moving its source")
	.option("--theme-dir <path>", "Shopify theme root relative to the current project", ".")
	.option("--package-manager <manager>", "npm, pnpm, yarn, or bun")
	.option("--no-install", "write setup files without installing dependencies")
	.option("--dry-run", "show the setup plan without changing files")
	.option("--yes", "apply without interactive confirmation")
	.action(initExistingTheme);
program
	.command("migrate [target]")
	.description("Move existing Shopify source into Liquid Loom while preserving Shopify output paths")
	.option("--all", "migrate all remaining native Shopify source")
	.option("--to <path>", "organized target under src/theme or src/public for one file")
	.option("--apply", "apply the previewed migration")
	.action(migrateExistingTheme);

program.parseAsync().catch((error) => {
	console.error(`${chalk.red("×")} ${error.message}`);
	process.exitCode = 1;
});
