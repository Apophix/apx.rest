# apx.rest

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
