export interface PerformanceBudgets {
	maxAssetBytes?: number;
	maxBuildMs?: number;
	maxThemeBytes?: number;
}

export interface LiquidLoomConfig {
	cacheFile?: string;
	forbiddenTerms?: string[];
	outputDir?: string;
	performance?: PerformanceBudgets | false;
	reservedOutputs?: string[];
	shopifySourceDir?: string;
	sourceDir?: string;
	viteConfig?: string | false;
}

export interface SourceLayer {
	id: string;
	kind: "organized" | "shopify";
	root: string;
}

export interface ResolvedLiquidLoomConfig extends Omit<LiquidLoomConfig, "performance" | "viteConfig"> {
	cacheFile: string;
	configFile?: string;
	forbiddenTerms: string[];
	outputRoot: string;
	performance: Required<PerformanceBudgets>;
	performanceEnabled: boolean;
	projectRoot: string;
	reservedOutputs: string[];
	shopifySourceRoot?: string;
	sourceLayers: SourceLayer[];
	sourceRoot: string;
	viteConfig: string | false;
	viteEnabled: boolean;
}

export interface SourceEntry {
	displayPath: string;
	kind: "organized" | "shopify";
	layerId: string;
	relativePath: string;
	root: string;
}

export interface BuildFile extends SourceEntry {
	output: string;
	source: string;
	sourceKey: string;
}

export interface BuildSummary {
	bytes: number;
	copied: number;
	removed: number;
	skipped: number;
	total: number;
}

export interface BuildInspection {
	fileCount: number;
	files: Array<{ file: string; size: number }>;
	largestAsset: { file: string; size: number } | null;
	totalBytes: number;
}

export interface DoctorCheck {
	message: string;
	name: string;
	status: "pass" | "warn" | "fail";
}

export interface ExistingThemeInitPlan {
	packageManager: "npm" | "pnpm" | "yarn" | "bun";
	themeRoot: string;
	themeFiles: number;
	mutations: Array<{ action: "create" | "update"; path: string }>;
}

export interface MigrationMove {
	destination: string;
	from: string;
	fromDisplay: string;
	output: string;
	to: string;
	toDisplay: string;
}

export class BuildCollisionError extends Error {
	destination: string;
	sources: string[];
}

export const DEFAULT_RESERVED_OUTPUTS: string[];
export const SHOPIFY_THEME_DIRECTORIES: string[];
export function defineConfig(config: LiquidLoomConfig): LiquidLoomConfig;
export function loadProjectConfig(projectRoot?: string): Promise<ResolvedLiquidLoomConfig>;
export function mapThemePath(sourcePath: string): string;
export function mapShopifyPath(sourcePath: string): string;
export function discoverSourceEntries(options: {
	projectRoot: string;
	sourceRoot?: string;
	shopifySourceRoot?: string;
}): Promise<SourceEntry[]>;
export function createBuildPlan(
	sourceFiles: Array<string | SourceEntry>,
	options?: { reservedOutputs?: string[] }
): { files: BuildFile[] };
export function validateThemePlan(plan: { files: Array<Pick<BuildFile, "output">> }): {
	valid: boolean;
	missing: string[];
};
export function validateThemeSource(sourceRoot: string): Promise<{ valid: boolean; missing: string[] }>;
export function scanForbiddenContent(root: string, forbiddenTerms?: string[]): Promise<unknown[]>;
export function inspectBuild(outputRoot: string): Promise<BuildInspection>;
export function validatePerformanceBudgets(
	outputRoot: string,
	budgets: Required<PerformanceBudgets>,
	durationMs: number
): Promise<BuildInspection>;
export function diagnoseProject(config: ResolvedLiquidLoomConfig): Promise<{ checks: DoctorCheck[]; healthy: boolean }>;
export function assertSafeOutput(options: {
	projectRoot: string;
	sourceRoot?: string;
	shopifySourceRoot?: string;
	outputRoot: string;
}): void;
export function buildTheme(options: {
	projectRoot: string;
	sourceRoot: string;
	shopifySourceRoot?: string;
	outputRoot: string;
	cacheFile: string;
	clean?: boolean;
	useCache?: boolean;
	reservedOutputs?: string[];
}): Promise<BuildSummary>;
export function buildProject(options: {
	projectRoot: string;
	sourceRoot: string;
	shopifySourceRoot?: string;
	outputRoot: string;
	cacheFile: string;
	clean?: boolean;
	reservedOutputs?: string[];
	bundle(context: { outputRoot: string }): Promise<unknown>;
}): Promise<BuildSummary>;
export function detectShopifyTheme(projectRoot: string, themeDir?: string): Promise<string>;
export function detectPackageManager(
	projectRoot: string,
	explicit?: "npm" | "pnpm" | "yarn" | "bun"
): Promise<"npm" | "pnpm" | "yarn" | "bun">;
export function planExistingThemeInit(options: {
	projectRoot: string;
	themeDir?: string;
	packageManager?: "npm" | "pnpm" | "yarn" | "bun";
	packageVersion: string;
}): Promise<ExistingThemeInitPlan>;
export function initializeExistingTheme(options: {
	projectRoot: string;
	themeDir?: string;
	packageManager?: "npm" | "pnpm" | "yarn" | "bun";
	packageVersion: string;
	install?: boolean;
	dryRun?: boolean;
}): Promise<ExistingThemeInitPlan & { applied: boolean }>;
export function planMigration(
	config: ResolvedLiquidLoomConfig,
	options: { target?: string; all?: boolean; to?: string }
): Promise<MigrationMove[]>;
export function applyMigration(
	config: ResolvedLiquidLoomConfig,
	options: { target?: string; all?: boolean; to?: string; apply?: boolean }
): Promise<{ applied: boolean; moves: MigrationMove[] }>;
