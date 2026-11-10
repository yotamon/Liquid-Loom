import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { scaffoldProject } from "../packages/create-liquid-loom/index.js";

const roots = [];

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function scaffold(preset) {
	const root = await mkdtemp(path.join(os.tmpdir(), "loom-presets-"));
	roots.push(root);
	const target = path.join(root, "storefront");
	await scaffoldProject({ targetDirectory: target, projectName: "storefront", install: false, preset });
	return target;
}

async function file(project, relativePath) {
	return readFile(path.join(project, ...relativePath.split("/")), "utf8");
}

async function exists(project, relativePath) {
	try {
		await access(path.join(project, ...relativePath.split("/")));
		return true;
	} catch (error) {
		if (error.code === "ENOENT") return false;
		throw error;
	}
}

describe("Shopify starter asset presets", () => {
	it("keeps the native default free of optional bundler files and dependencies", async () => {
		const project = await scaffold("native");
		const manifest = JSON.parse(await file(project, "package.json"));
		assert.equal(manifest.devDependencies.vite, undefined);
		assert.equal(manifest.devDependencies.tailwindcss, undefined);
		assert.equal(await exists(project, "vite.config.js"), false);
		assert.equal(await exists(project, "src/entrypoints/theme.js"), false);
		assert.match(await file(project, "liquid-loom.config.ts"), /viteConfig: false/);
		assert.equal((await file(project, "src/theme/layout/theme.liquid")).includes("'style.css' | asset_url"), false);
		assert.equal((await file(project, "README.md")).includes("%%ASSET_STRATEGY_DESCRIPTION%%"), false);
	});

	for (const preset of ["vite", "vite-tailwind"]) {
		it(`scaffolds an explicit ${preset} entrypoint and Shopify output references`, async () => {
			const project = await scaffold(preset);
			const manifest = JSON.parse(await file(project, "package.json"));
			assert.equal(manifest.devDependencies.vite, "^8.2.4");
			assert.match(await file(project, "liquid-loom.config.ts"), /viteConfig: "vite.config.js"/);
			const layout = await file(project, "src/theme/layout/theme.liquid");
			assert.ok(layout.includes("'style.css' | asset_url"));
			assert.ok(layout.includes("'theme.js' | asset_url"));
			assert.match(layout, /type="module"/);
			assert.ok((await file(project, "src/entrypoints/theme.js")).includes("theme.css"));
			const viteConfig = await file(project, "vite.config.js");
			assert.match(viteConfig, /cssFileName: "style"/);
			assert.match(viteConfig, /fileName: "theme"/);
			if (preset === "vite-tailwind") {
				assert.equal(manifest.devDependencies["@tailwindcss/vite"], "^4.3.3");
				assert.equal(manifest.devDependencies.tailwindcss, "^4.3.3");
				assert.ok(viteConfig.includes("tailwindcss()"));
				assert.ok((await file(project, "src/entrypoints/theme.css")).includes("tailwindcss/utilities"));
			} else {
				assert.equal(manifest.devDependencies["@tailwindcss/vite"], undefined);
				assert.doesNotMatch(viteConfig, /tailwindcss/);
			}
		});
	}

	it("rejects invalid presets before creating a project", async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), "loom-presets-invalid-"));
		roots.push(root);
		const target = path.join(root, "not-created");
		await assert.rejects(
			scaffoldProject({ targetDirectory: target, projectName: "storefront", install: false, preset: "other" }),
			/Unsupported asset preset/
		);
		assert.equal(await exists(root, "not-created"), false);
	});
});
