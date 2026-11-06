---
"apx.rest": patch
---

Generated clients are now reproducible. The file header no longer contains a `Generated on:` timestamp, and for a local OpenAPI file the `Source OpenAPI document:` line now shows the value from `openApiJsonDocumentUrl`, so a relative path no longer becomes a machine-specific absolute path. Regeneration no longer changes a file when the generated code is the same, which removes merge conflicts in the header for teams that commit generated clients. The first regeneration after this upgrade changes the header once.
