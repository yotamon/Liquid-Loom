import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

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
	const files = [];
	for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
		left.name.localeCompare(right.name)
	)) {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await listFiles(absolute, root)));
		else if (entry.isFile()) {
			files.push({
				file: path.relative(root, absolute).split(path.sep).join("/"),
				size: (await readFile(absolute)).byteLength
			});
		}
	}
	return files;
}

export async function inspectBuild(outputRoot) {
	const files = await listFiles(outputRoot);
	const assets = files.filter(({ file }) => file.startsWith("assets/"));
	return {
		fileCount: files.length,
		files,
		largestAsset: assets.sort((left, right) => right.size - left.size)[0] ?? null,
		totalBytes: files.reduce((total, file) => total + file.size, 0)
	};
}

export async function validatePerformanceBudgets(outputRoot, budgets, durationMs) {
	const report = await inspectBuild(outputRoot);
	const errors = [];
	if (report.totalBytes > budgets.maxThemeBytes) {
		errors.push(`theme size ${report.totalBytes} B exceeds ${budgets.maxThemeBytes} B`);
	}
	if (report.largestAsset && report.largestAsset.size > budgets.maxAssetBytes) {
		errors.push(
			`largest asset ${report.largestAsset.file} is ${report.largestAsset.size} B (limit ${budgets.maxAssetBytes} B)`
		);
	}
	if (durationMs > budgets.maxBuildMs) {
		errors.push(`build time ${Math.round(durationMs)} ms exceeds ${budgets.maxBuildMs} ms`);
	}
	if (errors.length > 0) throw new Error(`Performance budget failed: ${errors.join("; ")}.`);
	return report;
}
