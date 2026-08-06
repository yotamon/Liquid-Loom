export { defineConfig, loadProjectConfig } from "./lib/config.js";
export {
	BuildCollisionError,
	DEFAULT_RESERVED_OUTPUTS,
	assertSafeOutput,
	buildProject,
	buildTheme,
	createBuildPlan,
	mapThemePath,
	validateThemeSource
} from "./lib/theme-builder.js";
export { scanForbiddenContent } from "./lib/public-readiness.js";
export { inspectBuild, validatePerformanceBudgets } from "./lib/performance.js";
export { diagnoseProject } from "./lib/doctor.js";
