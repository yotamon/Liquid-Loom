export interface PerformanceBudgets {
	maxAssetBytes?: number;
	maxBuildMs?: number;
	maxThemeBytes?: number;
}

export type ShopifyLiquidMode = "stable" | "july-2026-preview";

export interface LiquidLoomConfig {
	cacheFile?: string;
	forbiddenTerms?: string[];
	outputDir?: string;
	performance?: PerformanceBudgets | false;
	reservedOutputs?: string[];
	shopifyLiquidMode?: ShopifyLiquidMode;
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
	shopifyLiquidMode: ShopifyLiquidMode;
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

export type ProjectModelReferenceKind = "asset" | "block" | "section" | "snippet";

export interface ProjectModelReference {
	kind: ProjectModelReferenceKind;
	name: string;
	output?: string;
}

export interface ProjectModelPreviewUsage {
	blockTag: string[];
	partialTag: string[];
}

export interface ProjectModelFile {
	feature: string;
	kind: "organized" | "shopify";
	output: string;
	partials: string[];
	preview: {
		blockTag: boolean;
		partialTag: boolean;
	};
	references: ProjectModelReference[];
	source: string;
	sourceKey: string;
	type: string;
}

export interface ProjectModelFeature {
	files: string[];
	name: string;
	outputs: string[];
	partials: string[];
	references: ProjectModelReference[];
}

export interface UnresolvedProjectModelReference extends ProjectModelReference {
	from: string;
	output: string;
}

export interface ProjectModel {
	features: ProjectModelFeature[];
	files: ProjectModelFile[];
	generatedOutputs: string[];
	liquidMode: ShopifyLiquidMode;
	preview: ProjectModelPreviewUsage;
	summary: {
		features: number;
		files: number;
		partials: number;
		references: number;
		unresolvedReferences: number;
	};
	unresolvedReferences: UnresolvedProjectModelReference[];
	version: 1;
}

export interface ProjectModelSelection {
	feature?: ProjectModelFeature;
	files: ProjectModelFile[];
	liquidMode: ShopifyLiquidMode;
	preview: ProjectModelPreviewUsage;
	version: 1;
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
export function createProjectModel(config: ResolvedLiquidLoomConfig): Promise<ProjectModel>;
export function selectProjectModel(model: ProjectModel, target?: string): ProjectModel | ProjectModelSelection;
export function formatProjectModel(model: ProjectModel, target?: string): string;
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
