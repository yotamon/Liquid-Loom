import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const example = path.resolve(import.meta.dirname, "../docs/examples/shopify-deploy.yml");

describe("Shopify deployment branch recipe", () => {
	it("blocks Shopify-originated edits unless reviewed and manually acknowledged", async () => {
		const content = await readFile(example, "utf8");
		assert.match(content, /latest_subject/);
		assert.match(content, /latest_author/);
		assert.match(content, /generated_author/);
		assert.match(content, /GITHUB_EVENT_NAME.*workflow_dispatch/);
		assert.match(content, /RECONCILED_DEPLOYMENT_CHANGES.*true/);
		assert.match(content, /::error::shopify-production has commits not generated/);
		assert.match(content, /git -C "\$deploy_dir" push origin HEAD:shopify-production/);
		assert.doesNotMatch(content, /git[^\n]*push[^\n]*--force/);
	});
});
