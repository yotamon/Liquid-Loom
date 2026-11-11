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
		experimental: { type: "boolean" },
		install: { default: true, type: "boolean" },
		"no-install": { type: "boolean" },
		"package-manager": { default: "pnpm", type: "string" },
		preset: { default: "native", type: "string" },
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
  --preset <preset>           native, vite, vite-tailwind, or liquid-first (default: native)\n  --experimental               Explicitly enable preview-only presets
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
	install: values["no-install"] ? false : values.install,
	packageManager: values["package-manager"],
	preset: values.preset,
	experimental: values.experimental === true
})
	.then(({ targetDirectory: target }) => {
		console.log(`\n✓ Created ${projectName} at ${target}`);
		const manager = values["package-manager"];
		const devCommand = manager === "npm" || manager === "bun" ? `${manager} run dev` : `${manager} dev`;
		console.log(`\nNext:\n  cd ${JSON.stringify(path.relative(process.cwd(), target) || ".")}\n  ${devCommand}`);
	})
	.catch((error) => {
		console.error(`× ${error.message}`);
		process.exitCode = 1;
	});
