import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export async function createBootstrapPackage({ sourceRoot, targetRoot, version = "0.0.0" }) {
	const packageJson = JSON.parse(await readFile(path.join(sourceRoot, "package.json"), "utf8"));
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
