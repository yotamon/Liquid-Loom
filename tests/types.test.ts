import {
	applyMigration,
	createProjectModel,
	defineConfig,
	formatProjectModel,
	planMigration,
	selectProjectModel,
	type LiquidLoomConfig,
	type PerformanceBudgets,
	type ProjectModel,
	type ShopifyLiquidMode
} from "liquid-loom";

const budgets: PerformanceBudgets = {
	maxAssetBytes: 500_000,
	maxBuildMs: 10_000,
	maxThemeBytes: 5_000_000
};

const liquidMode: ShopifyLiquidMode = "july-2026-preview";

const config: LiquidLoomConfig = defineConfig({
	outputDir: "dist/theme",
	performance: budgets,
	reservedOutputs: ["assets/theme.js", "assets/style.css"],
	shopifyLiquidMode: liquidMode
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
const typedProjectModel: typeof createProjectModel = createProjectModel;
const typedSelectProjectModel: typeof selectProjectModel = selectProjectModel;
const typedFormatProjectModel: typeof formatProjectModel = formatProjectModel;
type ProjectModelVersion = ProjectModel["version"];
const modelVersion: ProjectModelVersion = 1;

void config;
void existingThemeConfig;
void typedPlanMigration;
void typedApplyMigration;
void typedProjectModel;
void typedSelectProjectModel;
void typedFormatProjectModel;
void modelVersion;
