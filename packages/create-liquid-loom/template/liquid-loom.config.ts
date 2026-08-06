import { defineConfig } from "liquid-loom";

export default defineConfig({
	performance: {
		maxAssetBytes: 500_000,
		maxBuildMs: 10_000,
		maxThemeBytes: 5_000_000
	}
});
