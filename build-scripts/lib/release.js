export function validateReleaseVersions({ tag, rootVersion, scaffolderVersion, starterRange }) {
	if (rootVersion !== scaffolderVersion) {
		throw new Error(
			`Package versions must match: liquid-loom=${rootVersion}, create-liquid-loom=${scaffolderVersion}.`
		);
	}
	if (tag !== `v${rootVersion}`) {
		throw new Error(`Release tag ${tag} must match package version v${rootVersion}.`);
	}
	if (starterRange !== `^${rootVersion}`) {
		throw new Error(`Embedded starter must depend on liquid-loom ^${rootVersion}; found ${starterRange}.`);
	}
	return rootVersion;
}
