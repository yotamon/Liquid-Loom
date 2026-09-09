import { createHash, randomUUID } from "node:crypto";
import { access, copyFile, cp, mkdir, open, readFile, readdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export const SHOPIFY_THEME_DIRECTORIES = [
	"assets",
	"blocks",
	"config",
	"layout",
	"locales",
	"sections",
	"snippets",
	"templates"
];
const FLAT_THEME_DIRECTORIES = new Set(["blocks", "config", "layout", "locales", "sections", "snippets"]);
const FLAT_SHOPIFY_DIRECTORIES = new Set(["assets", ...FLAT_THEME_DIRECTORIES]);
const SUPPORTED_TEMPLATE_SUBDIRECTORIES = new Set(["customers", "metaobject"]);
export const DEFAULT_RESERVED_OUTPUTS = ["assets/style.css", "assets/theme.js"];

export class BuildCollisionError extends Error {
	constructor(destination, sources) {
		super(`Multiple source files map to ${destination}: ${sources.join(", ")}`);
		this.name = "BuildCollisionError";
		this.destination = destination;
		this.sources = sources;
	}
}

function normalizeRelativePath(sourcePath, label = "Source path") {
	if (typeof sourcePath !== "string" || sourcePath.trim().length === 0) {
		throw new TypeError(`${label} must be a non-empty relative path.`);
	}
	const normalized = path.posix.normalize(sourcePath.replaceAll("\\", "/").replace(/^\.\//, ""));
	if (path.posix.isAbsolute(normalized) || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
		throw new Error(`${label} must stay inside its source root: ${sourcePath}`);
	}
	return normalized;
}

function mapTemplatePath(parts, sourcePath, offset) {
	const templateParts = parts.slice(offset);
	if (templateParts.length === 1) return `templates/${templateParts[0]}`;
	const [subdirectory] = templateParts;
	if (SUPPORTED_TEMPLATE_SUBDIRECTORIES.has(subdirectory) && templateParts.length === 2) {
		return `templates/${templateParts.join("/")}`;
	}
	if (offset === 2 && !SUPPORTED_TEMPLATE_SUBDIRECTORIES.has(subdirectory)) {
		return `templates/${path.posix.basename(sourcePath)}`;
	}
	throw new Error(
		`Unsupported Shopify template nesting: ${sourcePath}. ` +
			`Only templates/customers/* and templates/metaobject/* may be nested in deployable output.`
	);
}

export function mapThemePath(sourcePath) {
	const normalized = normalizeRelativePath(sourcePath);
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
	if (themeDirectory === "templates") return mapTemplatePath(parts, normalized, 2);
	throw new Error(`Unsupported source path: ${sourcePath}`);
}

export function mapShopifyPath(sourcePath) {
	const normalized = normalizeRelativePath(sourcePath, "Shopify source path");
	const parts = normalized.split("/");
	const directory = parts[0];
	if (!SHOPIFY_THEME_DIRECTORIES.includes(directory) || parts.length < 2) {
		throw new Error(`Unsupported Shopify source path: ${sourcePath}`);
	}
	if (FLAT_SHOPIFY_DIRECTORIES.has(directory)) {
		if (parts.length !== 2) {
			throw new Error(`Shopify ${directory}/ is flat; nested source is not supported: ${sourcePath}`);
		}
		return normalized;
	}
	if (directory === "templates") return mapTemplatePath(parts, normalized, 1);
	throw new Error(`Unsupported Shopify source path: ${sourcePath}`);
}

function canonicalOutputPath(outputPath) {
	return outputPath.normalize("NFC").toLocaleLowerCase("en-US");
}

function normalizeBuildEntry(source) {
	if (typeof source === "string") {
		const relativePath = normalizeRelativePath(source);
		return {
			layerId: "loom",
			kind: "organized",
			relativePath,
			displayPath: relativePath,
			root: undefined,
			sourceKey: relativePath
		};
	}
	if (!source || typeof source !== "object") throw new TypeError("Build source entries must be paths or source descriptors.");
	const relativePath = normalizeRelativePath(source.relativePath);
	if (source.kind !== "organized" && source.kind !== "shopify") {
		throw new TypeError(`Unsupported source kind: ${source.kind}`);
	}
	const layerId = source.layerId || source.kind;
	return {
		layerId,
		kind: source.kind,
		relativePath,
		displayPath: source.displayPath || `${layerId}:${relativePath}`,
		root: source.root,
		sourceKey: `${layerId}:${relativePath}`
	};
}

export function createBuildPlan(sourceFiles, { reservedOutputs = [] } = {}) {
	const destinations = new Map();
	for (const output of reservedOutputs) {
		const normalizedOutput = normalizeRelativePath(output, "Reserved output").normalize("NFC");
		destinations.set(canonicalOutputPath(normalizedOutput), {
			destination: normalizedOutput,
			sources: [`<generated:${normalizedOutput}>`]
		});
	}

	const files = [...sourceFiles]
		.map(normalizeBuildEntry)
		.sort((left, right) => left.displayPath.localeCompare(right.displayPath))
		.map((entry) => {
			const output = (entry.kind === "shopify" ? mapShopifyPath(entry.relativePath) : mapThemePath(entry.relativePath)).normalize(
				"NFC"
			);
			const key = canonicalOutputPath(output);
			const destination = destinations.get(key) ?? { destination: output, sources: [] };
			destination.sources.push(entry.displayPath);
			destinations.set(key, destination);
			return { ...entry, source: entry.relativePath, output };
		});

	for (const { destination, sources } of destinations.values()) {
		if (sources.length > 1) throw new BuildCollisionError(canonicalOutputPath(destination), sources);
	}
	return { files };
}

function isInside(parentDirectory, candidatePath) {
	const relative = path.relative(parentDirectory, candidatePath);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function assertSafeOutput({ projectRoot, sourceRoot, shopifySourceRoot, outputRoot }) {
	const project = path.resolve(projectRoot);
	const output = path.resolve(outputRoot);
	if (output === project) throw new Error("The build output cannot be the project root.");
	if (!isInside(project, output)) throw new Error("The build output cannot be outside the project.");

	if (sourceRoot) {
		const source = path.resolve(sourceRoot);
		if (isInside(source, output) || isInside(output, source)) {
			throw new Error("The build output cannot be the source directory or one of its children.");
		}
	}

	if (shopifySourceRoot) {
		const nativeRoot = path.resolve(shopifySourceRoot);
		for (const directory of SHOPIFY_THEME_DIRECTORIES) {
			const managedDirectory = path.join(nativeRoot, directory);
			if (isInside(managedDirectory, output) || isInside(output, managedDirectory)) {
				throw new Error(`The build output cannot overlap Shopify source directory: ${directory}/`);
			}
		}
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

async function listFiles(directory, baseDirectory = directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await listFiles(entryPath, baseDirectory)));
		else if (entry.isFile()) files.push(path.relative(baseDirectory, entryPath).split(path.sep).join("/"));
	}
	return files;
}

export async function discoverSourceEntries({ projectRoot, sourceRoot, shopifySourceRoot }) {
	const entries = [];
	if (sourceRoot) {
		for (const sourceDirectory of ["theme", "public"]) {
			const directory = path.join(sourceRoot, sourceDirectory);
			if (!(await fileExists(directory))) continue;
			for (const relativePath of await listFiles(directory, sourceRoot)) {
				entries.push({
					layerId: "loom",
					kind: "organized",
					root: sourceRoot,
					relativePath,
					displayPath: path.relative(projectRoot, path.join(sourceRoot, ...relativePath.split("/"))).split(path.sep).join("/")
				});
			}
		}
	}
	if (shopifySourceRoot) {
		for (const directoryName of SHOPIFY_THEME_DIRECTORIES) {
			const directory = path.join(shopifySourceRoot, directoryName);
			if (!(await fileExists(directory))) continue;
			for (const relativePath of await listFiles(directory, shopifySourceRoot)) {
				entries.push({
					layerId: "shopify",
					kind: "shopify",
					root: shopifySourceRoot,
					relativePath,
					displayPath: path
						.relative(projectRoot, path.join(shopifySourceRoot, ...relativePath.split("/")))
						.split(path.sep)
						.join("/")
				});
			}
		}
	}
	return entries;
}

export function validateThemePlan(plan) {
	const outputs = new Set(plan.files.map((file) => canonicalOutputPath(file.output)));
	const missing = outputs.has("layout/theme.liquid") ? [] : ["layout/theme.liquid"];
	return { valid: missing.length === 0, missing };
}

export async function validateThemeSource(sourceRoot) {
	try {
		await access(path.join(sourceRoot, "theme", "layout", "theme.liquid"));
		return { valid: true, missing: [] };
	} catch {
		return { valid: false, missing: ["theme/layout/theme.liquid"] };
	}
}

function hash(contents) {
	return createHash("sha256").update(contents).digest("hex");
}

async function readManifest(cacheFile) {
	try {
		const manifest = JSON.parse(await readFile(cacheFile, "utf8"));
		if ((manifest.version === 1 || manifest.version === 2) && manifest.files && typeof manifest.files === "object") return manifest;
	} catch {
		// A missing or invalid cache is equivalent to a cold build.
	}
	return { version: 2, files: {} };
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
	for (const file of Object.values(manifest.files)) resolveManifestOutputPath(outputRoot, file?.output);
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

export async function buildTheme({
	projectRoot,
	sourceRoot,
	shopifySourceRoot,
	outputRoot,
	cacheFile,
	clean = false,
	useCache = true,
	reservedOutputs = DEFAULT_RESERVED_OUTPUTS
}) {
	assertSafeOutput({ projectRoot, sourceRoot, shopifySourceRoot, outputRoot });
	if (clean) await rm(outputRoot, { recursive: true, force: true });

	const sourceEntries = await discoverSourceEntries({ projectRoot, sourceRoot, shopifySourceRoot });
	const plan = createBuildPlan(sourceEntries, { reservedOutputs });
	const validation = validateThemePlan(plan);
	if (!validation.valid) {
		throw new Error(`Theme source is incomplete. Missing Shopify upload minimum: ${validation.missing.join(", ")}`);
	}

	const previousManifest = useCache && !clean ? await readManifest(cacheFile) : { version: 2, files: {} };
	validateManifestOutputs(previousManifest, outputRoot);
	const nextManifest = { version: shopifySourceRoot ? 2 : 1, files: {} };
	const currentOutputs = new Set(plan.files.map((file) => file.output));
	let copied = 0;
	let skipped = 0;
	let bytes = 0;
	await mkdir(outputRoot, { recursive: true });

	for (const file of plan.files) {
		const sourcePath = path.join(file.root, ...file.relativePath.split("/"));
		const outputPath = path.join(outputRoot, ...file.output.split("/"));
		const contents = await readFile(sourcePath);
		const fingerprint = hash(contents);
		const manifestKey = shopifySourceRoot ? file.sourceKey : file.relativePath;
		const previous = previousManifest.files[manifestKey] ?? previousManifest.files[file.relativePath];

		nextManifest.files[manifestKey] = {
			hash: fingerprint,
			layer: file.layerId,
			output: file.output,
			size: contents.byteLength,
			source: file.relativePath
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
	return { bytes, copied, removed, skipped, total: plan.files.length };
}

async function commitTransaction({ outputRoot, stagingRoot, cacheFile, stagingCache }) {
	const transactionId = `${process.pid}-${randomUUID()}`;
	const outputBackup = `${outputRoot}.backup-${transactionId}`;
	const cacheBackup = `${cacheFile}.backup-${transactionId}`;
	let outputBackedUp = false;
	let cacheBackedUp = false;
	let outputCommitted = false;
	let cacheCommitted = false;
	try {
		if (await fileExists(outputRoot)) {
			await rename(outputRoot, outputBackup);
			outputBackedUp = true;
		}
		if (await fileExists(cacheFile)) {
			await rename(cacheFile, cacheBackup);
			cacheBackedUp = true;
		}
		await rename(stagingRoot, outputRoot);
		outputCommitted = true;
		await rename(stagingCache, cacheFile);
		cacheCommitted = true;
	} catch (error) {
		if (cacheCommitted) await rm(cacheFile, { force: true });
		if (outputCommitted) await rm(outputRoot, { recursive: true, force: true });
		if (cacheBackedUp) await rename(cacheBackup, cacheFile);
		if (outputBackedUp) await rename(outputBackup, outputRoot);
		throw error;
	}
	await Promise.allSettled([rm(outputBackup, { recursive: true, force: true }), rm(cacheBackup, { force: true })]);
}

async function acquireBuildLock(cacheFile, timeoutMs = 30_000) {
	const lockFile = `${cacheFile}.lock`;
	const deadline = Date.now() + timeoutMs;
	await mkdir(path.dirname(lockFile), { recursive: true });
	while (true) {
		let handle;
		try {
			handle = await open(lockFile, "wx");
			await handle.writeFile(`${process.pid}\n`);
			return async () => {
				await handle.close();
				await rm(lockFile, { force: true });
			};
		} catch (error) {
			if (handle) {
				await handle.close();
				await rm(lockFile, { force: true });
			}
			if (error.code !== "EEXIST") throw error;
			try {
				const ownerPid = Number.parseInt(await readFile(lockFile, "utf8"), 10);
				if (Number.isSafeInteger(ownerPid) && ownerPid > 0) {
					try {
						process.kill(ownerPid, 0);
					} catch (processError) {
						if (processError.code === "ESRCH") {
							await rm(lockFile, { force: true });
							continue;
						}
					}
				}
			} catch (readError) {
				if (readError.code === "ENOENT") continue;
				throw readError;
			}
			if (Date.now() >= deadline) throw new Error(`Timed out waiting for another Liquid Loom build to finish: ${lockFile}`);
			await delay(25);
		}
	}
}

async function removeGeneratedOutputs(outputRoot, reservedOutputs) {
	for (const output of reservedOutputs) {
		const generatedOutput = resolveManifestOutputPath(outputRoot, output);
		await rm(generatedOutput, { force: true });
		await rm(`${generatedOutput}.map`, { force: true });
	}
}

export async function buildProject({
	projectRoot,
	sourceRoot,
	shopifySourceRoot,
	outputRoot,
	cacheFile,
	bundle,
	clean = false,
	reservedOutputs = DEFAULT_RESERVED_OUTPUTS
}) {
	assertSafeOutput({ projectRoot, sourceRoot, shopifySourceRoot, outputRoot });
	if (typeof bundle !== "function") throw new TypeError("A bundle function is required.");
	const releaseLock = await acquireBuildLock(cacheFile);
	const transactionId = `${process.pid}-${randomUUID()}`;
	const stagingRoot = `${outputRoot}.staging-${transactionId}`;
	const stagingCache = `${cacheFile}.staging-${transactionId}`;
	try {
		await mkdir(path.dirname(stagingRoot), { recursive: true });
		await mkdir(path.dirname(stagingCache), { recursive: true });
		if (!clean && (await fileExists(outputRoot))) await cp(outputRoot, stagingRoot, { recursive: true });
		else await mkdir(stagingRoot, { recursive: true });
		if (!clean && (await fileExists(cacheFile))) await copyFile(cacheFile, stagingCache);

		const summary = await buildTheme({
			projectRoot,
			sourceRoot,
			shopifySourceRoot,
			outputRoot: stagingRoot,
			cacheFile: stagingCache,
			useCache: !clean,
			reservedOutputs
		});
		await removeGeneratedOutputs(stagingRoot, reservedOutputs);
		await bundle({ outputRoot: stagingRoot });
		await commitTransaction({ outputRoot, stagingRoot, cacheFile, stagingCache });
		return summary;
	} finally {
		await Promise.allSettled([
			rm(stagingRoot, { recursive: true, force: true }),
			rm(stagingCache, { force: true }),
			releaseLock()
		]);
	}
}
