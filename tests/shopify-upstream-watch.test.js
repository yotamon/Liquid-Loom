import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	WATCHED_UPSTREAMS,
	checkCliMajorAlignment,
	extractObservedReference,
	formatMarkdown,
	inspectUpstreams
} from "../scripts/shopify-upstream-watch.mjs";

const refs = {
	dawn: "v16.1.1",
	horizon: "c531fd5bb8904e7f871c308b15c64a7cb0de8e20",
	skeleton: "a7a655e79b21e68316c228dc7e437b0b32550888",
	cli: "5.0.1",
	themeCheck: "@shopify/theme-check-common@4.0.0",
	prettier: "@shopify/prettier-plugin-liquid@1.11.4"
};
const makeManifest = (value) => ({ devDependencies: { "@shopify/cli": value } });

const mockSources = (overrides = {}) => {
	const results = {
		"https://api.github.com/repos/Shopify/dawn/releases/latest": { tag_name: refs.dawn },
		"https://api.github.com/repos/Shopify/horizon/commits/main": { sha: refs.horizon },
		"https://api.github.com/repos/Shopify/skeleton-theme/commits/main": { sha: refs.skeleton },
		"https://api.github.com/repos/Shopify/cli/releases/latest": { tag_name: refs.cli },
		"https://api.github.com/repos/Shopify/theme-tools/releases?per_page=100": [
			{ tag_name: "@shopify/theme-check-common@3.31.0" },
			{ tag_name: refs.themeCheck },
			{ tag_name: "@shopify/theme-check-common@4.1.0-beta.1", prerelease: true },
			{ tag_name: refs.prettier }
		],
		...overrides
	};
	const requests = [];
	const fetchImpl = async (url, options) => {
		requests.push(url);
		assert.equal(options.headers["User-Agent"], "liquid-loom-upstream-watch");
		if (results[url] instanceof Error) throw results[url];
		return { ok: true, json: async () => results[url] };
	};
	return { requests, fetchImpl };
};

const input = ({ fetchImpl }) => ({
	baseline: { observedAt: "2026-11-11", refs },
	manifests: { framework: makeManifest("^4.6.0"), starter: makeManifest("^4.8.0") },
	fetchImpl,
	now: () => new Date("2026-11-11T06:00:00.000Z")
});

describe("Shopify upstream watch", () => {
	it("extracts the highest stable package release, not an obsolete repository latest", () => {
		const watch = WATCHED_UPSTREAMS.find((source) => source.id === "themeCheck");
		assert.equal(
			extractObservedReference(watch, [
				{ tag_name: "@shopify/theme-check-common@3.29.0" },
				{ tag_name: "@shopify/theme-check-common@4.0.0" },
				{ tag_name: "@shopify/theme-check-common@5.0.0-rc.1", prerelease: true }
			]),
			"@shopify/theme-check-common@4.0.0"
		);
		assert.throws(() => extractObservedReference(watch, []), /usable stable reference/);
	});

	it("shares Theme Tools requests and reports older CLI dependency majors", async () => {
		const mock = mockSources();
		const report = await inspectUpstreams(input(mock));
		assert.equal(mock.requests.length, 5);
		assert.equal(report.summary.changed, 0);
		assert.equal(report.summary.unavailable, 0);
		assert.equal(report.summary.cliMajorReview, 2);
		assert.equal(report.packages[0].declared, "^4.6.0");
		assert.match(formatMarkdown(report), /CLI dependency alignment/);
		assert.match(formatMarkdown(report), /not prove storefront compatibility/);
	});

	it("distinguishes upstream changes from network failures without false success", async () => {
		const mock = mockSources({
			"https://api.github.com/repos/Shopify/dawn/releases/latest": { tag_name: "v16.2.0" },
			"https://api.github.com/repos/Shopify/horizon/commits/main": new Error("offline")
		});
		const report = await inspectUpstreams(input(mock));
		assert.equal(report.summary.changed, 1);
		assert.equal(report.summary.unavailable, 1);
		assert.equal(report.sources.find((item) => item.id === "horizon").status, "unavailable");
		assert.match(formatMarkdown(report), /Incomplete/);
		assert.equal(report.sources.find((item) => item.id === "dawn").status, "changed");
	});

	it("does not claim a matching Shopify CLI major proves runtime compatibility", () => {
		assert.equal(checkCliMajorAlignment(makeManifest("^5.0.1"), "5.0.1", "pkg").status, "major-aligned");
		assert.equal(checkCliMajorAlignment(makeManifest("^4.8.0"), "5.0.1", "pkg").status, "review");
	});
});
