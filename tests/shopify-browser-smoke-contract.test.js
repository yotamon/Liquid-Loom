import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";

const script = path.resolve(import.meta.dirname, "shopify-browser-smoke.mjs");

describe("protected Shopify browser smoke", () => {
	it("refuses to run against a storefront without an explicit development-store attestation", () => {
		const result = spawnSync(process.execPath, [script], {
			encoding: "utf8",
			env: { ...process.env, LIQUID_LOOM_DEV_STORE_CONFIRMED: "" }
		});
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /non-production Shopify development store/);
	});
	it("requires a complete fixture before importing the optional browser dependency", () => {
		const result = spawnSync(process.execPath, [script], {
			encoding: "utf8",
			env: {
				...process.env,
				LIQUID_LOOM_DEV_STORE_CONFIRMED: "true",
				LIQUID_LOOM_STORE_URL: "",
				LIQUID_LOOM_PRODUCT_PATH: "",
				LIQUID_LOOM_SEARCH_TERM: ""
			}
		});
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /requires LIQUID_LOOM_STORE_URL/);
	});
});
