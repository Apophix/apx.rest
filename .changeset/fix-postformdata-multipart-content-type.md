---
"apx.rest": patch
---

Fix `postFormData` leaking a configured `Content-Type` header. When a client had `Content-Type: application/json` set (e.g. as a persistent/basic header), `postFormData` would send it on multipart uploads, overriding the `multipart/form-data` boundary that `fetch` generates automatically and breaking the request. `postFormData` now strips `Content-Type` before sending, matching the existing behavior of `postFormDataRawIterable`.
