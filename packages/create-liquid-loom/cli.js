#!/usr/bin/env node

import path from "node:path";
import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { scaffoldProject } from "./index.js";

const packageJson = JSON.parse(
	await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "package.json"), "utf8")
);

const { positionals, values } = parseArgs({
	allowPositionals: true,
	options: {
		help: { short: "h", type: "boolean" },
		install: { default: true, type: "boolean" },
		"package-manager": { default: "pnpm", type: "string" },
		version: { short: "v", type: "boolean" }
	}
});

if (values.version) {
	console.log(packageJson.version);
	process.exit(0);
}

if (values.help || positionals.length === 0) {
	console.log(`create-liquid-loom <directory> [options]

Options:
  --no-install                 Skip dependency installation
  --package-manager <manager>  pnpm, npm, yarn, or bun (default: pnpm)
  -h, --help                   Show help
  -v, --version                Show version`);
	process.exit(values.help ? 0 : 1);
}

const targetDirectory = path.resolve(positionals[0]);
const projectName = path
	.basename(targetDirectory)
	.toLowerCase()
	.replaceAll(/[^a-z0-9._-]+/g, "-");

scaffoldProject({
	targetDirectory,
	projectName,
	install: values.install,
	packageManager: values["package-manager"]
})
	.then(({ targetDirectory: target }) => {
		console.log(`\n✓ Created ${projectName} at ${target}`);
		console.log(`\nNext:\n  cd ${JSON.stringify(path.relative(process.cwd(), target) || ".")}\n  pnpm dev`);
	})
	.catch((error) => {
		console.error(`× ${error.message}`);
		process.exitCode = 1;
	});
