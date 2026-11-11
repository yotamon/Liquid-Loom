import { spawn } from "node:child_process";
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const TEMPLATE_ROOT = fileURLToPath(new URL("./template", import.meta.url));
const PRESET_ROOT = fileURLToPath(new URL("./presets", import.meta.url));
const SUPPORTED_PRESETS = new Set(["native", "vite", "vite-tailwind", "liquid-first"]);
const PRESET_DESCRIPTIONS = {
	native: "Shopify-native component CSS/JavaScript by default. Vite and Tailwind are optional",
	vite: "Shopify-native component assets plus an optional Vite entrypoint for global JavaScript and CSS",
	"vite-tailwind": "Shopify-native component assets plus Vite and Tailwind utilities (without global Preflight)",
	"liquid-first": "EXPERIMENTAL direct Liquid block composition and preview-only partial rendering"
};
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
	packageManager = "pnpm",
	preset = "native",
	experimental = false
}) {
	if (!SUPPORTED_PACKAGE_MANAGERS.has(packageManager)) {
		throw new Error(`Unsupported package manager: ${packageManager}`);
	}
	if (!SUPPORTED_PRESETS.has(preset)) {
		throw new Error(`Unsupported asset preset: ${preset}. Choose native, vite, vite-tailwind, or liquid-first.`);
	}
	if (preset === "liquid-first" && experimental !== true) {
		throw new Error("The liquid-first preset requires --experimental and a Shopify preview development store.");
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

		if (preset === "liquid-first") {
			// Preserve regular storefront locales while overlaying preview-only translations.
			const localeFiles = ["en.default", "de"];
			const existingLocales = new Map();
			for (const locale of localeFiles) {
				const file = path.join(staging, "src/theme/locales", `${locale}.json`);
				existingLocales.set(locale, JSON.parse(await readFile(file, "utf8")));
			}
			await cp(path.join(PRESET_ROOT, "liquid-first"), staging, { recursive: true, force: true });
			for (const locale of localeFiles) {
				const file = path.join(staging, "src/theme/locales", `${locale}.json`);
				const overlay = JSON.parse(await readFile(file, "utf8"));
				await writeFile(file, JSON.stringify({ ...existingLocales.get(locale), ...overlay }, null, "\t") + "\n");
			}
			// A template type cannot have both JSON and Liquid roots.
			await rm(path.join(staging, "src/theme/templates/index.json"));
			const configFile = path.join(staging, "liquid-loom.config.ts");
			const config = await readFile(configFile, "utf8");
			if (!config.includes("viteConfig: false,")) throw new Error("Preview scaffold expected the native config.");
			await writeFile(configFile, config.replace("viteConfig: false,", 'viteConfig: false,\n\tshopifyLiquidMode: "july-2026-preview",'));
			const layoutFile = path.join(staging, "src/theme/layout/theme.liquid");
			const layout = await readFile(layoutFile, "utf8");
			if (!layout.includes("</body>")) throw new Error("Preview scaffold expected the native theme layout.");
			await writeFile(layoutFile, layout.replace("</body>", `<script type="module" src="{{ 'preview-refresh.js' | asset_url }}"></script>\n\t</body>`));
		}
		if (preset === "vite" || preset === "vite-tailwind") {
			await cp(path.join(PRESET_ROOT, "vite"), staging, { recursive: true });
			if (preset === "vite-tailwind") {
				await cp(path.join(PRESET_ROOT, "vite-tailwind"), staging, { recursive: true, force: true });
			}

			const configFile = path.join(staging, "liquid-loom.config.ts");
			const sourceConfig = await readFile(configFile, "utf8");
			if (!sourceConfig.includes("viteConfig: false")) {
				throw new Error("The packaged starter config does not support asset preset activation.");
			}
			await writeFile(configFile, sourceConfig.replace("viteConfig: false", 'viteConfig: "vite.config.js"'));

			const layoutFile = path.join(staging, "src", "theme", "layout", "theme.liquid");
			const layout = await readFile(layoutFile, "utf8");
			const themeCss = "{{ 'theme.css' | asset_url | stylesheet_tag: preload: true }}";
			if (!layout.includes(themeCss)) throw new Error("The packaged starter layout does not expose its global CSS.");
			await writeFile(
				layoutFile,
				layout.replace(
					themeCss,
					`${themeCss}\n\t\t{{ 'style.css' | asset_url | stylesheet_tag }}\n\t\t<script type="module" src="{{ 'theme.js' | asset_url }}"></script>`
				)
			);
		}

		const packageFile = path.join(staging, "package.json");
		const packageJson = JSON.parse(await readFile(packageFile, "utf8"));
		packageJson.name = projectName;
		if (preset !== "native") packageJson.devDependencies.vite = "^8.2.4";
		if (preset === "vite-tailwind") {
			packageJson.devDependencies.tailwindcss = "^4.3.3";
			packageJson.devDependencies["@tailwindcss/vite"] = "^4.3.3";
		}
		if (packageManager !== "pnpm") delete packageJson.packageManager;
		await writeFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);

		const needsRun = packageManager === "npm" || packageManager === "bun";
		const script = (name) => `${packageManager}${needsRun ? " run" : ""} ${name}`;
		const explainArgs = packageManager === "npm" || packageManager === "pnpm" ? "-- --json" : "--json";
		const instructions = {
			PROJECT_NAME: projectName,
			"%%ASSET_STRATEGY_DESCRIPTION%%": PRESET_DESCRIPTIONS[preset],
			__INSTALL_COMMAND__: `${packageManager} install`,
			__DEV_COMMAND__: script("dev"),
			__BUILD_COMMAND__: script("build"),
			__EXPLAIN_COMMAND__: `${script("explain")} ${explainArgs}`,
			__DOCTOR_COMMAND__: script("doctor"),
			__VALIDATE_COMMAND__: script("validate")
		};
		const readmeFile = path.join(staging, "README.md");
		let readme = await readFile(readmeFile, "utf8");
		for (const [placeholder, value] of Object.entries(instructions)) {
			readme = readme.replaceAll(placeholder, value);
		}
		if (preset === "liquid-first") {
			readme = readme
				.replace("src/theme/sections/home/hero.liquid", "src/theme/templates/index.liquid")
				.replace("dist/theme/sections/hero.liquid", "dist/theme/templates/index.liquid");
			readme += `\n## Experimental Liquid-first homepage\n\nThe homepage alone uses Liquid block and partial preview tags; the other JSON templates remain stable. This is NOT a production theme preset. Use a non-production July 2026 Liquid preview development store. The preview supplies @shopify/partial-rendering in its import map: do not install it from npm. Test across browsers, including Firefox, before relying on partial refreshes.\n`;
		}
		await writeFile(readmeFile, readme);

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
