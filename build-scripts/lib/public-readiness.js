import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const IGNORED_DIRECTORIES = new Set([".cache", ".git", "coverage", "dist", "node_modules"]);
const TEXT_EXTENSIONS = new Set([
	".cjs",
	".css",
	".html",
	".js",
	".json",
	".liquid",
	".md",
	".mjs",
	".scss",
	".svg",
	".toml",
	".txt",
	".xml",
	".yaml",
	".yml"
]);
const TEXT_FILENAMES = new Set([".editorconfig", ".gitignore", ".prettierignore", ".shopifyignore"]);

function isTextFile(fileName) {
	return TEXT_FILENAMES.has(fileName) || TEXT_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

async function listRepositoryFiles(directory, root = directory) {
	const files = [];
	const entries = await readdir(directory, { withFileTypes: true });

	for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
		if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;

		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await listRepositoryFiles(entryPath, root)));
		} else if (entry.isFile()) {
			files.push({
				absolute: entryPath,
				relative: path.relative(root, entryPath).split(path.sep).join("/"),
				text: isTextFile(entry.name)
			});
		}
	}

	return files;
}

export async function scanForbiddenContent(root, forbiddenTerms = []) {
	const normalizedTerms = forbiddenTerms.map((term) => term.toLowerCase());
	const findings = [];

	for (const file of await listRepositoryFiles(root)) {
		const normalizedPath = file.relative.toLowerCase();
		for (const term of normalizedTerms) {
			const column = normalizedPath.indexOf(term);
			if (column !== -1) {
				findings.push({ file: file.relative, line: 0, column: column + 1, category: "legacy-path" });
			}
		}

		if (!file.text) continue;
		const lines = (await readFile(file.absolute, "utf8")).split(/\r?\n/);

		for (const [lineIndex, line] of lines.entries()) {
			const normalizedLine = line.toLowerCase();
			for (const term of normalizedTerms) {
				const column = normalizedLine.indexOf(term);
				if (column !== -1) {
					findings.push({ file: file.relative, line: lineIndex + 1, column: column + 1, category: "legacy-brand" });
				}
			}
		}
	}

	return findings;
}
