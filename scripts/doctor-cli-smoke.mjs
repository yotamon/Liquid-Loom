import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const cli = path.resolve(import.meta.dirname, "../build-scripts/cli.js");
const projectRoot = await mkdtemp(path.join(os.tmpdir(), "liquid-loom-doctor-json-"));

async function write(relative, text) {
	const target = path.join(projectRoot, ...relative.split("/"));
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, text);
}

function run(...args) {
	return spawnSync(process.execPath, [cli, "doctor", ...args], {
		cwd: projectRoot,
		encoding: "utf8"
	});
}

try {
	await write("package.json", '{"name":"fixture","description":"Test theme","license":"MIT"}');
	await write("README.md", "# Fixture\n");
	await write("LICENSE", "MIT\n");
	await write(".gitignore", "node_modules/\ndist/\n.cache/\n");
	await write("liquid-loom.config.mjs", "export default { viteConfig: false, performance: false };\n");
	await write("src/theme/layout/theme.liquid", "<main>{{ content_for_layout }}</main>\n");
	await write("src/theme/templates/index.json", '{"sections":{},"order":[]}\n');
	await write("src/theme/config/settings_schema.json", "[]\n");

	const healthy = run("--json");
	assert.equal(healthy.status, 0, healthy.stderr);
	const report = JSON.parse(healthy.stdout);
	assert.equal(report.healthy, true);
	assert.equal(report.checks.find((item) => item.name === "node-runtime").code, "LL_OK");

	await write(".gitignore", "node_modules/\n");
	const failing = run("--json");
	assert.equal(failing.status, 1, failing.stderr);
	assert.equal(failing.stderr, "");
	const broken = JSON.parse(failing.stdout);
	assert.equal(broken.healthy, false);
	const finding = broken.checks.find((item) => item.name === "generated-files");
	assert.equal(finding.code, "LL_GITIGNORE_INCOMPLETE");
	assert.ok(finding.fix.includes(".gitignore"));

	const readable = run();
	assert.equal(readable.status, 1);
	assert.match(readable.stdout, /Fix:/);
	assert.match(readable.stdout, /LL|Not ignored:/);
	console.log("PASS: doctor JSON is parseable, stable and exits nonzero on blocking issues.");
} finally {
	await rm(projectRoot, { force: true, recursive: true });
}
