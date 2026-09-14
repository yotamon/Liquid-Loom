import { readFile } from "node:fs/promises";
import path from "node:path";

import { createBuildPlan, discoverSourceEntries } from "./theme-builder.js";

const STATIC_LIQUID_REFERENCE_PATTERNS = [
	{ kind: "snippet", pattern: /{%-?\s*(?:render|include)\s+['"]([^'"]+)['"]/g },
	{ kind: "section", pattern: /{%-?\s*section\s+['"]([^'"]+)['"]/g },
	{ kind: "block", pattern: /{%-?\s*block\s+['"]([^'"]+)['"]/g }
];

const ASSET_REFERENCE_PATTERN = /['"]([^'"]+)['"]\s*\|\s*asset_url\b/g;
const PARTIAL_PATTERN = /{%-?\s*partial\s+['"]([^'"]+)['"]/g;
const BLOCK_TAG_PATTERN = /{%-?\s*block\s+['"][^'"]+['"]/;
const PARTIAL_TAG_PATTERN = /{%-?\s*partial\s+['"][^'"]+['"]/;

function compareByName(left, right) {
	return left.name.localeCompare(right.name);
}

function uniqueSorted(values) {
	return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function themeType(output) {
	return output.split("/", 1)[0] || "other";
}

function stem(fileName) {
	return path.posix.basename(fileName, path.posix.extname(fileName));
}

const FEATURE_ALIASES = new Map([
	["collections", "collection"],
	["pages", "page"],
	["products", "product"]
]);

const SHOPIFY_FEATURE_TOKENS = [
	"product",
	"collection",
	"cart",
	"search",
	"page",
	"blog",
	"article",
	"account",
	"customer",
	"password",
	"gift-card"
];

function normalizeFeatureName(name) {
	return FEATURE_ALIASES.get(name) ?? name;
}

function inferNativeFeature(output) {
	const fileStem = stem(output);
	const tokens = fileStem.split(/[-_.]/);
	const semantic = SHOPIFY_FEATURE_TOKENS.find((candidate) => tokens.includes(candidate));
	return semantic ?? themeType(output);
}

function inferFeature(file) {
	const parts = file.relativePath.split("/");
	if (file.kind === "organized" && parts[0] === "theme") {
		const directory = parts[1];
		if (parts.length >= 4) return normalizeFeatureName(parts[2]);
		if (directory === "templates") return normalizeFeatureName(stem(parts.at(-1)));
		if (directory === "blocks" || directory === "snippets") return "shared";
		return directory || "theme";
	}
	if (file.kind === "organized" && parts[0] === "public") return "assets";

	const outputParts = file.output.split("/");
	if (outputParts[0] === "templates") return normalizeFeatureName(stem(outputParts.at(-1)));
	if (outputParts[0] === "assets") return "assets";
	return inferNativeFeature(file.output);
}

function referenceOutput(kind, name) {
	if (kind === "snippet") return `snippets/${name}.liquid`;
	if (kind === "section") return `sections/${name}.liquid`;
	if (kind === "block") return `blocks/${name}.liquid`;
	if (kind === "asset") return `assets/${path.posix.basename(name)}`;
	return undefined;
}

function collectPatternMatches(contents, pattern, kind) {
	pattern.lastIndex = 0;
	const references = [];
	for (const match of contents.matchAll(pattern)) {
		const name = match[1];
		references.push({ kind, name, output: referenceOutput(kind, name) });
	}
	return references;
}

function inspectLiquid(contents) {
	const references = STATIC_LIQUID_REFERENCE_PATTERNS.flatMap(({ kind, pattern }) =>
		collectPatternMatches(contents, pattern, kind)
	);
	references.push(...collectPatternMatches(contents, ASSET_REFERENCE_PATTERN, "asset"));
	const partials = uniqueSorted([...contents.matchAll(PARTIAL_PATTERN)].map((match) => match[1]));
	return {
		partials,
		preview: {
			blockTag: BLOCK_TAG_PATTERN.test(contents),
			partialTag: PARTIAL_TAG_PATTERN.test(contents)
		},
		references
	};
}

function inspectJson(contents) {
	const references = [];
	let document;
	try {
		document = JSON.parse(contents);
	} catch {
		return { partials: [], preview: { blockTag: false, partialTag: false }, references };
	}

	if (document && typeof document === "object" && document.sections && typeof document.sections === "object") {
		for (const section of Object.values(document.sections)) {
			if (!section || typeof section !== "object" || typeof section.type !== "string" || section.type.startsWith("shopify://")) {
				continue;
			}
			references.push({
				kind: "section",
				name: section.type,
				output: referenceOutput("section", section.type)
			});
		}
	}

	return { partials: [], preview: { blockTag: false, partialTag: false }, references };
}

function deduplicateReferences(references) {
	const seen = new Set();
	return references
		.filter((reference) => {
			const key = `${reference.kind}:${reference.name}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.sort((left, right) => {
			const kind = left.kind.localeCompare(right.kind);
			return kind || left.name.localeCompare(right.name);
		});
}

async function inspectBuildFile(file) {
	const sourcePath = path.join(file.root, ...file.relativePath.split("/"));
	const extension = path.posix.extname(file.relativePath).toLowerCase();
	let inspection = { partials: [], preview: { blockTag: false, partialTag: false }, references: [] };

	if (extension === ".liquid" || extension === ".json") {
		const contents = await readFile(sourcePath, "utf8");
		inspection = extension === ".liquid" ? inspectLiquid(contents) : inspectJson(contents);
	}

	return {
		feature: inferFeature(file),
		kind: file.kind,
		output: file.output,
		partials: inspection.partials,
		preview: inspection.preview,
		references: deduplicateReferences(inspection.references),
		source: file.displayPath,
		sourceKey: file.sourceKey,
		type: themeType(file.output)
	};
}

function summarizeFeatures(files) {
	const features = new Map();
	for (const file of files) {
		const current = features.get(file.feature) ?? {
			files: [],
			name: file.feature,
			outputs: [],
			partials: [],
			references: []
		};
		current.files.push(file.source);
		current.outputs.push(file.output);
		current.partials.push(...file.partials);
		current.references.push(...file.references);
		features.set(file.feature, current);
	}

	return [...features.values()]
		.map((feature) => ({
			files: uniqueSorted(feature.files),
			name: feature.name,
			outputs: uniqueSorted(feature.outputs),
			partials: uniqueSorted(feature.partials),
			references: deduplicateReferences(feature.references)
		}))
		.sort(compareByName);
}

function previewUsage(files) {
	return {
		blockTag: files.filter((file) => file.preview.blockTag).map((file) => file.source).sort(),
		partialTag: files.filter((file) => file.preview.partialTag).map((file) => file.source).sort()
	};
}

function unresolvedReferences(files) {
	const outputs = new Set(files.map((file) => file.output));
	const unresolved = [];
	for (const file of files) {
		for (const reference of file.references) {
			if (!reference.output || outputs.has(reference.output)) continue;
			unresolved.push({
				from: file.output,
				kind: reference.kind,
				name: reference.name,
				output: reference.output
			});
		}
	}
	return unresolved.sort((left, right) => {
		const from = left.from.localeCompare(right.from);
		if (from) return from;
		const kind = left.kind.localeCompare(right.kind);
		return kind || left.name.localeCompare(right.name);
	});
}

export async function createProjectModel(config) {
	const entries = await discoverSourceEntries({
		projectRoot: config.projectRoot,
		sourceRoot: config.sourceRoot,
		shopifySourceRoot: config.shopifySourceRoot
	});
	const plan = createBuildPlan(entries, { reservedOutputs: config.reservedOutputs });
	const files = (await Promise.all(plan.files.map(inspectBuildFile))).sort((left, right) =>
		left.output.localeCompare(right.output)
	);
	const features = summarizeFeatures(files);
	const referenceCount = files.reduce((total, file) => total + file.references.length, 0);
	const unresolved = unresolvedReferences(files);

	return {
		features,
		files,
		liquidMode: config.shopifyLiquidMode ?? "stable",
		preview: previewUsage(files),
		summary: {
			features: features.length,
			files: files.length,
			partials: uniqueSorted(files.flatMap((file) => file.partials)).length,
			references: referenceCount,
			unresolvedReferences: unresolved.length
		},
		unresolvedReferences: unresolved,
		version: 1
	};
}

function normalizeTarget(target) {
	return target.trim().toLocaleLowerCase("en-US");
}

export function selectProjectModel(model, target) {
	if (!target || target.trim().length === 0) return model;
	const normalized = normalizeTarget(target);
	const feature = model.features.find((candidate) => normalizeTarget(candidate.name) === normalized);
	if (feature) {
		const outputs = new Set(feature.outputs);
		return {
			feature,
			files: model.files.filter((file) => outputs.has(file.output)),
			liquidMode: model.liquidMode,
			preview: {
				blockTag: model.preview.blockTag.filter((source) => feature.files.includes(source)),
				partialTag: model.preview.partialTag.filter((source) => feature.files.includes(source))
			},
			version: model.version
		};
	}

	const matchingFiles = model.files.filter((file) => {
		const haystack = `${file.source}\n${file.output}`.toLocaleLowerCase("en-US");
		return haystack.includes(normalized);
	});
	if (matchingFiles.length) {
		return {
			files: matchingFiles,
			liquidMode: model.liquidMode,
			preview: previewUsage(matchingFiles),
			version: model.version
		};
	}

	throw new Error(`No Liquid Loom feature or source matches "${target}".`);
}

export function formatProjectModel(model, target) {
	const selection = selectProjectModel(model, target);
	if (selection.feature) {
		const lines = [
			`Feature: ${selection.feature.name}`,
			`Liquid mode: ${selection.liquidMode}`,
			"",
			"Sources"
		];
		for (const file of selection.files) lines.push(`  ${file.source} -> ${file.output}`);
		if (selection.feature.references.length) {
			lines.push("", "Static references");
			for (const reference of selection.feature.references) {
				lines.push(`  ${reference.kind.padEnd(7)} ${reference.name}${reference.output ? ` -> ${reference.output}` : ""}`);
			}
		}
		if (selection.feature.partials.length) {
			lines.push("", "Partials");
			for (const partial of selection.feature.partials) lines.push(`  ${partial}`);
		}
		return lines.join("\n");
	}

	if (target) {
		const lines = [`Matches for: ${target}`, `Liquid mode: ${selection.liquidMode}`, ""];
		for (const file of selection.files) lines.push(`  ${file.source} -> ${file.output}`);
		return lines.join("\n");
	}

	const lines = [
		`Liquid mode: ${model.liquidMode}`,
		`${model.summary.files} files · ${model.summary.features} features · ${model.summary.references} static references · ${model.summary.partials} partial regions`,
		"",
		"Features"
	];
	for (const feature of model.features) {
		lines.push(
			`  ${feature.name.padEnd(18)} ${String(feature.outputs.length).padStart(2)} outputs  ${String(feature.references.length).padStart(2)} refs`
		);
	}
	if (model.preview.blockTag.length || model.preview.partialTag.length) {
		lines.push(
			"",
			`Preview tags: ${model.preview.blockTag.length} block file(s), ${model.preview.partialTag.length} partial file(s)`
		);
	}
	if (model.unresolvedReferences.length) {
		lines.push("", `Unresolved static references: ${model.unresolvedReferences.length}`);
	}
	return lines.join("\n");
}
