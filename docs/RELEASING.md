# Releasing

Liquid Loom releases `liquid-loom` and `create-liquid-loom` at the same version.

## One-time npm setup

npm Trusted Publishing can publish an existing package through GitHub Actions OIDC, but the package must already exist in the npm registry before a trusted publisher can be configured.

The repository includes a guarded setup tool so the real `0.1.0` package metadata is never edited in place during bootstrap.

### Requirements

- npm account with two-factor authentication enabled;
- npm CLI 11.15.0 or newer for the `npm trust` setup command;
- Node.js 22.14.0 or newer for npm Trusted Publishing;
- ownership of the intended package names.

Trusted Publishing itself is supported by npm 11.5.1+, but the CLI-based `npm trust` management command used by Liquid Loom requires npm 11.15.0+.

Use a compatible npm 11 release before starting. Do not blindly install `npm@latest`, because npm 12 may require a newer Node.js runtime than the project currently uses.

```bash
npm install --global npm@11
npm login
npm whoami
```

### 1. Check package status

```bash
pnpm npm:status
```

If `liquid-loom` or `create-liquid-loom` does not exist, it needs one bootstrap publication before trust can be configured.

### 2. Inspect the bootstrap packages

```bash
pnpm npm:prepare
```

This creates isolated packages under `.artifacts/npm-bootstrap/`. Each copy is forced to version `0.0.0`, keeps the package publish allowlist, and disables provenance only for this bootstrap copy. The source `package.json` files stay at `0.1.0` with provenance enabled.

Running `pnpm npm:bootstrap` is also safe by default: it prepares the copies but does not publish them.

### 3. Perform the one-time bootstrap publication

After inspecting the prepared package metadata:

```bash
node build-scripts/npm-release-setup.js bootstrap --publish
```

The command:

- verifies npm authentication;
- re-checks the registry immediately before publishing;
- skips any package name that already exists;
- publishes only missing packages as `0.0.0` under the non-default `bootstrap` dist-tag;
- disables provenance for those bootstrap copies only;
- runs npm directly in each prepared package directory, avoiding shell argument parsing differences across macOS, Linux, and Windows;
- inherits your terminal for npm's browser or two-factor authentication prompts.

It never publishes `0.1.0`.

On a first-ever registry publication, verify the resulting dist-tags. If npm also created `latest` pointing at the bootstrap version, remove only that tag before the real release:

```bash
npm dist-tag rm liquid-loom latest
npm dist-tag rm create-liquid-loom latest
npm view liquid-loom dist-tags
npm view create-liquid-loom dist-tags
```

Keep the `bootstrap` tag and the immutable `0.0.0` versions in place.

### 4. Configure GitHub Trusted Publishing

Once both package names exist:

```bash
pnpm npm:trust
```

This configures both packages with:

- GitHub owner: `yotamon`
- repository: `Liquid-Loom`
- workflow: `release.yml`
- environment: `npm`
- direct `npm publish`: allowed

The command uses npm's `npm trust github` interface and therefore requires account-level two-factor authentication. The setup tool runs it interactively so npm can open or display the authentication flow when required.

In GitHub, ensure the `npm` environment exists. Add required reviewers if you want a human gate before a release job can publish.

### 5. Lock down traditional publishing

After a successful OIDC release, restrict or revoke any temporary npm publishing credential. Normal Liquid Loom releases should not depend on a long-lived write token.

See npm's [Trusted Publishers documentation](https://docs.npmjs.com/trusted-publishers/) and [`npm trust`](https://docs.npmjs.com/cli/v11/commands/npm-trust/) documentation for the current registry requirements.

npm requires a public repository and matching repository metadata for automatic provenance. The release workflow grants `id-token: write` for OIDC and uses GitHub-hosted runners. It pins npm `11.19.1` so release behavior does not change when the registry's `latest` npm tag moves to a new major.

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

For the first release, also confirm that `latest` points to `0.1.0` rather than the bootstrap version:

```bash
npm view liquid-loom dist-tags
npm view create-liquid-loom dist-tags
```

Never publish a real release from an uncommitted local worktree or with a long-lived npm token.
