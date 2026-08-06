# Benchmarks

Benchmarks are diagnostic evidence, not universal promises. Results depend on CPU, filesystem, antivirus, package cache, and source size.

## 2026-08-06 Windows baseline

Environment: Windows, Node 24, pnpm 11, Vite 8, Tailwind CSS 4, warm dependency store.

| Pipeline                               | Framework-reported clean build |
| -------------------------------------- | -----------------------------: |
| Generic Tailwind/PostCSS chain         |                   about 38.1 s |
| Native `@tailwindcss/vite` integration |                      under 2 s |

The native integration also removed roughly 80 installed package entries in this repository’s resolved dependency graph. Generated CSS remained materially equivalent for the reference theme.

## Reproduce

```powershell
pnpm install --frozen-lockfile
Measure-Command { pnpm build:clean }
Measure-Command { pnpm build }
pnpm analyze
```

Use a clean Git worktree and report framework output separately from shell startup or package installation. The default configuration also enforces a 10-second build budget, a 5 MB total theme budget, and a 500 KB per-asset budget during every transactional build.
