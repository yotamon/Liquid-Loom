import { createHash, randomUUID } from "node:crypto";
import { access, copyFile, cp, mkdir, open, readFile, readdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const FLAT_THEME_DIRECTORIES = new Set(["layout", "sections", "snippets", "blocks"]);
const STRUCTURED_THEME_DIRECTORIES = new Set(["templates", "config", "locales"]);
const REQUIRED_THEME_FILES = [
	"theme/config/settings_schema.json",
	"theme/layout/theme.liquid",
	"theme/templates/index.json"
];
export const DEFAULT_RESERVED_OUTPUTS = ["assets/style.css", "assets/theme.js"];

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

function canonicalOutputPath(outputPath) {
	return outputPath.normalize("NFC").toLocaleLowerCase("en-US");
}

export function createBuildPlan(sourceFiles, { reservedOutputs = [] } = {}) {
	const destinations = new Map();

	for (const output of reservedOutputs) {
		const normalizedOutput = normalizeSourcePath(output).normalize("NFC");
		destinations.set(canonicalOutputPath(normalizedOutput), {
			destination: normalizedOutput,
			sources: [`<generated:${normalizedOutput}>`]
		});
	}

	const files = [...sourceFiles].sort().map((source) => {
		const normalizedSource = normalizeSourcePath(source);
		const output = mapThemePath(normalizedSource).normalize("NFC");
		const key = canonicalOutputPath(output);
		const entry = destinations.get(key) ?? { destination: output, sources: [] };
		entry.sources.push(normalizedSource);
		destinations.set(key, entry);
		return { source: normalizedSource, output };
	});

	for (const { destination, sources } of destinations.values()) {
		if (sources.length > 1) {
			throw new BuildCollisionError(canonicalOutputPath(destination), sources);
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

export async function buildTheme({
	projectRoot,
	sourceRoot,
	outputRoot,
	cacheFile,
	clean = false,
	useCache = true,
	reservedOutputs = DEFAULT_RESERVED_OUTPUTS
}) {
	assertSafeOutput({ projectRoot, sourceRoot, outputRoot });

	const validation = await validateThemeSource(sourceRoot);
	if (!validation.valid) {
		throw new Error(`Theme source is incomplete. Missing: ${validation.missing.join(", ")}`);
	}

	if (clean) {
		await rm(outputRoot, { recursive: true, force: true });
	}

	const sourceFiles = await listBuildSourceFiles(sourceRoot);
	const plan = createBuildPlan(sourceFiles, { reservedOutputs });
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
			if (Date.now() >= deadline) {
				throw new Error(`Timed out waiting for another Liquid Loom build to finish: ${lockFile}`);
			}
			await delay(25);
		}
	}
}

export async function buildProject({
	projectRoot,
	sourceRoot,
	outputRoot,
	cacheFile,
	bundle,
	clean = false,
	reservedOutputs = DEFAULT_RESERVED_OUTPUTS
}) {
	assertSafeOutput({ projectRoot, sourceRoot, outputRoot });
	if (typeof bundle !== "function") throw new TypeError("A bundle function is required.");
	const releaseLock = await acquireBuildLock(cacheFile);

	const transactionId = `${process.pid}-${randomUUID()}`;
	const stagingRoot = `${outputRoot}.staging-${transactionId}`;
	const stagingCache = `${cacheFile}.staging-${transactionId}`;

	try {
		await mkdir(path.dirname(stagingRoot), { recursive: true });
		await mkdir(path.dirname(stagingCache), { recursive: true });

		if (!clean && (await fileExists(outputRoot))) {
			await cp(outputRoot, stagingRoot, { recursive: true });
		} else {
			await mkdir(stagingRoot, { recursive: true });
		}
		if (!clean && (await fileExists(cacheFile))) {
			await copyFile(cacheFile, stagingCache);
		}

		const summary = await buildTheme({
			projectRoot,
			sourceRoot,
			outputRoot: stagingRoot,
			cacheFile: stagingCache,
			useCache: !clean,
			reservedOutputs
		});
		for (const output of reservedOutputs) {
			const generatedOutput = resolveManifestOutputPath(stagingRoot, output);
			await Promise.all([rm(generatedOutput, { force: true }), rm(`${generatedOutput}.map`, { force: true })]);
		}
		await bundle({ outputRoot: stagingRoot });
		await commitTransaction({ outputRoot, stagingRoot, cacheFile, stagingCache });
		return summary;
	} catch (error) {
		await Promise.all([rm(stagingRoot, { recursive: true, force: true }), rm(stagingCache, { force: true })]);
		throw error;
	} finally {
		await releaseLock();
	}
}
