import { access } from "node:fs/promises";
import path from "node:path";

import { loadConfigFromFile } from "vite";

import { DEFAULT_RESERVED_OUTPUTS } from "./theme-builder.js";

const CONFIG_FILES = [
	"liquid-loom.config.ts",
	"liquid-loom.config.mts",
	"liquid-loom.config.js",
	"liquid-loom.config.mjs"
];

const DEFAULT_PERFORMANCE = {
	maxAssetBytes: 500_000,
	maxBuildMs: 10_000,
	maxThemeBytes: 5_000_000
};

export function defineConfig(config) {
	return config;
}

function assertProjectRelativePath(name, value) {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new TypeError(`${name} must be a non-empty project-relative path.`);
	}
	const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
	if (path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) {
		throw new TypeError(`${name} must be a project-relative path inside the project.`);
	}
}

function assertStringList(name, values) {
	if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || value.trim().length === 0)) {
		throw new TypeError(`${name} must be an array of non-empty strings.`);
	}
}

async function fileExists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function findConfigFile(projectRoot) {
	for (const fileName of CONFIG_FILES) {
		const filePath = path.join(projectRoot, fileName);
		if (await fileExists(filePath)) return filePath;
	}
	return undefined;
}

export async function loadProjectConfig(projectRoot = process.cwd()) {
	const resolvedRoot = path.resolve(projectRoot);
	const configFile = await findConfigFile(resolvedRoot);
	let userConfig = {};
	if (configFile) {
		const loaded = await loadConfigFromFile(
			{ command: "build", isPreview: false, isSsrBuild: false, mode: "production" },
			configFile,
			resolvedRoot,
			"silent"
		);
		if (!loaded || !loaded.config || typeof loaded.config !== "object") {
			throw new Error(`Configuration must export an object: ${path.basename(configFile)}`);
		}
		userConfig = loaded.config;
	}

	const sourceDir = userConfig.sourceDir ?? "src";
	const shopifySourceDir = userConfig.shopifySourceDir;
	const outputDir = userConfig.outputDir ?? "dist/theme";
	const cacheFile = userConfig.cacheFile ?? ".cache/manifest.json";
	const viteConfig = userConfig.viteConfig === false ? false : (userConfig.viteConfig ?? "vite.config.js");
	const forbiddenTerms = userConfig.forbiddenTerms ?? [];
	const reservedOutputs = userConfig.reservedOutputs ?? (viteConfig === false ? [] : DEFAULT_RESERVED_OUTPUTS);
	const performanceEnabled = userConfig.performance !== false;
	const performance = {
		...DEFAULT_PERFORMANCE,
		...(performanceEnabled ? (userConfig.performance ?? {}) : {})
	};

	for (const [name, value] of Object.entries({ cacheFile, outputDir, sourceDir }))
		assertProjectRelativePath(name, value);
	if (shopifySourceDir !== undefined) assertProjectRelativePath("shopifySourceDir", shopifySourceDir);
	if (viteConfig !== false) assertProjectRelativePath("viteConfig", viteConfig);
	assertStringList("forbiddenTerms", forbiddenTerms);
	assertStringList("reservedOutputs", reservedOutputs);
	if (performanceEnabled) {
		for (const [name, value] of Object.entries(performance)) {
			if (!Number.isFinite(value) || value <= 0) throw new TypeError(`performance.${name} must be a positive number.`);
		}
	}

	const sourceRoot = path.resolve(resolvedRoot, sourceDir);
	const shopifySourceRoot = shopifySourceDir === undefined ? undefined : path.resolve(resolvedRoot, shopifySourceDir);
	return {
		...userConfig,
		cacheFile: path.resolve(resolvedRoot, cacheFile),
		configFile,
		forbiddenTerms: [...forbiddenTerms],
		outputRoot: path.resolve(resolvedRoot, outputDir),
		performance,
		performanceEnabled,
		projectRoot: resolvedRoot,
		reservedOutputs: [...reservedOutputs],
		shopifySourceRoot,
		sourceLayers: [
			...(shopifySourceRoot ? [{ id: "shopify", kind: "shopify", root: shopifySourceRoot }] : []),
			{ id: "loom", kind: "organized", root: sourceRoot }
		],
		sourceRoot,
		viteConfig: viteConfig === false ? false : path.resolve(resolvedRoot, viteConfig),
		viteEnabled: viteConfig !== false
	};
}
