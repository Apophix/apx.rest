# apx.rest

## 1.3.0

### Minor Changes

- 575d1ec: Add `includeEndpoints` and `excludeEndpoints` config options to generate client methods for only part of an API. Each option takes a list of glob patterns (`*`, `?`, `**`) that the generator matches against the OpenAPI path keys. An exclude match always wins over an include match. When both options are omitted, all endpoints are generated, as before. Component schemas are still emitted for every endpoint. The generator warns about patterns that match no endpoint and fails fast on invalid pattern lists. See "Filtering Endpoints" in the README.

### Patch Changes

- 6a0047a: Fix configs with more than one entry in `apis`. The config reader saved the first entry and ignored later ones, so every iteration generated the first client again and the other clients were never written. Each entry in `apis` now uses its own settings.

## 1.2.4

### Patch Changes

- 27c992b: Generated clients now emit `// @ts-nocheck` alongside the existing `/* eslint-disable */` banner, suppressing the TypeScript "declared but never read" error (TS6133) that could surface in consumers compiling generated output with `noUnusedLocals`/`noUnusedParameters` enabled.

## 1.2.3

### Patch Changes

- 71227c8: Bump transitive `esbuild` to >= 0.28.1 (via override, covering both the `tsx` and `vite` dependency paths) to resolve a Windows-only arbitrary file read in the esbuild dev server (Dependabot #8, low).
- 71227c8: Bump transitive `vite` to >= 8.0.16 to resolve two Windows-only security advisories: a `server.fs.deny` bypass via alternate paths (Dependabot #10, high) and an NTLMv2 hash disclosure in `launch-editor` via UNC path handling (#11, medium).

## 1.2.2

### Patch Changes

- bbfe32a: Fix `postFormData` leaking a configured `Content-Type` header. When a client had `Content-Type: application/json` set (e.g. as a persistent/basic header), `postFormData` would send it on multipart uploads, overriding the `multipart/form-data` boundary that `fetch` generates automatically and breaking the request. `postFormData` now strips `Content-Type` before sending, matching the existing behavior of `postFormDataRawIterable`.

## 1.2.1

### Patch Changes

- 630369d: Upgrade dependencies to address security advisories

## 1.2.0

### Minor Changes

- 1aab527: Add support for local file paths in `openApiJsonDocumentUrl`. If the value does not start with `http://` or `https://`, it is treated as a path to a local OpenAPI JSON file. Relative paths are resolved from the current working directory; absolute paths are used as-is.

## 1.1.1

### Patch Changes

- de01f93: Fix publish: add repository field for provenance validation and correct bin shebang to use node

## 1.1.0

### Minor Changes

- e27efa6: Add ignoreTlsErrors config option to control TLS certificate validation when fetching OpenAPI documents
