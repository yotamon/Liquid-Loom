import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { scanForbiddenContent } from "./public-readiness.js";
import { assertSafeOutput, validateThemeSource } from "./theme-builder.js";

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
				missing.length ? "fail" : "pass",
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
			missingDocs.length ? "fail" : "pass",
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

	const source = await validateThemeSource(config.sourceRoot);
	checks.push(
		check(
			"theme-source",
			source.valid ? "pass" : "fail",
			source.valid ? "Required Shopify source files present" : `Missing: ${source.missing.join(", ")}`
		)
	);

	const viteConfigExists = await fileExists(config.viteConfig);
	checks.push(
		check(
			"vite-config",
			viteConfigExists ? "pass" : "fail",
			viteConfigExists ? path.basename(config.viteConfig) : `Missing ${path.basename(config.viteConfig)}`
		)
	);

	try {
		assertSafeOutput(config);
		checks.push(check("output-safety", "pass", "Build output is isolated inside the project"));
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
