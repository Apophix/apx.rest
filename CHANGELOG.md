# apx.rest

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
