import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { scanForbiddenContent } from "./public-readiness.js";
import { assertSafeOutput, createBuildPlan, discoverSourceEntries, validateThemePlan } from "./theme-builder.js";

async function fileExists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

function check(name, status, message) {
	return { message, name, status };
}

export async function diagnoseProject(config) {
	const checks = [];
	const hybrid = Boolean(config.shopifySourceRoot);
	const nodeVersion = process.versions.node.split(".").map(Number);
	const supportedRuntime = nodeVersion[0] > 22 || (nodeVersion[0] === 22 && nodeVersion[1] >= 12);
	checks.push(
		check(
			"node-runtime",
			supportedRuntime ? "pass" : "fail",
			supportedRuntime ? `Node ${process.versions.node}` : `Node ${process.versions.node}; requires 22.12 or newer`
		)
	);

	try {
		const packageJson = JSON.parse(await readFile(path.join(config.projectRoot, "package.json"), "utf8"));
		const missing = ["name", "description", "license"].filter((field) => !packageJson[field]);
		checks.push(
			check(
				"package-metadata",
				missing.length ? (hybrid ? "warn" : "fail") : "pass",
				missing.length ? `Missing package fields: ${missing.join(", ")}` : `Package ${packageJson.name}`
			)
		);
	} catch (error) {
		checks.push(check("package-metadata", "fail", `Unreadable package.json: ${error.message}`));
	}

	const missingDocs = [];
	for (const file of ["README.md", "LICENSE"]) {
		if (!(await fileExists(path.join(config.projectRoot, file)))) missingDocs.push(file);
	}
	checks.push(
		check(
			"documentation",
			missingDocs.length ? (hybrid ? "warn" : "fail") : "pass",
			missingDocs.length ? `Missing: ${missingDocs.join(", ")}` : "README and license present"
		)
	);

	try {
		const gitignore = await readFile(path.join(config.projectRoot, ".gitignore"), "utf8");
		const missingIgnores = ["node_modules", "dist", ".cache"].filter((entry) => !gitignore.includes(entry));
		checks.push(
			check(
				"generated-files",
				missingIgnores.length ? "fail" : "pass",
				missingIgnores.length ? `Not ignored: ${missingIgnores.join(", ")}` : "Generated output is ignored"
			)
		);
	} catch {
		checks.push(check("generated-files", "fail", "Missing .gitignore"));
	}

	try {
		const entries = await discoverSourceEntries({
			projectRoot: config.projectRoot,
			sourceRoot: config.sourceRoot,
			shopifySourceRoot: config.shopifySourceRoot
		});
		const plan = createBuildPlan(entries, { reservedOutputs: config.reservedOutputs });
		const source = validateThemePlan(plan);
		checks.push(
			check(
				"theme-source",
				source.valid ? "pass" : "fail",
				source.valid
					? "Shopify upload minimum present in the merged source plan"
					: `Missing: ${source.missing.join(", ")}`
			)
		);
		const nativeCount = entries.filter((entry) => entry.kind === "shopify").length;
		const organizedCount = entries.filter((entry) => entry.kind === "organized").length;
		checks.push(
			check(
				"source-mode",
				"pass",
				hybrid
					? `${nativeCount} native Shopify file(s) + ${organizedCount} organized file(s)`
					: `${organizedCount} organized Liquid Loom file(s)`
			)
		);
	} catch (error) {
		checks.push(check("theme-source", "fail", error.message));
	}

	if (config.viteEnabled) {
		const viteConfigExists = await fileExists(config.viteConfig);
		checks.push(
			check(
				"vite-config",
				viteConfigExists ? "pass" : "fail",
				viteConfigExists ? path.basename(config.viteConfig) : `Missing ${path.basename(config.viteConfig)}`
			)
		);
	} else {
		checks.push(check("vite-config", "pass", "Disabled; existing asset workflow is preserved"));
		const entrypoints = path.join(config.sourceRoot, "entrypoints");
		if (await fileExists(entrypoints)) {
			checks.push(
				check("asset-entrypoints", "warn", "src/entrypoints exists but Vite is disabled, so it will not be compiled")
			);
		}
	}

	checks.push(
		check(
			"performance",
			config.performanceEnabled ? "pass" : "pass",
			config.performanceEnabled ? "Performance budgets enabled" : "Disabled for non-invasive existing-theme adoption"
		)
	);

	try {
		assertSafeOutput(config);
		checks.push(check("output-safety", "pass", "Build output is isolated from every managed source directory"));
	} catch (error) {
		checks.push(check("output-safety", "fail", error.message));
	}

	const findings = await scanForbiddenContent(config.projectRoot, config.forbiddenTerms);
	checks.push(
		check(
			"private-content",
			findings.length ? "fail" : "pass",
			findings.length
				? `${findings.length} configured private-content match(es)`
				: "No configured private content found"
		)
	);

	return { checks, healthy: checks.every(({ status }) => status !== "fail") };
}
