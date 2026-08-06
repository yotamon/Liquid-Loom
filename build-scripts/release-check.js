#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

import { validateReleaseVersions } from "./lib/release.js";

const readJson = async (file) => JSON.parse(await readFile(path.resolve(file), "utf8"));
const [root, scaffolder, starter] = await Promise.all([
	readJson("package.json"),
	readJson("packages/create-liquid-loom/package.json"),
	readJson("packages/create-liquid-loom/template/package.json")
]);

const version = validateReleaseVersions({
	rootVersion: root.version,
	scaffolderVersion: scaffolder.version,
	starterRange: starter.devDependencies["liquid-loom"],
	tag: process.argv[2]
});

console.log(`✓ Release versions agree on ${version}`);
