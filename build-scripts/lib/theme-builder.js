import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, readdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const FLAT_THEME_DIRECTORIES = new Set(["layout", "sections", "snippets", "blocks"]);
const STRUCTURED_THEME_DIRECTORIES = new Set(["templates", "config", "locales"]);
const REQUIRED_THEME_FILES = [
	"theme/config/settings_schema.json",
	"theme/layout/theme.liquid",
	"theme/templates/index.json"
];

export class BuildCollisionError extends Error {
	constructor(destination, sources) {
		super(`Multiple source files map to ${destination}: ${sources.join(", ")}`);
		this.name = "BuildCollisionError";
		this.destination = destination;
		this.sources = sources;
	}
}

function normalizeSourcePath(sourcePath) {
	const normalized = path.posix.normalize(sourcePath.replaceAll("\\", "/").replace(/^\.\//, ""));

	if (path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) {
		throw new Error(`Source path must stay inside src: ${sourcePath}`);
	}

	return normalized;
}

export function mapThemePath(sourcePath) {
	const normalized = normalizeSourcePath(sourcePath);
	const parts = normalized.split("/");

	if (parts[0] === "public" && parts.length > 1) {
		return `assets/${path.posix.basename(normalized)}`;
	}

	if (parts[0] !== "theme" || parts.length < 3) {
		throw new Error(`Unsupported source path: ${sourcePath}`);
	}

	const themeDirectory = parts[1];
	if (FLAT_THEME_DIRECTORIES.has(themeDirectory)) {
		return `${themeDirectory}/${path.posix.basename(normalized)}`;
	}

	if (STRUCTURED_THEME_DIRECTORIES.has(themeDirectory)) {
		return `${themeDirectory}/${parts.slice(2).join("/")}`;
	}

	throw new Error(`Unsupported source path: ${sourcePath}`);
}

export function createBuildPlan(sourceFiles) {
	const destinations = new Map();
	const files = [...sourceFiles].sort().map((source) => {
		const normalizedSource = normalizeSourcePath(source);
		const output = mapThemePath(normalizedSource);
		const mappedSources = destinations.get(output) ?? [];
		mappedSources.push(normalizedSource);
		destinations.set(output, mappedSources);
		return { source: normalizedSource, output };
	});

	for (const [destination, sources] of destinations) {
		if (sources.length > 1) {
			throw new BuildCollisionError(destination, sources);
		}
	}

	return { files };
}

function isInside(parentDirectory, candidatePath) {
	const relative = path.relative(parentDirectory, candidatePath);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function assertSafeOutput({ projectRoot, sourceRoot, outputRoot }) {
	const project = path.resolve(projectRoot);
	const source = path.resolve(sourceRoot);
	const output = path.resolve(outputRoot);

	if (output === project) {
		throw new Error("The build output cannot be the project root.");
	}

	if (!isInside(project, output)) {
		throw new Error("The build output cannot be outside the project.");
	}

	if (isInside(source, output)) {
		throw new Error("The build output cannot be the source directory or one of its children.");
	}
}

export async function validateThemeSource(sourceRoot) {
	const missing = [];

	for (const requiredPath of REQUIRED_THEME_FILES) {
		try {
			await access(path.join(sourceRoot, ...requiredPath.split("/")));
		} catch {
			missing.push(requiredPath);
		}
	}

	return { valid: missing.length === 0, missing };
}

async function listFiles(directory, baseDirectory = directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await listFiles(entryPath, baseDirectory)));
		} else if (entry.isFile()) {
			files.push(path.relative(baseDirectory, entryPath).split(path.sep).join("/"));
		}
	}

	return files;
}

async function listBuildSourceFiles(sourceRoot) {
	const files = [];

	for (const sourceDirectory of ["theme", "public"]) {
		const directory = path.join(sourceRoot, sourceDirectory);
		if (await fileExists(directory)) {
			files.push(...(await listFiles(directory, sourceRoot)));
		}
	}

	return files;
}

async function fileExists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

function hash(contents) {
	return createHash("sha256").update(contents).digest("hex");
}

