import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateReleaseVersions } from "../build-scripts/lib/release.js";

describe("release versions", () => {
	it("requires the tag, packages, and embedded starter to agree", () => {
		assert.doesNotThrow(() =>
			validateReleaseVersions({
				rootVersion: "0.1.0",
				scaffolderVersion: "0.1.0",
				starterRange: "^0.1.0",
				tag: "v0.1.0"
			})
		);
		assert.throws(
			() =>
				validateReleaseVersions({
					rootVersion: "0.1.0",
					scaffolderVersion: "0.1.1",
					starterRange: "^0.1.0",
					tag: "v0.1.0"
				}),
			/package versions must match/i
		);
	});
});
