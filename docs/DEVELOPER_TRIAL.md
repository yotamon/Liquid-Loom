# Independent Shopify developer trial

**Status:** Test protocol only. No external trial, repeat-adoption evidence, or Shopify browser acceptance is claimed by this document.

## Eligibility and release versions

Recruit at least three developers who did not build Liquid Loom, ideally including a freelancer, a small-agency developer, and a developer maintaining an established custom Shopify theme. Avoid friends who will simply agree with the author; record negative and partial feedback too.

**Do not confuse source and public npm:** As verified on November 10, 2026, npm `@latest` for both `liquid-loom` and `create-liquid-loom` is `0.1.1`, behind the `0.2.0` repository source and its newer `--preset`, `doctor --json`, and Shopify-native patterns. See [release tracking](https://github.com/yotamon/Liquid-Loom/issues/12).

Until the next release is published and independently verified, distinguish:

- **Source/engineering rehearsal:** a contributor checks out a specific `main` commit, runs `pnpm install --frozen-lockfile` and `pnpm pack:check`, and records the exact commit. This tests packaged source, **not** the public npm onboarding experience.
- **Public first-user trial:** a participant uses `npm create liquid-loom@latest`, `pnpm create liquid-loom@latest`, or another supported package manager only **after** the public registry test is green for the expected release. Record resolved package versions.

Never compare times from the two populations as if they are the same test.

## Trial setup

Use a separate non-production Shopify development store with test merchandise, or clearly label the trial **offline only**. Do not connect to customer storefronts, upload unpublished client themes, paste access tokens into notes, or modify a production theme. The participant can stop at any stage; partial attempts count as friction evidence.

Record the OS, Node version, package manager/version, Shopify CLI version, evaluated source commit or published npm versions, prior Shopify theme experience, and whether Shopify authentication was already working. Collect only data the participant agrees to share.

## Fresh-theme track

1. **Start clock** at the first installation/scaffold command, with Node, the package manager, and Shopify credentials already available if preview is part of the test.
2. Create the project and note first scaffold success or failure. Do not coach unless the participant becomes blocked; record each hint.
3. Build once, inspect `dist/theme`, and describe in their own words which files Shopify receives.
4. Edit one section under `src/theme/sections/<feature>/`. Rebuild and verify its flattened output path.
5. Deliberately create a portable basename collision, diagnose it with `doctor`, and repair it. Ask what the error means before offering help.
6. If a development store is available, preview the generated theme with Shopify CLI. Stop the clock at the **first working Shopify preview**, not at the first successful local build.
7. Have the participant describe one thing they would want changed before using the tool on the next client project.

Use the [first-project walkthrough](FIRST_PROJECT.md) as reference only **after** observing where unassisted navigation fails.

## Existing-theme adoption track

1. Use a conventional Shopify theme fixture or a consented copy of an existing client theme, never the production branch.
2. Run `liquid-loom init --dry-run`. Ask the participant which source files they expect to be moved (correct answer: none).
3. Apply initialization, build, and compare untouched native theme files with original outputs.
4. Add one feature-organized section and inspect its compiled path without changing the previous asset pipeline.
5. Trigger a native-versus-organized source collision and recover from it using the diagnostics.
6. Preview in a development store when available. Record any Theme Editor, Shopify CLI, and ownership differences.

## What to measure

| Signal | Definition | Do not count |
| --- | --- | --- |
| Time to first local build | Scaffold command started to first successful `dist/theme` build | Cached or undocumented prebuilt workspace |
| Time to first live preview | Installation/scaffold started to a rendered Shopify CLI development preview | Local build alone or a previously open preview |
| Unassisted completion | Participant completes the step without facilitator advice | A facilitator fixing commands for them |
| Recovery success | Participant explains and fixes the intentional filename collision | Re-running commands without understanding the collision |
| Adopt-again intent | Explicit Yes/Maybe/No and the reason | GitHub stars or general compliments |
| Repeat-use evidence | A participant independently starts a **second** theme with Liquid Loom | Saying they might use it someday |

Record wall-clock elapsed time and any Shopify login or network interruption separately; avoid fake precision and do not report a median until there are enough comparable observations. The working target is first live preview within ten minutes **when prerequisites are already configured**, not a promised benchmark.

## Session record (copy for each participant)

```text
Anonymous session ID:
Session date:
Experience: freelancer / agency / in-house / other
Track: fresh / adoption / offline-only
Code version: commit SHA or both installed npm package versions
Node / package manager / OS / Shopify CLI:
Dev store and authentication preconfigured: yes / no

Scaffold: success / blocked / not attempted; elapsed:
First local build: success / blocked / not attempted; elapsed:
Feature edit + output path: success / blocked / not attempted; elapsed:
Collision recovery: success / prompted / blocked; hint count:
Live preview: success / blocked / not attempted; elapsed:
What they expected vs observed:
Most confusing step (quote only with permission):
Use again: yes / maybe / no; reason:
Follow-up issue URLs:
Second independent project observed later: yes / no / unknown:
Permission for attributed public quote: yes / no:
```

For public summaries, aggregate results and anonymize comments by default. Attribute a quote only after explicit consent. Do not include store URL credentials or client intellectual property in GitHub issues.

## Decision gate

After at least three independent developer sessions, review the observations together. Rank repeated failures by **frequency, severity, and recoverability**. Fix the highest recurring obstacle and repeat that step with a fresh tester. A release or marketing claim requires its own evidence: a clean public-registry installation, a real development-store browser run, and honest known limitations.

Report how many participants completed each step and whether any opted into a second project. Publish a concise finding in [issue #14](https://github.com/yotamon/Liquid-Loom/issues/14); explicitly report unknown or unsuccessful results. Defer broad plugin APIs until repeated real users request them.
