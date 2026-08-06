# Releasing

Liquid Loom releases `liquid-loom` and `create-liquid-loom` at the same version.

## One-time npm setup

1. Create or claim both public packages on npm.
2. Configure GitHub trusted publishing for repository `yotamon/Liquid-Loom`, workflow `release.yml`, environment `npm`, and allow `npm publish`.
3. In the GitHub repository, create the protected `npm` environment and add required reviewers if desired.
4. Restrict or revoke npm automation tokens after trusted publishing succeeds.

npm requires a public repository and exact matching repository metadata for automatic provenance. The release workflow grants only `contents`, `id-token`, and attestation permissions.

## Release process

1. Move notable entries from `Unreleased` in `CHANGELOG.md` into the target version.
2. Keep the version identical in the root package, scaffolder package, embedded starter dependency, and scaffolder CLI output.
3. Run `pnpm validate` and `pnpm pack:check`.
4. Merge the release change into `main`.
5. Create and push a signed or annotated `vX.Y.Z` tag.

The tag workflow validates again, packs both exact artifacts, creates GitHub attestations, publishes through npm OIDC, and creates a GitHub release with generated notes and attached tarballs.

## Verify

```bash
npm view liquid-loom version
npm view create-liquid-loom version
gh attestation verify liquid-loom-0.1.0.tgz --repo yotamon/Liquid-Loom
pnpm create liquid-loom@latest release-smoke
```

Never publish from an uncommitted local worktree or with a long-lived npm token.
