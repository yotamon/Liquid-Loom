# Releasing

Liquid Loom releases `liquid-loom` and `create-liquid-loom` at the same version.

## One-time npm setup

npm Trusted Publishing can publish an existing package through GitHub Actions OIDC, but the package must already exist in the npm registry before a trusted publisher can be configured.

For each package name:

1. Check whether `liquid-loom` and `create-liquid-loom` already exist under the intended npm account.
2. If a package does not exist, make one manual bootstrap publication under a non-default tag before the real release. Keep this bootstrap version separate from `latest` so `0.1.0` remains the first user-facing release.
3. Configure GitHub Trusted Publishing for repository `yotamon/Liquid-Loom`, workflow `release.yml`, environment `npm`, and allow `npm publish`.
4. In the GitHub repository, create the protected `npm` environment and add required reviewers if desired.
5. Restrict or revoke any temporary npm publishing credential after Trusted Publishing succeeds.

See npm's [Trusted Publishers documentation](https://docs.npmjs.com/trusted-publishers/) for the current registry requirements. Normal Liquid Loom releases should use the OIDC workflow rather than a long-lived npm token.

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

Never publish a real release from an uncommitted local worktree or with a long-lived npm token.
