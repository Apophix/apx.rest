# Project Cleanup & Productionization Plan

## Problem Statement

The project has several issues preventing it from being a clean, publishable npm library:

1. **Compiled artifacts polluting source directories** — `generator/` and the root contain `.js`, `.d.ts`, and `.d.ts.map` files sitting directly next to `.ts` source files. These are stale manual build outputs that shouldn't live in source control.
2. **No CI/CD pipeline** — no GitHub Actions workflows for testing, building, or publishing.
3. **Versioning is manual and undisciplined** — version is hardcoded at `1.0.0` with no release automation or changelog.
4. **`package.json` is sloppy** — `bin` points at a `.ts` file, `files` uses a catch-all `**/*` glob, and `exports` only exposes the CJS entrypoint.
5. **The `codegen` CLI tool has no compiled entry** — it relies on `tsx` at runtime, which is fine for dev but not clean for distribution.

---

## Proposed Approach

### 1. Remove compiled artifacts from source directories

Delete all `.js`, `.d.ts`, and `.d.ts.map` files from `generator/`, the root (e.g. `codegen.js`, `codegen.d.ts`), and `bin/`. All compiled output must live exclusively under `dist/`.

**Files to delete:**
- `codegen.js`, `codegen.d.ts`, `codegen.d.ts.map`
- `generator/ConfigProvider.js`, `generator/ConfigProvider.d.ts`, `generator/ConfigProvider.d.ts.map`
- `generator/Generator.js`, `generator/Generator.d.ts`, `generator/Generator.d.ts.map`
- `generator/default-config.js`, `generator/default-config.d.ts`, `generator/default-config.d.ts.map`
- Everything under `bin/`

### 2. Fix `.gitignore`

Add rules to permanently exclude compiled artifacts from source directories:

```
dist/
bin/
*.js
*.d.ts
*.d.ts.map
```

> Use specific patterns scoped to the right paths to avoid accidentally ignoring anything intentional.

### 3. Fix `tsconfig.build.json`

Ensure `rootDir` is set to `.` and `outDir` is `./dist`, so the compiled output mirrors the source tree under `dist/`:

```
dist/
  src/
    ApiClient.js
    index.js
    utils.js
  generator/
    ConfigProvider.js
    Generator.js
    default-config.js
  codegen.js
```

Confirm `declaration: true` and `declarationMap: true` are set for proper type exports.

### 4. Fix `package.json`

- **`main`**: `./dist/src/index.js`
- **`types`**: `./dist/src/index.d.ts`
- **`exports`**: expose the library root and type declarations properly
- **`bin`**: point `apx-gen` to `./dist/codegen.js` (compiled output, not raw `.ts`)
- **`files`**: replace the `**/*` wildcard with a precise list: `["dist/", "README.md"]`
- **`scripts`**: add a `typecheck` script (`tsc --noEmit`) separate from build

### 5. Set up semantic versioning with Changesets

Install and configure [`@changesets/cli`](https://github.com/changesets/changesets):

```bash
npm install --save-dev @changesets/cli
npx changeset init
```

This gives us:
- A `CHANGELOG.md` that auto-generates from changesets
- Version bumping via `npx changeset version`
- A structured way to communicate breaking vs. non-breaking changes

### 6. GitHub Actions Workflows

Create `.github/workflows/` with the following workflows:

#### `ci.yml` — runs on every push and PR to `main`
- Checkout, setup Node (LTS)
- `npm ci`
- `npm run typecheck`
- `npm run build`
- `npm test`

#### `release.yml` — runs on push to `main`, uses Changesets action
- Checkout, setup Node
- `npm ci`
- `npm run build`
- Uses `changesets/action` to either:
  - Open/update a "Version Packages" PR when changesets are present, OR
  - Publish to npm when the version PR is merged (triggered by version bump commit)

> Requires an `NPM_TOKEN` secret in the GitHub repo settings.

---

## File Changes Summary

| Action | Path |
|--------|------|
| Delete | `codegen.js`, `codegen.d.ts`, `codegen.d.ts.map` |
| Delete | `generator/*.js`, `generator/*.d.ts`, `generator/*.d.ts.map` |
| Delete | `bin/` contents |
| Update | `.gitignore` |
| Update | `tsconfig.build.json` |
| Update | `package.json` |
| Create | `.github/workflows/ci.yml` |
| Create | `.github/workflows/release.yml` |
| Create | `.changeset/config.json` (via `changeset init`) |
| Create | `CHANGELOG.md` (initially empty, managed by changesets) |

---

## Out of Scope

- Changing the library's public API or behavior
- Switching to a bundler (esbuild, rollup) — plain `tsc` is fine for this use case
- Adding ESLint or other linters (separate concern)
