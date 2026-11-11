#!/usr/bin/env node

import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = "https://api.github.com/repos/Shopify";

export const WATCHED_UPSTREAMS = [
	{
		id: "dawn",
		label: "Dawn stable release",
		kind: "release",
		url: `${apiRoot}/dawn/releases/latest`,
		link: "https://github.com/Shopify/dawn/releases"
	},
	{
		id: "horizon",
		label: "Horizon main",
		kind: "commit",
		url: `${apiRoot}/horizon/commits/main`,
		link: "https://github.com/Shopify/horizon"
	},
	{
		id: "skeleton",
		label: "Skeleton preview main",
		kind: "commit",
		url: `${apiRoot}/skeleton-theme/commits/main`,
		link: "https://github.com/Shopify/skeleton-theme"
	},
	{
		id: "cli",
		label: "Shopify CLI stable release",
		kind: "release",
		url: `${apiRoot}/cli/releases/latest`,
		link: "https://github.com/Shopify/cli/releases"
	},
	{
		id: "themeCheck",
		label: "Theme Check package",
		kind: "tag",
		prefix: "@shopify/theme-check-common@",
		url: `${apiRoot}/theme-tools/releases?per_page=100`,
		link: "https://github.com/Shopify/theme-tools/releases"
	},
	{
		id: "prettier",
		label: "Liquid Prettier plugin",
		kind: "tag",
		prefix: "@shopify/prettier-plugin-liquid@",
		url: `${apiRoot}/theme-tools/releases?per_page=100`,
		link: "https://github.com/Shopify/theme-tools/releases"
	}
];

function versionParts(value) {
	const match = /(?:^|@|v)(\d+)\.(\d+)\.(\d+)$/.exec(value ?? "");
	return match ? match.slice(1).map(Number) : null;
}

function versionOrder(left, right) {
	const a = versionParts(left.tag_name);
	const b = versionParts(right.tag_name);
	for (let index = 0; index < 3; index++) {
		if (a[index] !== b[index]) return b[index] - a[index];
	}
	return 0;
}

export function extractObservedReference(upstream, result) {
	if (upstream.kind === "release" && typeof result?.tag_name === "string") return result.tag_name;
	if (upstream.kind === "commit" && /^[a-f0-9]{40}$/.test(result?.sha ?? "")) return result.sha;
	if (upstream.kind === "tag" && Array.isArray(result)) {
		const releases = result.filter(
			(item) =>
				item &&
				!item.draft &&
				!item.prerelease &&
				typeof item.tag_name === "string" &&
				item.tag_name.startsWith(upstream.prefix) &&
				versionParts(item.tag_name)
		);
		releases.sort(versionOrder);
		if (releases.length) return releases[0].tag_name;
	}
	throw new Error("Source did not return a usable stable reference");
}

export function checkCliMajorAlignment(manifest, observedVersion, location) {
	const declared = manifest.devDependencies?.["@shopify/cli"];
	const major = Number(/^\s*[~^]?(\d+)/.exec(declared ?? "")?.[1]);
	const upstreamMajor = versionParts(observedVersion)?.[0];
	const needsReview =
		!declared || !Number.isInteger(upstreamMajor) || !Number.isInteger(major) || major !== upstreamMajor;
	return {
		location,
		declared: declared ?? "not installed",
		latest: observedVersion ?? "unavailable",
		status: needsReview ? "review" : "major-aligned"
	};
}

export async function inspectUpstreams({ baseline, manifests, fetchImpl = fetch, token, now = () => new Date() }) {
	const responses = new Map();
	const readSource = (url) => {
		if (!responses.has(url)) {
			responses.set(
				url,
				(async () => {
					const headers = {
						Accept: "application/vnd.github+json",
						"User-Agent": "liquid-loom-upstream-watch"
					};
					if (token) headers.Authorization = `Bearer ${token}`;
					const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(15000) });
					if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
					return response.json();
				})()
			);
		}
		return responses.get(url);
	};

	const sources = await Promise.all(
		WATCHED_UPSTREAMS.map(async (upstream) => {
			const previouslyObserved = baseline.refs[upstream.id];
			try {
				const current = extractObservedReference(upstream, await readSource(upstream.url));
				return {
					id: upstream.id,
					label: upstream.label,
					url: upstream.link,
					baseline: previouslyObserved,
					current,
					status: current === previouslyObserved ? "unchanged" : "changed"
				};
			} catch (error) {
				return {
					id: upstream.id,
					label: upstream.label,
					url: upstream.link,
					baseline: previouslyObserved,
					current: null,
					status: "unavailable",
					reason: String(error.message).slice(0, 160)
				};
			}
		})
	);

	const cli = sources.find((source) => source.id === "cli");
	const packages = [
		checkCliMajorAlignment(manifests.framework, cli.current, "package.json"),
		checkCliMajorAlignment(manifests.starter, cli.current, "packages/create-liquid-loom/template/package.json")
	];

	return {
		checkedAt: now().toISOString(),
		baselineAt: baseline.observedAt,
		sources,
		packages,
		summary: {
			changed: sources.filter((source) => source.status === "changed").length,
			unavailable: sources.filter((source) => source.status === "unavailable").length,
			cliMajorReview: packages.filter((item) => item.status === "review").length
		}
	};
}

function cell(value) {
	return String(value ?? "unknown").replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function formatMarkdown(report) {
	const lines = [
		"## Shopify upstream compatibility watch",
		"",
		`Snapshot: ${report.baselineAt}; checked: ${report.checkedAt}. Differences require engineering review, not automatic upgrades.`,
		"",
		"| Upstream | Audited snapshot | Currently observed | Status |",
		"| --- | --- | --- | --- |"
	];
	for (const item of report.sources) {
		const observed = item.current
			? item.id === "horizon" || item.id === "skeleton"
				? item.current.slice(0, 12)
				: item.current
			: "Unavailable";
		const baseline = item.id === "horizon" || item.id === "skeleton" ? item.baseline.slice(0, 12) : item.baseline;
		lines.push(`| [${cell(item.label)}](${item.url}) | ${cell(baseline)} | ${cell(observed)} | ${item.status} |`);
	}
	lines.push(
		"",
		"### CLI dependency alignment",
		"",
		"| Package manifest | Declared Shopify CLI | Latest observed | Review |",
		"| --- | --- | --- | --- |"
	);
	for (const item of report.packages) {
		lines.push(`| ${item.location} | ${cell(item.declared)} | ${cell(item.latest)} | ${item.status} |`);
	}
	if (report.summary.unavailable) {
		lines.push(
			"",
			`**Incomplete:** ${report.summary.unavailable} source(s) unavailable. Do not interpret them as unchanged.`
		);
	}
	lines.push(
		"",
		"Review Shopify release notes and run the protected theme/test matrix before updating the baseline. This report does not prove storefront compatibility.",
		""
	);
	return lines.join("\n");
}

async function main() {
	const load = async (relativePath) => JSON.parse(await readFile(path.join(projectRoot, relativePath), "utf8"));
	const [baseline, framework, starter] = await Promise.all([
		load("docs/shopify-upstream-baseline.json"),
		load("package.json"),
		load("packages/create-liquid-loom/template/package.json")
	]);
	const report = await inspectUpstreams({
		baseline,
		manifests: { framework, starter },
		token: process.env.GITHUB_TOKEN
	});
	const markdown = formatMarkdown(report);
	console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : markdown);
	if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
	if (report.summary.unavailable === report.sources.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(`Upstream check failed: ${error.message}`);
		process.exitCode = 1;
	});
}
