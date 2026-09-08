import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const bootstrapRoot = path.join(repositoryRoot, ".artifacts", "npm-bootstrap");
const bootstrapVersion = "0.0.0";
const bootstrapTag = "bootstrap";

const packageDefinitions = [
	{ name: "liquid-loom", sourceRoot: repositoryRoot },
	{
		name: "create-liquid-loom",
		sourceRoot: path.join(repositoryRoot, "packages", "create-liquid-loom")
	}
];

async function readPackageJson(sourceRoot) {
	return JSON.parse(await readFile(path.join(sourceRoot, "package.json"), "utf8"));
}

export async function createBootstrapPackage({ sourceRoot, targetRoot, version = bootstrapVersion }) {
	const packageJson = await readPackageJson(sourceRoot);
	if (packageJson.private) throw new Error(`${packageJson.name} is private and cannot be bootstrapped.`);
	if (!Array.isArray(packageJson.files) || packageJson.files.length === 0) {
		throw new Error(`${packageJson.name} must declare publishable files before bootstrap.`);
	}

	await rm(targetRoot, { recursive: true, force: true });
	await mkdir(targetRoot, { recursive: true });

	for (const entry of packageJson.files) {
		await cp(path.join(sourceRoot, entry), path.join(targetRoot, entry), { recursive: true });
	}

	const bootstrapPackageJson = {
		...packageJson,
		version,
		publishConfig: {
			...packageJson.publishConfig,
			access: "public",
			provenance: false
		}
	};
	await writeFile(path.join(targetRoot, "package.json"), `${JSON.stringify(bootstrapPackageJson, null, "\t")}\n`);

	return bootstrapPackageJson;
}

async function registryStatus(name) {
	const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
	if (response.status === 404) return { exists: false, name };
	if (!response.ok) throw new Error(`npm registry returned ${response.status} for ${name}.`);

	const metadata = await response.json();
	return {
		exists: true,
		latest: metadata["dist-tags"]?.latest ?? null,
		name
	};
}

async function prepareBootstrapPackages() {
	await rm(bootstrapRoot, { recursive: true, force: true });
	await mkdir(bootstrapRoot, { recursive: true });

	const prepared = [];
	for (const definition of packageDefinitions) {
		const targetRoot = path.join(bootstrapRoot, definition.name);
		const packageJson = await createBootstrapPackage({ sourceRoot: definition.sourceRoot, targetRoot });
		prepared.push({ ...definition, packageJson, targetRoot });
	}
	return prepared;
}

async function runNpm(args, options = {}) {
	return execFileAsync("npm", args, {
		cwd: repositoryRoot,
		maxBuffer: 1024 * 1024 * 10,
		...options
	});
}

async function assertAuthenticated() {
	try {
		const { stdout } = await runNpm(["whoami"]);
		return stdout.trim();
	} catch {
		throw new Error("npm authentication is required. Run `npm login` with an account that owns the package names first.");
	}
}

async function printStatus() {
	const statuses = await Promise.all(packageDefinitions.map(({ name }) => registryStatus(name)));
	for (const status of statuses) {
		if (status.exists) {
			console.log(`✓ ${status.name} exists on npm${status.latest ? ` (latest ${status.latest})` : ""}`);
		} else {
			console.log(`○ ${status.name} is not published yet`);
		}
	}
	return statuses;
}

async function publishBootstrap() {
	const username = await assertAuthenticated();
	console.log(`npm account: ${username}`);

	const statuses = await Promise.all(packageDefinitions.map(({ name }) => registryStatus(name)));
	const prepared = await prepareBootstrapPackages();

	for (const packageInfo of prepared) {
		const status = statuses.find(({ name }) => name === packageInfo.name);
		if (status?.exists) {
			console.log(`↷ ${packageInfo.name} already exists; bootstrap publish skipped.`);
			continue;
		}

		console.log(`Publishing ${packageInfo.name}@${bootstrapVersion} with dist-tag ${bootstrapTag}...`);
		await runNpm(["publish", packageInfo.targetRoot, "--tag", bootstrapTag, "--access", "public"], {
			env: { ...process.env, NPM_CONFIG_PROVENANCE: "false" }
		});
		console.log(`✓ ${packageInfo.name}@${bootstrapVersion} published without provenance.`);
	}
}

async function configureTrust() {
	const username = await assertAuthenticated();
	console.log(`npm account: ${username}`);

	const statuses = await Promise.all(packageDefinitions.map(({ name }) => registryStatus(name)));
	const missing = statuses.filter(({ exists }) => !exists).map(({ name }) => name);
	if (missing.length) {
		throw new Error(`Trusted publishing cannot be configured before these packages exist: ${missing.join(", ")}.`);
	}

	for (const { name } of packageDefinitions) {
		console.log(`Configuring GitHub trusted publishing for ${name}...`);
		await runNpm([
			"trust",
			"github",
			name,
			"--repo",
			"yotamon/Liquid-Loom",
			"--file",
			"release.yml",
			"--env",
			"npm",
			"--allow-publish",
			"--yes"
		]);
		console.log(`✓ ${name} trusts yotamon/Liquid-Loom/.github/workflows/release.yml`);
	}
}

async function main() {
	const [command, ...flags] = process.argv.slice(2);

	if (command === "status") {
		await printStatus();
		return;
	}

	if (command === "prepare") {
		const prepared = await prepareBootstrapPackages();
		for (const packageInfo of prepared) console.log(`✓ prepared ${packageInfo.name}@${bootstrapVersion}`);
		console.log(`Bootstrap packages are in ${path.relative(repositoryRoot, bootstrapRoot)}`);
		return;
	}

	if (command === "bootstrap") {
		if (!flags.includes("--publish")) {
			await prepareBootstrapPackages();
			console.log("Dry run only. No package was published.");
			console.log("Run `node build-scripts/npm-release-setup.js bootstrap --publish` to perform the one-time publish.");
			return;
		}
		await publishBootstrap();
		return;
	}

	if (command === "trust") {
		await configureTrust();
		return;
	}

	console.log("Usage:");
	console.log("  node build-scripts/npm-release-setup.js status");
	console.log("  node build-scripts/npm-release-setup.js prepare");
	console.log("  node build-scripts/npm-release-setup.js bootstrap [--publish]");
	console.log("  node build-scripts/npm-release-setup.js trust");
}

const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedFile === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(`✗ ${error.message}`);
		process.exitCode = 1;
	});
}
