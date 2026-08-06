export interface PerformanceBudgets {
	maxAssetBytes?: number;
	maxBuildMs?: number;
	maxThemeBytes?: number;
}

export interface LiquidLoomConfig {
	cacheFile?: string;
	forbiddenTerms?: string[];
	outputDir?: string;
	performance?: PerformanceBudgets;
	reservedOutputs?: string[];
	sourceDir?: string;
	viteConfig?: string;
}

export interface ResolvedLiquidLoomConfig extends LiquidLoomConfig {
	cacheFile: string;
	configFile?: string;
	forbiddenTerms: string[];
	outputRoot: string;
	performance: Required<PerformanceBudgets>;
	projectRoot: string;
	reservedOutputs: string[];
	sourceRoot: string;
	viteConfig: string;
}

export interface BuildFile {
	source: string;
	output: string;
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
	status: "pass" | "fail";
}

export class BuildCollisionError extends Error {
	destination: string;
	sources: string[];
}

export const DEFAULT_RESERVED_OUTPUTS: string[];
export function defineConfig(config: LiquidLoomConfig): LiquidLoomConfig;
export function loadProjectConfig(projectRoot?: string): Promise<ResolvedLiquidLoomConfig>;
export function mapThemePath(sourcePath: string): string;
export function createBuildPlan(
	sourceFiles: string[],
	options?: { reservedOutputs?: string[] }
): { files: BuildFile[] };
export function validateThemeSource(sourceRoot: string): Promise<{ valid: boolean; missing: string[] }>;
export function scanForbiddenContent(root: string, forbiddenTerms?: string[]): Promise<unknown[]>;
export function inspectBuild(outputRoot: string): Promise<BuildInspection>;
export function validatePerformanceBudgets(
	outputRoot: string,
	budgets: Required<PerformanceBudgets>,
	durationMs: number
): Promise<BuildInspection>;
export function diagnoseProject(
	config: Pick<ResolvedLiquidLoomConfig, "projectRoot" | "sourceRoot" | "outputRoot" | "viteConfig" | "forbiddenTerms">
): Promise<{ checks: DoctorCheck[]; healthy: boolean }>;
export function assertSafeOutput(options: { projectRoot: string; sourceRoot: string; outputRoot: string }): void;
export function buildTheme(options: {
	projectRoot: string;
	sourceRoot: string;
	outputRoot: string;
	cacheFile: string;
	clean?: boolean;
	useCache?: boolean;
	reservedOutputs?: string[];
}): Promise<BuildSummary>;
export function buildProject(options: {
	projectRoot: string;
	sourceRoot: string;
	outputRoot: string;
	cacheFile: string;
	clean?: boolean;
	reservedOutputs?: string[];
	bundle(context: { outputRoot: string }): Promise<unknown>;
}): Promise<BuildSummary>;
