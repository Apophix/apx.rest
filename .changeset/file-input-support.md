---
"apx.rest": minor
---

Add support for local file paths in `openApiJsonDocumentUrl`. If the value does not start with `http://` or `https://`, it is treated as a path to a local OpenAPI JSON file. Relative paths are resolved from the current working directory; absolute paths are used as-is.