async function readManifest(cacheFile) {
	try {
		const manifest = JSON.parse(await readFile(cacheFile, "utf8"));
		return manifest.version === 1 && manifest.files ? manifest : { version: 1, files: {} };
	} catch {
		return { version: 1, files: {} };
	}
}

async function writeManifest(cacheFile, manifest) {
	await mkdir(path.dirname(cacheFile), { recursive: true });
	const temporaryFile = `${cacheFile}.${process.pid}.tmp`;
	await writeFile(temporaryFile, `${JSON.stringify(manifest, null, 2)}\n`);
	await rename(temporaryFile, cacheFile);
}

function resolveManifestOutputPath(outputRoot, manifestOutput) {
	if (typeof manifestOutput !== "string" || manifestOutput.length === 0) {
		throw new Error("Unsafe manifest output path: expected a non-empty relative path.");
	}

	const resolvedRoot = path.resolve(outputRoot);
	const resolvedOutput = path.resolve(resolvedRoot, ...manifestOutput.split(/[\\/]+/));
	if (resolvedOutput === resolvedRoot || !isInside(resolvedRoot, resolvedOutput)) {
		throw new Error(`Unsafe manifest output path: ${manifestOutput}`);
	}

	return resolvedOutput;
}

function validateManifestOutputs(manifest, outputRoot) {
	for (const file of Object.values(manifest.files)) {
		resolveManifestOutputPath(outputRoot, file?.output);
	}
}

async function removeStaleOutputs(previousManifest, currentOutputs, outputRoot) {
	let removed = 0;
	const previousOutputs = new Set(Object.values(previousManifest.files).map((file) => file.output));

	for (const previousOutput of previousOutputs) {
		if (currentOutputs.has(previousOutput)) continue;

		const outputPath = resolveManifestOutputPath(outputRoot, previousOutput);
		if (await fileExists(outputPath)) {
			await unlink(outputPath);
			removed += 1;
		}
	}

	return removed;
}

export async function buildTheme({ projectRoot, sourceRoot, outputRoot, cacheFile, clean = false, useCache = true }) {
	assertSafeOutput({ projectRoot, sourceRoot, outputRoot });

	const validation = await validateThemeSource(sourceRoot);
	if (!validation.valid) {
		throw new Error(`Theme source is incomplete. Missing: ${validation.missing.join(", ")}`);
	}

	if (clean) {
		await rm(outputRoot, { recursive: true, force: true });
	}

	const sourceFiles = await listBuildSourceFiles(sourceRoot);
	const plan = createBuildPlan(sourceFiles);
	const previousManifest = useCache && !clean ? await readManifest(cacheFile) : { version: 1, files: {} };
	validateManifestOutputs(previousManifest, outputRoot);
	const nextManifest = { version: 1, files: {} };
	const currentOutputs = new Set(plan.files.map((file) => file.output));
	let copied = 0;
	let skipped = 0;
	let bytes = 0;

	await mkdir(outputRoot, { recursive: true });

	for (const file of plan.files) {
		const sourcePath = path.join(sourceRoot, ...file.source.split("/"));
		const outputPath = path.join(outputRoot, ...file.output.split("/"));
		const contents = await readFile(sourcePath);
		const fingerprint = hash(contents);
		const previous = previousManifest.files[file.source];

		nextManifest.files[file.source] = {
			hash: fingerprint,
			output: file.output,
			size: contents.byteLength
		};
		bytes += contents.byteLength;

		if (
			useCache &&
			previous?.hash === fingerprint &&
			previous.output === file.output &&
			(await fileExists(outputPath))
		) {
			skipped += 1;
			continue;
		}

		await mkdir(path.dirname(outputPath), { recursive: true });
		await copyFile(sourcePath, outputPath);
		copied += 1;
	}

	const removed = await removeStaleOutputs(previousManifest, currentOutputs, outputRoot);
	await writeManifest(cacheFile, nextManifest);

	return {
		bytes,
		copied,
		removed,
		skipped,
		total: plan.files.length
	};
}
