import { spawn } from "node:child_process";
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const TEMPLATE_ROOT = fileURLToPath(new URL("./template", import.meta.url));
const SUPPORTED_PACKAGE_MANAGERS = new Set(["bun", "npm", "pnpm", "yarn"]);
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;

function validateTarget(targetDirectory) {
	const resolved = path.resolve(targetDirectory);
	const parsed = path.parse(resolved);
	if (resolved === parsed.root) throw new Error("The project directory cannot be a filesystem root.");
	return resolved;
}

async function directoryEntries(directory) {
	try {
		return await readdir(directory);
	} catch (error) {
		if (error.code === "ENOENT") return null;
		throw error;
	}
}

function runInstall(packageManager, cwd) {
	return new Promise((resolve, reject) => {
		const child =
			process.platform === "win32"
				? spawn(process.env.ComSpec, ["/d", "/s", "/c", `${packageManager} install`], { cwd, stdio: "inherit" })
				: spawn(packageManager, ["install"], { cwd, stdio: "inherit" });
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (code === 0) resolve();
			else
				reject(new Error(`${packageManager} install failed${signal ? ` with ${signal}` : ` with exit code ${code}`}.`));
		});
	});
}

export async function scaffoldProject({
	targetDirectory,
	projectName = path.basename(path.resolve(targetDirectory)),
	install = true,
	packageManager = "pnpm"
}) {
	if (!SUPPORTED_PACKAGE_MANAGERS.has(packageManager)) {
		throw new Error(`Unsupported package manager: ${packageManager}`);
	}
	if (projectName.length > 214 || !PACKAGE_NAME_PATTERN.test(projectName)) {
		throw new Error(`Invalid project name: ${projectName}`);
	}
	const target = validateTarget(targetDirectory);
	const entries = await directoryEntries(target);
	if (entries?.length) throw new Error(`Target directory is not empty: ${target}`);

	const staging = `${target}.creating-${process.pid}-${randomUUID()}`;
	try {
		await mkdir(path.dirname(target), { recursive: true });
		await cp(TEMPLATE_ROOT, staging, { recursive: true });

		const packageFile = path.join(staging, "package.json");
		const packageJson = JSON.parse(await readFile(packageFile, "utf8"));
		packageJson.name = projectName;
		await writeFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
		const readmeFile = path.join(staging, "README.md");
		await writeFile(readmeFile, (await readFile(readmeFile, "utf8")).replaceAll("__PROJECT_NAME__", projectName));

		if (entries) {
			const latestEntries = await directoryEntries(target);
			if (latestEntries?.length) throw new Error(`Target directory is not empty: ${target}`);
			await rm(target, { recursive: true });
		}
		await rename(staging, target);
		if (install) await runInstall(packageManager, target);
		return { projectName, targetDirectory: target };
	} catch (error) {
		await rm(staging, { recursive: true, force: true });
		throw error;
	}
}
