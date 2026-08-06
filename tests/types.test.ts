import { defineConfig, type LiquidLoomConfig, type PerformanceBudgets } from "liquid-loom";

const budgets: PerformanceBudgets = {
	maxAssetBytes: 500_000,
	maxBuildMs: 10_000,
	maxThemeBytes: 5_000_000
};

const config: LiquidLoomConfig = defineConfig({
	outputDir: "dist/theme",
	performance: budgets,
	reservedOutputs: ["assets/theme.js", "assets/style.css"]
});

void config;
