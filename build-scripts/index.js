export { defineConfig, loadProjectConfig } from "./lib/config.js";
export {
	BuildCollisionError,
	DEFAULT_RESERVED_OUTPUTS,
	SHOPIFY_THEME_DIRECTORIES,
	assertSafeOutput,
	buildProject,
	buildTheme,
	createBuildPlan,
	discoverSourceEntries,
	mapShopifyPath,
	mapThemePath,
	validateThemePlan,
	validateThemeSource
} from "./lib/theme-builder.js";
export {
	applyMigration,
	detectPackageManager,
	detectShopifyTheme,
	initializeExistingTheme,
	planExistingThemeInit,
	planMigration
} from "./lib/existing-theme.js";
export { scanForbiddenContent } from "./lib/public-readiness.js";
export { inspectBuild, validatePerformanceBudgets } from "./lib/performance.js";
export { diagnoseProject } from "./lib/doctor.js";
