import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import { validateReleaseVersions } from "../build-scripts/lib/release.js";

describe("release versions", () => {
	it("keeps the root, scaffolder, and embedded framework dependency aligned before tagging", async () => {
		const root = path.resolve(import.meta.dirname, "..");
		const readManifest = async (relativePath) =>
			JSON.parse(await readFile(path.join(root, ...relativePath.split("/")), "utf8"));
		const [framework, scaffolder, starter] = await Promise.all([
			readManifest("package.json"),
			readManifest("packages/create-liquid-loom/package.json"),
			readManifest("packages/create-liquid-loom/template/package.json")
		]);
		assert.equal(
			validateReleaseVersions({
				tag: `v${framework.version}`,
				rootVersion: framework.version,
				scaffolderVersion: scaffolder.version,
				starterRange: starter.devDependencies["liquid-loom"]
			}),
			framework.version
		);
	});

	it("tests packed release consumers before attesting or publishing", async () => {
		const root = path.resolve(import.meta.dirname, "..");
		const workflow = await readFile(path.join(root, ".github", "workflows", "release.yml"), "utf8");
		const packStep = workflow.indexOf("name: Pack release artifacts");
		const smokeStep = workflow.indexOf("name: Verify packed release consumers before publishing");
		const attestStep = workflow.indexOf("name: Attest packages");
		const publishStep = workflow.indexOf("name: Publish packages through npm trusted publishing");
		assert.ok(packStep >= 0);
		assert.ok(smokeStep > packStep);
		assert.ok(attestStep > smokeStep);
		assert.ok(publishStep > attestStep);
		assert.match(workflow, /run: node tests\/package-smoke\.js/);
	});

	it("requires the tag, packages, and embedded starter to agree", () => {
		assert.doesNotThrow(() =>
			validateReleaseVersions({
				rootVersion: "0.1.0",
				scaffolderVersion: "0.1.0",
				starterRange: "^0.1.0",
				tag: "v0.1.0"
			})
		);
		assert.throws(
			() =>
				validateReleaseVersions({
					rootVersion: "0.1.0",
					scaffolderVersion: "0.1.1",
					starterRange: "^0.1.0",
					tag: "v0.1.0"
				}),
			/package versions must match/i
		);
	});
});
