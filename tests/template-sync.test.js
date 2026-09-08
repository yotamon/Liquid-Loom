import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const referenceSource = path.join(repositoryRoot, "src");
const embeddedSource = path.join(repositoryRoot, "packages", "create-liquid-loom", "template", "src");

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

describe("embedded starter", () => {
	it("stays byte-for-byte synchronized with the reference storefront source", async () => {
		const referenceFiles = await listFiles(referenceSource);
		const embeddedFiles = await listFiles(embeddedSource);
		assert.deepEqual(embeddedFiles, referenceFiles);

		for (const file of referenceFiles) {
			const [reference, embedded] = await Promise.all([
				readFile(path.join(referenceSource, ...file.split("/"))),
				readFile(path.join(embeddedSource, ...file.split("/")))
			]);
			assert.deepEqual(embedded, reference, `Embedded starter drifted at ${file}`);
		}
	});

	it("shares the framework config and Vite config used by the reference storefront", async () => {
		for (const file of ["liquid-loom.config.ts", "vite.config.js"]) {
			const [reference, embedded] = await Promise.all([
				readFile(path.join(repositoryRoot, file)),
				readFile(path.join(repositoryRoot, "packages", "create-liquid-loom", "template", file))
			]);
			assert.deepEqual(embedded, reference, `Embedded starter drifted at ${file}`);
		}
	});
});
