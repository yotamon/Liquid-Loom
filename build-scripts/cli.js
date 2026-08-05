#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import chokidar from "chokidar";
import { Command } from "commander";
import { build as viteBuild } from "vite";

import { scanForbiddenContent } from "./lib/public-readiness.js";
import { assertSafeOutput, buildTheme, validateThemeSource } from "./lib/theme-builder.js";

const PROJECT_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src");
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "dist", "theme");
const CACHE_ROOT = path.join(PROJECT_ROOT, ".cache");
const CACHE_FILE = path.join(CACHE_ROOT, "manifest.json");
const VITE_CONFIG = path.join(PROJECT_ROOT, "vite.config.js");

const REQUIRED_OUTPUT_FILES = [
	"assets/style.css",
	"assets/theme.js",
	"config/settings_schema.json",
	"layout/theme.liquid",
	"templates/index.json"
];

function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
	return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}

function printHeader(label) {
	console.log(`\n${chalk.hex("#4de3c1").bold("LIQUID LOOM")} ${chalk.dim("·")} ${chalk.bold(label)}`);
}

async function runBuild({ clean = false, mode = "production", quiet = false } = {}) {
	const start = performance.now();
	if (!quiet) printHeader(mode === "production" ? "production build" : "development build");

	const summary = await buildTheme({
		projectRoot: PROJECT_ROOT,
		sourceRoot: SOURCE_ROOT,
		outputRoot: OUTPUT_ROOT,
		cacheFile: CACHE_FILE,
		clean
	});

	await viteBuild({
		configFile: VITE_CONFIG,
		logLevel: quiet ? "silent" : "warn",
		mode
	});

	if (!quiet) {
		const duration = ((performance.now() - start) / 1000).toFixed(2);
		console.log(
			`${chalk.green("✓")} ${summary.total} theme files · ${summary.copied} copied · ${summary.skipped} cached · ${summary.removed} removed · ${formatBytes(summary.bytes)} · ${duration}s`
		);
		console.log(`${chalk.dim("output")} ${path.relative(PROJECT_ROOT, OUTPUT_ROOT)}`);
	}

	return summary;
}

async function cleanProject() {
	assertSafeOutput({ projectRoot: PROJECT_ROOT, sourceRoot: SOURCE_ROOT, outputRoot: OUTPUT_ROOT });
	await Promise.all([
		rm(OUTPUT_ROOT, { recursive: true, force: true }),
		rm(CACHE_ROOT, { recursive: true, force: true })
	]);
	console.log(`${chalk.green("✓")} Removed dist/theme and .cache`);
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
		if (entry.isDirectory()) {
			files.push(...(await listFiles(entryPath, root)));
		} else if (entry.isFile()) {
			files.push({
				absolute: entryPath,
				relative: path.relative(root, entryPath).split(path.sep).join("/")
			});
		}
	}

	return files;
}

async function checkProject() {
	printHeader("project check");
	const sourceValidation = await validateThemeSource(SOURCE_ROOT);
	const errors = sourceValidation.missing.map((file) => `Missing source file: src/${file}`);

	for (const file of await listFiles(path.join(SOURCE_ROOT, "theme"))) {
		if (path.extname(file.absolute) !== ".json") continue;
		try {
			JSON.parse(await readFile(file.absolute, "utf8"));
		} catch (error) {
			errors.push(`Invalid JSON: src/theme/${file.relative} (${error.message})`);
		}
	}

	for (const requiredFile of REQUIRED_OUTPUT_FILES) {
		if (!(await fileExists(path.join(OUTPUT_ROOT, ...requiredFile.split("/"))))) {
			errors.push(`Missing build output: dist/theme/${requiredFile}`);
		}
	}

	if (errors.length > 0) {
		for (const error of errors) console.error(`${chalk.red("×")} ${error}`);
		throw new Error(`Project check failed with ${errors.length} error${errors.length === 1 ? "" : "s"}.`);
	}

	console.log(`${chalk.green("✓")} Source contract, JSON, and required build outputs are valid`);
}

async function analyzeProject() {
	printHeader("build analysis");
	const files = await listFiles(OUTPUT_ROOT);
	if (files.length === 0) throw new Error("No build found. Run pnpm build first.");

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
	printHeader("public-readiness scan");
	const findings = await scanForbiddenContent(PROJECT_ROOT);

	if (findings.length > 0) {
		for (const finding of findings) {
			const location = finding.line === 0 ? finding.file : `${finding.file}:${finding.line}:${finding.column}`;
			console.error(`${chalk.red("×")} ${location} contains excluded legacy content`);
		}
		throw new Error(`Public-readiness scan found ${findings.length} issue${findings.length === 1 ? "" : "s"}.`);
	}

	console.log(`${chalk.green("✓")} No excluded legacy brand or product terms found`);
}

async function watchProject({ shopify = false } = {}) {
	await runBuild({ clean: true, mode: "development" });
	printHeader(shopify ? "Shopify development" : "watch mode");

	let shopifyProcess;
	if (shopify) {
		shopifyProcess = spawn(
			process.platform === "win32" ? "shopify.cmd" : "shopify",
			["theme", "dev", "--path", OUTPUT_ROOT],
			{
				cwd: PROJECT_ROOT,
				stdio: "inherit"
			}
		);
		shopifyProcess.on("error", (error) => {
			console.error(`${chalk.red("×")} Shopify CLI could not start: ${error.message}`);
		});
	}

	const watcher = chokidar.watch([SOURCE_ROOT, VITE_CONFIG, path.join(PROJECT_ROOT, "postcss.config.mjs")], {
		ignoreInitial: true
	});
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
		console.log(`${chalk.dim(event.padEnd(8))} ${path.relative(PROJECT_ROOT, changedPath)}`);
		timer = setTimeout(rebuild, 100);
	});

	console.log(`${chalk.green("●")} watching src/ for changes`);

	await new Promise((resolve) => {
		const shutdown = async () => {
			clearTimeout(timer);
			await watcher.close();
			shopifyProcess?.kill();
			resolve();
		};
		process.once("SIGINT", shutdown);
		process.once("SIGTERM", shutdown);
	});
}

const program = new Command();
program.name("liquid-loom").description("Source-first Shopify theme tooling").version("1.0.0");

program
	.command("build")
	.description("Build a deployable theme into dist/theme")
	.option("--clean", "remove previous output before building")
	.option("--development", "keep readable bundles and source maps")
	.action((options) => runBuild({ clean: options.clean, mode: options.development ? "development" : "production" }));

program
	.command("watch")
	.description("Rebuild when source files change")
	.action(() => watchProject());
program
	.command("dev")
	.description("Build, watch, and launch Shopify theme dev")
	.action(() => watchProject({ shopify: true }));
program.command("clean").description("Remove generated output and cache files").action(cleanProject);
program.command("check").description("Validate source JSON and required build output").action(checkProject);
program.command("analyze").description("Report output composition and largest files").action(analyzeProject);
program.command("public-ready").description("Scan for excluded legacy content").action(checkPublicReadiness);

program.parseAsync().catch((error) => {
	console.error(`${chalk.red("×")} ${error.message}`);
	process.exitCode = 1;
});
