---
"apx.rest": patch
---

Generated clients now emit `// @ts-nocheck` alongside the existing `/* eslint-disable */` banner, suppressing the TypeScript "declared but never read" error (TS6133) that could surface in consumers compiling generated output with `noUnusedLocals`/`noUnusedParameters` enabled.
