import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { scaffoldProject } from "../packages/create-liquid-loom/index.js";
import { buildTheme } from "../build-scripts/lib/theme-builder.js";
import { createProjectModel } from "../build-scripts/lib/project-model.js";

const file = (root, name) => readFile(path.join(root, ...name.split("/")), "utf8");

describe("Liquid July 2026 opt-in experimental scaffold", () => {
	it("rejects liquid-first without explicit experimental consent before writing files", async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), "liquid-first-gate-"));
		try {
			await assert.rejects(
				scaffoldProject({
					targetDirectory: path.join(root, "forbidden"),
					projectName: "forbidden",
					install: false,
					preset: "liquid-first"
				}),
				/--experimental/
			);
			await assert.rejects(access(path.join(root, "forbidden")));
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("preserves stable commerce templates while composing the preview homepage with blocks and partials", async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), "liquid-first-preset-"));
		try {
			const project = path.join(root, "demo");
			await scaffoldProject({
				targetDirectory: project,
				projectName: "demo",
				install: false,
				preset: "liquid-first",
				experimental: true
			});
			const config = await file(project, "liquid-loom.config.ts");
			assert.match(config, /shopifyLiquidMode: "july-2026-preview"/);
			assert.match(config, /viteConfig: false/);
			await assert.rejects(access(path.join(project, "src/theme/templates/index.json")));
			const homepage = await file(project, "src/theme/templates/index.liquid");
			assert.match(homepage, /{% block 'preview-container'/);
			assert.match(homepage, /{% block 'preview-hero'/);
			assert.match(homepage, /{% block 'preview-refresh'/);
			const block = await file(project, "src/theme/blocks/preview-refresh.liquid");
			assert.match(homepage, /{% partial 'preview-time' %}/);
			assert.doesNotMatch(block, /{% partial\s/);
			assert.match(block, /{% doc %}/);
			const script = await file(project, "src/public/preview-refresh.js");
			assert.match(script, /@shopify\/partial-rendering/);
			const layout = await file(project, "src/theme/layout/theme.liquid");
			assert.match(layout, /preview-refresh\.js/);
			assert.ok(layout.indexOf("{{ content_for_header }}") < layout.indexOf("preview-refresh.js"));
			for (const name of ["en.default", "de"]) {
				const locale = JSON.parse(await file(project, "src/theme/locales/" + name + ".json"));
				assert.ok(locale.preview.heading);
				assert.ok(locale.cart.added, "preserve stable locale data");
			}
			const packageJson = JSON.parse(await file(project, "package.json"));
			assert.equal(packageJson.devDependencies.vite, undefined);
			assert.equal(packageJson.devDependencies["@shopify/partial-rendering"], undefined);
			assert.match(await file(project, "README.md"), /NOT a production theme preset/);
			const guide = await file(project, "src/theme/AGENTS.md");
			assert.match(guide, /sole homepage root/);
			const sourceRoot = path.join(project, "src");
			const outputRoot = path.join(project, "dist/theme");
			await buildTheme({
				projectRoot: project,
				sourceRoot,
				outputRoot,
				cacheFile: path.join(project, ".cache/manifest.json"),
				reservedOutputs: []
			});
			assert.equal(await file(project, "dist/theme/templates/index.liquid"), homepage);
			await assert.rejects(access(path.join(outputRoot, "templates/index.json")));
			assert.match(await file(project, "dist/theme/templates/index.liquid"), /{% partial 'preview-time' %}/);
			assert.doesNotMatch(await file(project, "dist/theme/blocks/preview-refresh.liquid"), /{% partial\s/);
			const model = await createProjectModel({
				projectRoot: project,
				sourceRoot,
				shopifyLiquidMode: "july-2026-preview",
				reservedOutputs: []
			});
			assert.ok(model.preview.blockTag.includes("src/theme/templates/index.liquid"));
			assert.ok(model.preview.partialTag.includes("src/theme/templates/index.liquid"));
			assert.ok(!model.preview.partialTag.includes("src/theme/blocks/preview-refresh.liquid"));
			assert.equal(model.liquidMode, "july-2026-preview");
			assert.ok(await file(project, "src/theme/templates/product.json"));
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
