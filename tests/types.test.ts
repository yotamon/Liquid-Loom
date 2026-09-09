import {
	applyMigration,
	defineConfig,
	planMigration,
	type LiquidLoomConfig,
	type PerformanceBudgets
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

const typedPlanMigration: typeof planMigration = planMigration;
const typedApplyMigration: typeof applyMigration = applyMigration;

void config;
void existingThemeConfig;
void typedPlanMigration;
void typedApplyMigration;
