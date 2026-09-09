import {
	applyMigration,
	defineConfig,
	planMigration,
	type LiquidLoomConfig,
	type PerformanceBudgets,
	type ResolvedLiquidLoomConfig
} from "liquid-loom";

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

const existingThemeConfig: LiquidLoomConfig = defineConfig({
	shopifySourceDir: ".",
	sourceDir: "src",
	outputDir: "dist/theme",
	viteConfig: false,
	performance: false
});

declare const resolvedExistingTheme: ResolvedLiquidLoomConfig;
void planMigration(resolvedExistingTheme, { target: "sections/hero.liquid" });
void applyMigration(resolvedExistingTheme, { all: true, apply: true });
void config;
void existingThemeConfig;
