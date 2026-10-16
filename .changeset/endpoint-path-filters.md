---
"apx.rest": minor
---

Add `includeEndpoints` and `excludeEndpoints` config options to generate client methods for only part of an API. Each option takes a list of glob patterns (`*`, `?`, `**`) that the generator matches against the OpenAPI path keys. An exclude match always wins over an include match. When both options are omitted, all endpoints are generated, as before. Component schemas are still emitted for every endpoint. The generator warns about patterns that match no endpoint and fails fast on invalid pattern lists. See "Filtering Endpoints" in the README.
