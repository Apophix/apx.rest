# apx.rest — Comprehensive Unit Test Plan

---

## Table of Contents

1. [ApiClient — Constructor & URL Building](#1-apiclient--constructor--url-building)
2. [ApiClient — Header Management](#2-apiclient--header-management)
3. [ApiClient — buildRequestOptions](#3-apiclient--buildrequestoptions)
4. [ApiClient — buildHeaders](#4-apiclient--buildheaders)
5. [ApiClient — get()](#5-apiclient--get)
6. [ApiClient — post()](#6-apiclient--post)
7. [ApiClient — postFormData()](#7-apiclient--postformdata)
8. [ApiClient — put()](#8-apiclient--put)
9. [ApiClient — patch()](#9-apiclient--patch)
10. [ApiClient — delete()](#10-apiclient--delete)
11. [ApiClient — getRawIterable()](#11-apiclient--getrawiterablee)
12. [ApiClient — postRawIterable()](#12-apiclient--postrawiterablee)
13. [ApiClient — putRawIterable()](#13-apiclient--putrawiterablee)
14. [ApiClient — patchRawIterable()](#14-apiclient--patchrawiterablee)
15. [ApiClient — deleteRawIterable()](#15-apiclient--deleterawiterablee)
16. [ApiClient — postFormDataRawIterable()](#16-apiclient--postformdatarawiterablee)
17. [ApiClient — handleResponseChunk()](#17-apiclient--handleresponsechunk)
18. [ApiClient — High-level Iterables (getIterable, postIterable, etc.)](#18-apiclient--high-level-iterables)
19. [utils — cloneObject()](#19-utils--cloneobject)
20. [ConfigProvider — getUserApiConfigs()](#20-configprovider--getuserapiconfigs)
21. [ConfigProvider — getNumberOfUserConfigs()](#21-configprovider--getnumberofuserconfigs)
22. [ConfigProvider — getValue()](#22-configprovider--getvalue)
23. [ConfigProvider — preload()](#23-configprovider--preload)
24. [Generator — Property class](#24-generator--property-class)
25. [Generator — EnumComponent class](#25-generator--enumcomponent-class)
26. [Generator — Component (base) class](#26-generator--component-base-class)
27. [Generator — RequestComponent class](#27-generator--requestcomponent-class)
28. [Generator — ResponseComponent class](#28-generator--responsecomponent-class)
29. [Generator — ModelComponent class](#29-generator--modelcomponent-class)
30. [Generator — ApiPath class (properties & derived state)](#30-generator--apipath-class-properties--derived-state)
31. [Generator — ApiPath.render() dispatch logic](#31-generator--apipathrender-dispatch-logic)
32. [Generator — ApiPath.clientMethodName](#32-generator--apipathmethodname)
33. [Generator — ApiPath rendered method bodies](#33-generator--apipath-rendered-method-bodies)
34. [Generator — stripUrlChars / splitAtUrlChars helpers](#34-generator--stripurlchars--spliturlchars-helpers)
35. [Generator — generateApi() full flow (integration-style unit)](#35-generator--generateapi-full-flow)
36. [Generator — multi-API config loop](#36-generator--multi-api-config-loop)

---

## 1. ApiClient — Constructor & URL Building

| # | Test name | Description |
|---|-----------|-------------|
| 1.1 | `constructor stores baseUrl without trailing slash added when already present` | Pass `"https://api.example.com/"` — `baseUrl` remains unchanged. |
| 1.2 | `constructor appends trailing slash when missing` | Pass `"https://api.example.com"` — `baseUrl` becomes `"https://api.example.com/"`. |
| 1.3 | `constructor handles empty string baseUrl` | Pass `""` — `baseUrl` is `""` (empty, no slash appended because falsy guard). |
| 1.4 | `buildUrl strips leading slash from path` | Call `buildUrl("/users/1")` — returns `"https://api.example.com/users/1"`. |
| 1.5 | `buildUrl does not double-slash when path has no leading slash` | Call `buildUrl("users/1")` — returns `"https://api.example.com/users/1"`. |
| 1.6 | `buildUrl handles empty path` | Call `buildUrl("")` — returns `"https://api.example.com/"`. |
| 1.7 | `baseUrl getter returns value set by constructor` | `client.baseUrl === "https://api.example.com/"`. |

---

## 2. ApiClient — Header Management

| # | Test name | Description |
|---|-----------|-------------|
| 2.1 | `setHeader stores key/value in transientHeaders by default` | Call `setHeader("X-Foo", "bar")` — value is in transientHeaders, not persistentHeaders. |
| 2.2 | `setHeader with HeaderType.Transient stores in transientHeaders` | Explicit enum value — same as 2.1, confirming the enum path. |
| 2.3 | `setHeader with HeaderType.Persistent stores in persistentHeaders` | `setHeader("X-Foo", "bar", HeaderType.Persistent)` — value is in persistentHeaders. |
| 2.4 | `setHeader throws on invalid HeaderType` | Pass a numeric value that is neither Transient nor Persistent — expects `Error("Invalid header type")`. |
| 2.5 | `useBearerTokenProvider stores the provider` | Set a provider then confirm it is called when bearer token is requested. |
| 2.6 | `useBearerTokenByDefault sets flag` | Call `useBearerTokenByDefault(true)`, then call `buildRequestOptions({})` — `useBearerToken` is `true`. |

---

## 3. ApiClient — buildRequestOptions

| # | Test name | Description |
|---|-----------|-------------|
| 3.1 | `buildRequestOptions creates default options when none passed` | `useBearerToken=false`, `expectedDataResponseType=Json`, `skipJsonParsing` not set. |
| 3.2 | `buildRequestOptions inherits _defaultToUseBearerToken when useBearerToken not set` | Set default to `true`, call with `{}` — returned options have `useBearerToken=true`. |
| 3.3 | `buildRequestOptions does NOT override useBearerToken when explicitly set to false` | Pass `{ useBearerToken: false }` even with default=true — stays false. |
| 3.4 | `buildRequestOptions throws when expectedDataResponseType is Text` | Pass `{ expectedDataResponseType: EExpectedDataResponseType.Text }` — throws. |
| 3.5 | `buildRequestOptions throws when expectedDataResponseType is Blob` | Pass `{ expectedDataResponseType: EExpectedDataResponseType.Blob }` — throws. |
| 3.6 | `buildRequestOptions defaults expectedDataResponseType to Json when not set` | Confirm returned value equals `EExpectedDataResponseType.Json`. |
| 3.7 | `buildRequestOptions merges basicHeaders into requestHeaders without overwriting` | Pre-populate `basicHeaders`, provide `requestHeaders` with overlapping key — original value preserved. |
| 3.8 | `buildRequestOptions does not add basicHeaders when requestHeaders is not set` | No `requestHeaders` in options — basicHeaders are not injected at this stage. |

---

## 4. ApiClient — buildHeaders

| # | Test name | Description |
|---|-----------|-------------|
| 4.1 | `buildHeaders returns merged basicHeaders into result` | BasicHeaders `{A: "1"}` — returned headers contain `A: "1"`. |
| 4.2 | `buildHeaders appends bearer token when useBearerToken=true` | Provider returns `"tok123"` — `Authorization: Bearer tok123` present. |
| 4.3 | `buildHeaders throws when useBearerToken=true but no provider set` | No call to `useBearerTokenProvider` — throws `"Bearer token is not provided"`. |
| 4.4 | `buildHeaders throws when useBearerToken=true and provider returns falsy` | Provider returns `""` — throws `"Bearer token is not provided"`. |
| 4.5 | `buildHeaders does NOT override requestHeaders key with transientHeader` | requestHeaders has `X-Foo: "override"`, transientHeaders has `X-Foo: "transient"` — result keeps `"override"`. |
| 4.6 | `buildHeaders does NOT override requestHeaders key with persistentHeader` | Same scenario with persistentHeaders. |
| 4.7 | `buildHeaders clears transientHeaders after building` | Set a transientHeader, call `buildHeaders`, then call again — second call does not contain the header. |
| 4.8 | `buildHeaders does NOT clear persistentHeaders after building` | Set a persistentHeader, call twice — second call still includes it. |
| 4.9 | `buildHeaders applies headers in priority order: requestHeaders > bearer > transient > persistent` | Set all four with same key — confirm requestHeaders wins. |
| 4.10 | `buildHeaders merges bearerToken then transient over persistent` | requestHeaders empty, bearer header set, transientHeaders set before call — bearer wins over transient. |

---

## 5. ApiClient — get()

| # | Test name | Description |
|---|-----------|-------------|
| 5.1 | `get returns data parsed from JSON on 200 OK` | Mock fetch with `{ ok: true, text: () => '{"id":1}' }` — data is `{id:1}`. |
| 5.2 | `get returns undefined data when response body is empty string` | Mock `text()` returning `""` — data is `undefined`. |
| 5.3 | `get returns undefined data and response on non-OK status` | Mock `{ ok: false }` — data is `undefined`, response is the raw Response object. |
| 5.4 | `get skips JSON parsing when skipJsonParsing=true` | Mock fetch — `text()` should never be called; data is `undefined`. |
| 5.5 | `get calls fetch with method GET` | Spy on fetch — confirm `{ method: "GET" }`. |
| 5.6 | `get builds URL using buildUrl` | Confirm fetch is called with the correct composed URL. |
| 5.7 | `get passes correct headers from buildHeaders` | Confirm Authorization header present when bearer token configured. |

---

## 6. ApiClient — post()

| # | Test name | Description |
|---|-----------|-------------|
| 6.1 | `post sends body as JSON string` | Mock fetch spy — `body` argument equals `JSON.stringify(payload)`. |
| 6.2 | `post sends empty object JSON when body is null` | Pass `null` — body is `"{}"`. |
| 6.3 | `post sends empty object JSON when body is undefined` | Pass `undefined` — body is `"{}"`. |
| 6.4 | `post sets Content-Type application/json when not already set` | Confirm header present. |
| 6.5 | `post does NOT override existing Content-Type header` | Pre-set `Content-Type: text/plain` via setHeader — confirm it is preserved. |
| 6.6 | `post returns parsed JSON data on 200 OK` | Mock with JSON body — data is parsed correctly. |
| 6.7 | `post returns undefined data on non-OK response` | Mock 400 — data is `undefined`. |
| 6.8 | `post skips JSON parsing when skipJsonParsing=true` | text() not called. |
| 6.9 | `post calls fetch with method POST` | Spy confirms `{ method: "POST" }`. |

---

## 7. ApiClient — postFormData()

| # | Test name | Description |
|---|-----------|-------------|
| 7.1 | `postFormData sends FormData as body` | Mock spy — body is the FormData instance. |
| 7.2 | `postFormData calls fetch with method POST` | Confirm method POST. |
| 7.3 | `postFormData returns parsed JSON on OK response` | Data parsed correctly. |
| 7.4 | `postFormData returns undefined data on non-OK response` | Mock 400 — data is undefined. |
| 7.5 | `postFormData skips JSON parsing when skipJsonParsing=true` | text() not called. |

---

## 8. ApiClient — put()

| # | Test name | Description |
|---|-----------|-------------|
| 8.1 | `put sends body as JSON string` | Same as post 6.1 but method is PUT. |
| 8.2 | `put sends empty object when body is null/undefined` | body = `"{}"`. |
| 8.3 | `put sets Content-Type application/json` | Header confirmed. |
| 8.4 | `put does NOT override existing Content-Type` | Pre-set header preserved. |
| 8.5 | `put returns parsed JSON on OK` | Data parsed. |
| 8.6 | `put returns undefined data on non-OK` | Mock 404 — undefined. |
| 8.7 | `put skips JSON parsing when skipJsonParsing=true` | text() not called. |
| 8.8 | `put calls fetch with method PUT` | Confirmed. |

---

## 9. ApiClient — patch()

| # | Test name | Description |
|---|-----------|-------------|
| 9.1 | `patch sends body as JSON` | Confirmed. |
| 9.2 | `patch sends empty object when body is null/undefined` | `"{}"`. |
| 9.3 | `patch sets Content-Type` | Header present. |
| 9.4 | `patch does NOT override existing Content-Type` | Preserved. |
| 9.5 | `patch returns parsed data on OK` | Confirmed. |
| 9.6 | `patch returns undefined on non-OK` | Confirmed. |
| 9.7 | `patch skips JSON parsing` | Confirmed. |
| 9.8 | `patch calls fetch with method PATCH` | Confirmed. |

---

## 10. ApiClient — delete()

| # | Test name | Description |
|---|-----------|-------------|
| 10.1 | `delete calls fetch with method DELETE` | Confirmed. |
| 10.2 | `delete sets Content-Type when body is provided` | Body supplied — header is `application/json`. |
| 10.3 | `delete does NOT set Content-Type when body is absent` | No body — no Content-Type in headers. |
| 10.4 | `delete removes Content-Type when body is falsy even if previously set` | Explicit `delete headers["Content-Type"]` path — header absent. |
| 10.5 | `delete sends body as JSON when provided` | Spy confirms body is `JSON.stringify(body)`. |
| 10.6 | `delete sends no body when body is undefined` | `body` argument to fetch is `undefined`. |
| 10.7 | `delete always tries to parse response JSON regardless of ok status` | Unlike other methods, delete does NOT have an early `!response.ok` guard before parsing — data populated even on 4xx. |
| 10.8 | `delete returns parsed data on non-OK response (behaviour difference from other methods)` | Confirm data is parsed even for a 400. |
| 10.9 | `delete returns undefined data when body is empty` | Mock empty text — data is undefined. |
| 10.10 | `delete skips JSON parsing when skipJsonParsing=true` | text() not called. |

---

## 11. ApiClient — getRawIterable()

| # | Test name | Description |
|---|-----------|-------------|
| 11.1 | `getRawIterable yields Uint8Array chunks from readable stream` | Mock response with two chunks — both are yielded in order. |
| 11.2 | `getRawIterable stops after done=true from reader` | Verify loop terminates correctly. |
| 11.3 | `getRawIterable returns early when response is not OK` | Mock `ok: false` — generator returns without yielding. |
| 11.4 | `getRawIterable throws when response.body is null on OK response` | Mock `body: null, ok: true` — throws `"Response body is null"`. |
| 11.5 | `getRawIterable calls fetch with method GET` | Confirmed. |

---

## 12. ApiClient — postRawIterable()

| # | Test name | Description |
|---|-----------|-------------|
| 12.1 | `postRawIterable yields chunks on OK streamed response` | Two chunks yielded in order. |
| 12.2 | `postRawIterable throws when response.body is null (checked BEFORE ok check)` | Mock `body: null` regardless of status — throws immediately. |
| 12.3 | `postRawIterable returns early when response is not OK (after body check)` | Mock `body: readable, ok: false` — generator returns without yielding. |
| 12.4 | `postRawIterable sets Content-Type application/json` | Header confirmed. |
| 12.5 | `postRawIterable does NOT override existing Content-Type` | Pre-set header preserved. |
| 12.6 | `postRawIterable serialises body to JSON` | Spy confirms body is JSON string. |
| 12.7 | `postRawIterable calls fetch with method POST` | Confirmed. |

---

## 13. ApiClient — putRawIterable()

| # | Test name | Description |
|---|-----------|-------------|
| 13.1 | `putRawIterable yields chunks on OK response` | Confirmed. |
| 13.2 | `putRawIterable returns early when response.ok is false` | Confirmed. |
| 13.3 | `putRawIterable throws when response.body is null after ok check` | Mock `ok: true, body: null` — throws. |
| 13.4 | `putRawIterable sets Content-Type` | Confirmed. |
| 13.5 | `putRawIterable calls fetch with method PUT` | Confirmed. |

---

## 14. ApiClient — patchRawIterable()

| # | Test name | Description |
|---|-----------|-------------|
| 14.1 | `patchRawIterable yields chunks on OK response` | Confirmed. |
| 14.2 | `patchRawIterable returns early when response.ok is false` | Confirmed. |
| 14.3 | `patchRawIterable throws when response.body is null` | Confirmed. |
| 14.4 | `patchRawIterable sets Content-Type` | Confirmed. |
| 14.5 | `patchRawIterable calls fetch with method PATCH` | Confirmed. |

---

## 15. ApiClient — deleteRawIterable()

| # | Test name | Description |
|---|-----------|-------------|
| 15.1 | `deleteRawIterable yields chunks on OK response` | Confirmed. |
| 15.2 | `deleteRawIterable returns early when response.ok is false` | Confirmed. |
| 15.3 | `deleteRawIterable throws when response.body is null` | Confirmed. |
| 15.4 | `deleteRawIterable always sets Content-Type application/json` | Unlike delete(), the raw iterable always sets it — confirm. |
| 15.5 | `deleteRawIterable calls fetch with method DELETE` | Confirmed. |
| 15.6 | `deleteRawIterable sends no body` | fetch called without body argument. |

---

## 16. ApiClient — postFormDataRawIterable()

| # | Test name | Description |
|---|-----------|-------------|
| 16.1 | `postFormDataRawIterable yields chunks on OK response` | Two chunks — both yielded. |
| 16.2 | `postFormDataRawIterable returns early when response.ok is false` | Confirmed. |
| 16.3 | `postFormDataRawIterable throws when response.body is null (checked BEFORE ok check)` | body null — throws. |
| 16.4 | `postFormDataRawIterable deletes Content-Type header` | Confirm `headers["Content-Type"]` is absent in fetch call. |
| 16.5 | `postFormDataRawIterable does NOT override existing Content-Type even if previously set` | Deletes it unconditionally — confirm it is absent. |
| 16.6 | `postFormDataRawIterable calls fetch with method POST` | Confirmed. |
| 16.7 | `postFormDataRawIterable sends FormData as body` | Spy confirms body is a FormData instance. |

---

## 17. ApiClient — handleResponseChunk()

| # | Test name | Description |
|---|-----------|-------------|
| 17.1 | `handleResponseChunk parses JSON from line index 2 of chunk` | Chunk text has 3+ lines; line 2 starts with `data: {...}` — parsed object returned. |
| 17.2 | `handleResponseChunk strips everything before the first "{" on line 2` | Line 2 is `"data: {"id":1}"` — returns `{id:1}`. |
| 17.3 | `handleResponseChunk throws when decoded text is empty` | Empty Uint8Array decoded — throws `"Response body is null"`. |
| 17.4 | `handleResponseChunk throws when fewer than 3 lines` | Text has only 2 lines — throws `"Streamed response chunk is not valid."`. |
| 17.5 | `handleResponseChunk throws when line 2 is empty` | Lines[2] is `""` — throws `"Streamed response chunk is not valid."`. |
| 17.6 | `handleResponseChunk throws when JSON line contains no "{"` | Line 2 is `"data: no-json"` — json extraction returns empty string — throws. |
| 17.7 | `handleResponseChunk returns typed value from parsed JSON` | Generic `T` correctly inferred from the parsed object. |

---

## 18. ApiClient — High-level Iterables

| # | Test name | Description |
|---|-----------|-------------|
| 18.1 | `getIterable delegates to getRawIterable and applies handleResponseChunk` | Stub getRawIterable to yield one chunk — confirm parsed item yielded. |
| 18.2 | `postIterable delegates to postRawIterable and applies handleResponseChunk` | Same pattern for POST. |
| 18.3 | `postFormDataIterable delegates to postFormDataRawIterable and applies handleResponseChunk` | FormData variant. |
| 18.4 | `putIterable delegates to putRawIterable and applies handleResponseChunk` | PUT variant. |
| 18.5 | `patchIterable delegates to patchRawIterable and applies handleResponseChunk` | PATCH variant. |
| 18.6 | `deleteIterable delegates to deleteRawIterable and applies handleResponseChunk` | DELETE variant. |
| 18.7 | `getIterable propagates errors from handleResponseChunk` | Stub raw iterable with malformed chunk — error bubbles through generator. |

---

## 19. utils — cloneObject()

| # | Test name | Description |
|---|-----------|-------------|
| 19.1 | `cloneObject returns a different object reference` | `clone !== original`. |
| 19.2 | `cloneObject preserves the prototype chain` | `Object.getPrototypeOf(clone) === Object.getPrototypeOf(original)`. |
| 19.3 | `cloneObject copies own enumerable properties` | String, number, boolean, and object properties all copied. |
| 19.4 | `cloneObject shallow-copies nested objects (not deep clone)` | Nested object reference is the same in original and clone. |
| 19.5 | `cloneObject works with class instances` | Cloning an instance of a class that has methods — methods available via prototype. |

---

## 20. ConfigProvider — getUserApiConfigs()

| # | Test name | Description |
|---|-----------|-------------|
| 20.1 | `getUserApiConfigs returns null when file does not exist` | Mock `fs.access` to throw — returns `null`. |
| 20.2 | `getUserApiConfigs returns null when apis array is empty` | File present, JSON is `{ "apis": [] }` — returns `null`. |
| 20.3 | `getUserApiConfigs returns parsed api array on valid file` | File present with two api objects — returns array of length 2. |
| 20.4 | `getUserApiConfigs reads from process.cwd() + apx-rest-config.json` | Confirm file path construction uses `process.cwd()`. |
| 20.5 | `getUserApiConfigs caches result on second call (no second fs.readFile)` | Call twice — `fs.readFile` called only once. |
| 20.6 | `getUserApiConfigs handles malformed JSON gracefully (or throws)` | Malformed JSON causes an error — confirms error behaviour. |

---

## 21. ConfigProvider — getNumberOfUserConfigs()

| # | Test name | Description |
|---|-----------|-------------|
| 21.1 | `getNumberOfUserConfigs returns 0 when getUserApiConfigs returns null` | Confirmed. |
| 21.2 | `getNumberOfUserConfigs returns correct count from array` | 3-element array — returns 3. |

---

## 22. ConfigProvider — getValue()

| # | Test name | Description |
|---|-----------|-------------|
| 22.1 | `getValue returns value from user config when key exists in both` | User config takes precedence over default. |
| 22.2 | `getValue returns value from default config when key missing in user config` | Key only in defaultConfig — returned. |
| 22.3 | `getValue resolves nested key paths with dot notation` | `"outputBaseDirectory"` returned as `"src/clients"` from default. |
| 22.4 | `getValue throws when key not found in either config` | Key absent everywhere — throws `"Config key X not found."`. |
| 22.5 | `getValue uses correct apiIndex when multiple apis configured` | Set `apiIndex = 1` — returns value from second api entry. |
| 22.6 | `getValueFromConfig resolves deeply nested keys` | Key `"a.b.c"` — returns value at that path. |
| 22.7 | `getValueFromConfig throws when intermediate key is missing` | Key `"a.missing.c"` — throws. |

---

## 23. ConfigProvider — preload()

| # | Test name | Description |
|---|-----------|-------------|
| 23.1 | `preload calls getUserApiConfigs, getUserConfig, and getDefaultConfig` | All three internal methods invoked. |
| 23.2 | `preload completes without error on valid config file` | Happy path completes. |
| 23.3 | `getNumberOfUserConfigs returns 0 before preload if file not found` | Confirmed. |

---

## 24. Generator — Property class

### 24a. Computed getters

| # | Test name | Description |
|---|-----------|-------------|
| 24.1 | `referenceComponentName returns last segment of $ref path` | `$ref: "#/components/schemas/UserModel"` → `"UserModel"`. |
| 24.2 | `referenceComponentName returns undefined when $ref not set` | No `$ref` — `undefined`. |
| 24.3 | `isArray returns true when type is "array"` | `type: "array"` → `true`. |
| 24.4 | `isArray returns false for non-array types` | `type: "string"` → `false`. |
| 24.5 | `isDictionary returns true when type is "object" and additionalProperties present` | Confirmed. |
| 24.6 | `isDictionary returns false when type is "object" but no additionalProperties` | Confirmed. |
| 24.7 | `isDictionary returns false when type is not "object"` | Confirmed. |
| 24.8 | `isDate returns true for type "string" + format "date-time"` | Confirmed. |
| 24.9 | `isDate returns false for type "string" without format` | Confirmed. |
| 24.10 | `isDate returns false for non-string type with date-time format` | Confirmed. |
| 24.11 | `isNumberType returns true for type "number"` | Confirmed. |
| 24.12 | `isNumberType returns true for type "integer"` | Confirmed. |
| 24.13 | `isNumberType returns true for type "int32"` | Confirmed. |
| 24.14 | `isNumberType returns true for no type but format "int32"` | Confirmed. |
| 24.15 | `isNumberType returns true for format "int64"` | Confirmed. |
| 24.16 | `isNumberType returns true for format "float"` | Confirmed. |
| 24.17 | `isNumberType returns true for format "double"` | Confirmed. |
| 24.18 | `isNumberType returns false for type "string"` | Confirmed. |
| 24.19 | `isFormFile returns true for type "string" + format "binary"` | Confirmed. |
| 24.20 | `isFormFile returns true when referenceComponentName is "IFormFile"` | `$ref` ending in `IFormFile` — `true`. |
| 24.21 | `isFormFile returns false for other types` | `type: "boolean"` — `false`. |
| 24.22 | `lowerCamelName lowercases first character` | `name: "UserId"` → `"userId"`. |
| 24.23 | `lowerCamelName leaves already-lowercase names unchanged` | `name: "name"` → `"name"`. |
| 24.24 | `renderName returns lowerCamelName when isFormField=true` | `name: "FileName", isFormField: true` → `"fileName"`. |
| 24.25 | `renderName returns name when isFormField=false` | `name: "FileName", isFormField: false` → `"FileName"`. |

### 24b. formattedDtoType

| # | Test name | Description |
|---|-----------|-------------|
| 24.26 | `formattedDtoType returns enum array type for array of enum refs` | items.$ref = SomeEnum, referenceIsEnum=true → `"SomeEnum[]"`. |
| 24.27 | `formattedDtoType returns "File[]" for array of form files` | isArray + isFormFile → `"File[]"`. |
| 24.28 | `formattedDtoType returns "File" for single form file` | Confirmed. |
| 24.29 | `formattedDtoType returns plain enum name for single enum ref` | referenceIsEnum=true, $ref=Status → `"Status"`. |
| 24.30 | `formattedDtoType returns TXxxDto for a non-enum $ref` | `$ref: "#/...../UserResponse"` → `"TUserResponseDto"`. |
| 24.31 | `formattedDtoType returns TXxxDto array for array of non-enum $refs` | `type: "array", items.$ref=UserModel` → `"TUserModelDto[]"`. |
| 24.32 | `formattedDtoType returns "number" for any numeric type` | isNumberType → `"number"`. |
| 24.33 | `formattedDtoType returns array of primitive dto type` | `type: "array", items.type: "string"` → `"string[]"`. |
| 24.34 | `formattedDtoType returns Record type for dictionary` | `isDictionary=true, additionalProperties.type: "string"` → `"Record<string, string>"`. |
| 24.35 | `formattedDtoType returns Record<string, any> for dictionary with no additionalProperties type` | `"Record<string, any>"`. |
| 24.36 | `formattedDtoType returns raw type for plain scalars` | `type: "boolean"` → `"boolean"`. |

### 24c. formattedType

| # | Test name | Description |
|---|-----------|-------------|
| 24.37 | `formattedType returns "Date" for date-time string` | Confirmed. |
| 24.38 | `formattedType returns "number" for integer/float/etc.` | Confirmed. |
| 24.39 | `formattedType returns "File[]" for array of binary form files` | Confirmed. |
| 24.40 | `formattedType returns "File" for single binary file` | Confirmed. |
| 24.41 | `formattedType returns enum array type for enum array ref` | Confirmed. |
| 24.42 | `formattedType returns plain enum name for enum $ref` | Confirmed. |
| 24.43 | `formattedType returns plain reference name for non-enum $ref (no T prefix)` | `$ref=UserModel` → `"UserModel"` (not `"TUserModelDto"`). |
| 24.44 | `formattedType returns XxxArray ref for array of references` | `type:array, items.$ref=UserModel` → `"UserModel[]"`. |
| 24.45 | `formattedType returns primitive array for array of scalars` | `items.type: "boolean"` → `"boolean[]"`. |
| 24.46 | `formattedType returns Map type for dictionary` | `isDictionary=true` → `"Map<string, ...>"`. |
| 24.47 | `formattedType returns raw type for plain scalar` | `type: "string"` → `"string"`. |

### 24d. render() and renderAsDto()

| # | Test name | Description |
|---|-----------|-------------|
| 24.48 | `render produces nullable field with "?" when nullable=true` | Output contains `name?:`. |
| 24.49 | `render produces non-nullable field without "?" when nullable=false` | Output contains `name:`. |
| 24.50 | `render adds "T" prefix for request component reference when isRequest=true` | Confirmed via `requestComponents` mock. |
| 24.51 | `render does NOT add "T" prefix when isRequest=false` | Default false — no prefix. |
| 24.52 | `render adds "T" prefix for array items in request mode` | `isArray=true, items.referenceComponentName` set, isRequest=true — prefix added. |
| 24.53 | `renderAsDto uses formattedDtoType` | Confirmed. |
| 24.54 | `renderAsDto produces nullable field with "?" when nullable=true` | Confirmed. |

---

## 25. Generator — EnumComponent class

| # | Test name | Description |
|---|-----------|-------------|
| 25.1 | `capitalizedName uppercases the first character` | `name: "status"` → `"Status"`. |
| 25.2 | `capitalizedName preserves name when already capitalized` | `name: "Status"` → `"Status"`. |
| 25.3 | `getEnumName returns enumNames[index] when enumNames provided` | `enumNames: ["Active"]`, index 0 → `"Active"`. |
| 25.4 | `getEnumName falls back to values[index] when enumNames is undefined` | No enumNames, index 0 → `values[0]`. |
| 25.5 | `getEnumName falls back to values[index] when enumNames does not have the index` | enumNames shorter than values — confirmed. |
| 25.6 | `formatValue wraps string values in double quotes` | `type: "string"`, value `"active"` → `'"active"'`. |
| 25.7 | `formatValue returns raw integer value without quotes` | `type: "integer"`, value `"1"` → `"1"`. |
| 25.8 | `formatValue returns raw number without quotes for type "number"` | Confirmed. |
| 25.9 | `formatValue returns raw number for type "int32"` | Confirmed. |
| 25.10 | `formatValue returns raw number for type "int64"` | Confirmed. |
| 25.11 | `render produces valid TypeScript enum declaration` | Minimum: `export enum Status {\n\tActive = "active"\n}`. |
| 25.12 | `render uses enumNames as member names when provided` | Custom enum names appear as identifiers. |
| 25.13 | `render uses values as member names when enumNames not provided` | Raw values used as identifiers. |
| 25.14 | `render produces integer enum with unquoted values` | Integer type — values without quotes. |
| 25.15 | `render produces multi-value enum separated by commas` | Three values — two commas in output. |

---

## 26. Generator — Component (base) class

| # | Test name | Description |
|---|-----------|-------------|
| 26.1 | `capitalizedName uppercases first character` | `name: "userResponse"` → `"UserResponse"`. |
| 26.2 | `dtoName returns "T{CapitalizedName}Dto"` | `name: "UserResponse"` → `"TUserResponseDto"`. |
| 26.3 | `constructor creates Property instances from dto.properties` | Input is plain TPropertyDto objects — output properties are Property instances. |
| 26.4 | `renderDto produces TypeScript type with all property types` | All properties in DTO type body. |
| 26.5 | `renderDto wraps output in "export type T{Name}Dto = { ... };"` | Correct type declaration. |
| 26.6 | `render includes renderDto output followed by class declaration` | Both DTO type and class present. |
| 26.7 | `render class constructor assigns plain scalar properties via dto` | `this.name = dto.name` in output. |
| 26.8 | `render class constructor wraps date properties with "new Date()"` | `this.createdAt = new Date(dto.createdAt)` in output. |
| 26.9 | `render class constructor wraps nullable date with conditional new Date()` | `this.d = dto.d ? new Date(dto.d) : undefined` in output. |
| 26.10 | `render class constructor wraps non-enum $ref properties with "new Ref()"` | `this.user = new User(dto.user)` in output. |
| 26.11 | `render class constructor wraps nullable non-enum $ref with conditional new` | `this.user = dto.user ? new User(dto.user) : undefined` in output. |
| 26.12 | `render class constructor maps array of non-enum objects with .map()` | `dto.items.map((item) => new Item(item))` in output. |
| 26.13 | `render class constructor maps nullable array with optional chaining` | `dto.items?.map(...)` in output. |
| 26.14 | `render class constructor handles dictionary of objects` | `new Map(Object.entries(dto.x).map(...new Type(value)...))` in output. |
| 26.15 | `render class constructor handles dictionary of arrays of objects` | Nested `.map()` inside the Map constructor. |
| 26.16 | `render class constructor handles dictionary of primitives` | Simple `[key, value]` mapping. |
| 26.17 | `render class constructor handles dictionary of arrays of primitives` | `[key, value.map(item => item)]` in output. |
| 26.18 | `renderImplementsDto returns dtoName when no date properties` | Simple case — just the dto type name. |
| 26.19 | `renderImplementsDto returns Omit<dtoName, "dateField"> when date property exists` | Correct Omit string. |
| 26.20 | `renderImplementsDto omits multiple date fields joined by " | "` | Two date fields — both listed in Omit. |

---

## 27. Generator — RequestComponent class

| # | Test name | Description |
|---|-----------|-------------|
| 27.1 | `dtoName returns "T{CapitalizedName}" (no "Dto" suffix)` | `name: "CreateUser"` → `"TCreateUser"`. |
| 27.2 | `render produces TypeScript type (not class + dto pair)` | Output starts with `export type T{Name} = {` and no `export class`. |
| 27.3 | `render includes all properties using render(true) (isRequest mode)` | T-prefix applied to nested request references. |
| 27.4 | `render ends with "};"`  | Closing brace and semicolon present. |

---

## 28. Generator — ResponseComponent class

| # | Test name | Description |
|---|-----------|-------------|
| 28.1 | `isUnionType returns false when name not in responsesMarkedAsUnions` | Default — false. |
| 28.2 | `isUnionType returns true when name is in responsesMarkedAsUnions` | After adding to the set — true. |
| 28.3 | `renderAdditionalMethods returns null for non-union type` | Confirmed. |
| 28.4 | `renderAdditionalMethods returns switch() method code for union type` | Output contains `public switch(`. |
| 28.5 | `renderAdditionalMethods switch() handles all properties in if-chain` | One if per property. |
| 28.6 | `renderAdditionalMethods switch() throws at end if no match` | `throw new Error("No matching type in union")` in output. |
| 28.7 | `renderAdditionalMethods returns match() method code for union type` | Output contains `public match<TResult>(`. |
| 28.8 | `renderAdditionalMethods match() returns the matched value` | `return propName(this.propName)` in output. |
| 28.9 | `renderAdditionalMethods match() throws at end if no match` | Confirmed. |
| 28.10 | `render (inherited) includes both switch() and match() when union type` | Both methods present in rendered output. |

---

## 29. Generator — ModelComponent class

| # | Test name | Description |
|---|-----------|-------------|
| 29.1 | `ModelComponent inherits Component.render() directly` | ModelComponent has no override — rendering falls through to base. |
| 29.2 | `ModelComponent renders dto type + class pair` | Both DTO type and class in output. |

---

## 30. Generator — ApiPath class (properties & derived state)

| # | Test name | Description |
|---|-----------|-------------|
| 30.1 | `constructor strips leading slash from endpoint` | `"/api/users"` → `"api/users"`. |
| 30.2 | `constructor keeps endpoint without leading slash unchanged` | `"api/users"` stays as-is. |
| 30.3 | `hasParameters returns false when parameters is empty` | Empty array — false. |
| 30.4 | `hasParameters returns true when parameters present` | One parameter — true. |
| 30.5 | `queryParams filters parameters with in="query"` | Mix of path and query — only query returned. |
| 30.6 | `hasQueryParams returns false when no query params` | Confirmed. |
| 30.7 | `hasQueryParams returns true when query params present` | Confirmed. |
| 30.8 | `pathParams extracts {param} placeholders from endpoint` | `"users/{userId}/posts/{postId}"` → `["userId", "postId"]`. |
| 30.9 | `pathParams returns empty array when no placeholders` | `"users"` → `[]`. |
| 30.10 | `hasPathParams returns false when no path params` | Confirmed. |
| 30.11 | `hasPathParams returns true when path params present` | Confirmed. |
| 30.12 | `builtEndpointUrl replaces {param} with template literal syntax` | `"users/{id}"` → `` "users/${request.id}" ``. |
| 30.13 | `builtEndpointUrl handles multiple path params` | Two params — both substituted. |
| 30.14 | `builtEndpointUrl leaves endpoint unchanged when no path params` | `"users"` stays `"users"`. |
| 30.15 | `shouldSkipRequest returns true when no requestComponent but has path params` | Only path params — skip. |
| 30.16 | `shouldSkipRequest returns false when no request and no path params` | Neither — false. |
| 30.17 | `shouldSkipRequest returns true when all requestComponent properties are path params` | Request has `{id}` only — skip. |
| 30.18 | `shouldSkipRequest returns false when requestComponent has non-path-param properties` | Request has extra fields — do not skip. |
| 30.19 | `requestStr returns "" for GET method` | No request body string for GET. |
| 30.20 | `requestStr returns ", undefined" when no requestComponent and method is POST` | Confirmed. |
| 30.21 | `requestStr returns ", formData" when isFormEndpoint` | Confirmed. |
| 30.22 | `requestStr returns ", undefined" when shouldSkipRequest` | Confirmed. |
| 30.23 | `requestStr returns ", request" for POST with a request component that should not be skipped` | Confirmed. |

---

## 31. Generator — ApiPath.render() dispatch logic

| # | Test name | Description |
|---|-----------|-------------|
| 31.1 | `render dispatches to renderRequestAndResponse when hasRequest && responseComponent` | Confirm the right private method is invoked. |
| 31.2 | `render dispatches to renderRequestAndStreamedResponse when hasRequest && responseComponent && isStreamed` | Confirmed. |
| 31.3 | `render dispatches to renderRequestOnly when hasRequest && no responseComponent` | Confirmed. |
| 31.4 | `render dispatches to renderResponseOnly when no request && responseComponent` | Confirmed. |
| 31.5 | `render dispatches to renderNoRequestNoResponse when no request && no response` | Confirmed. |
| 31.6 | `render builds inline path param type when hasPathParams and requestDtoName is "any"` | `{ id: string }` used. |
| 31.7 | `render builds intersection type when hasPathParams and requestDtoName is not "any"` | `{ id: string } & TCreateRequest` in signature. |
| 31.8 | `render builds inline query param type when hasQueryParams and requestDtoName is "any"` | `{ page: number }` used. |
| 31.9 | `render builds intersection with query params appended` | Confirmed. |
| 31.10 | `render maps query param type "integer" to "number"` | Confirmed. |
| 31.11 | `render maps query param format "date-time" to "string"` | Confirmed. |
| 31.12 | `render maps query param type "array" to "itemType[]"` | Confirmed. |
| 31.13 | `render marks optional query params with "?"` | `required: false` → `name?: type`. |
| 31.14 | `render marks required query params without "?"` | `required: true` → `name: type`. |
| 31.15 | `render sets clientFunctionName to "postFormData" for form endpoints` | `method: "post", isFormEndpoint: true` → function name includes "postFormData". |

---

## 32. Generator — ApiPath.clientMethodName

| # | Test name | Description |
|---|-----------|-------------|
| 32.1 | `clientMethodName uses operationId (lowercased first char) when present` | `operationId: "CreateUser"` → `"createUser"`. |
| 32.2 | `clientMethodName strips URL chars from operationId` | `operationId: "create-user"` → `"createUser"`. |
| 32.3 | `clientMethodName adds "Stream" suffix when isStreamed=true` | `"createUserStream"`. |
| 32.4 | `clientMethodName adds "*" prefix when isStreamed=true` | `"*createUser"` in rendered output. |
| 32.5 | `clientMethodName uses responseComponent name for GET without operationId` | ResponseComponent named `"UserListResponse"` → `"userList"`. |
| 32.6 | `clientMethodName falls back to "get{Resource}" for GET with no operationId and no responseComponent` | `"getApiUsers"`. |
| 32.7 | `clientMethodName uses requestComponent name for POST without operationId` | RequestComponent named `"CreateUserRequest"` → `"createUser"`. |
| 32.8 | `clientMethodName falls back to "create{Resource}" for POST with no operationId and no requestComponent` | Confirmed. |
| 32.9 | `clientMethodName uses requestComponent name for PUT without operationId` | Falls through to `replace` prefix if no request component. |
| 32.10 | `clientMethodName uses requestComponent name for DELETE without operationId` | Falls through to `delete` prefix. |
| 32.11 | `clientMethodName uses requestComponent name for PATCH without operationId` | Falls through to `update` prefix. |
| 32.12 | `clientMethodName throws for unknown method` | `method: "OPTIONS"` → throws `"Unknown method: OPTIONS"`. |

---

## 33. Generator — ApiPath rendered method bodies

### renderRequestAndResponse

| # | Test name | Description |
|---|-----------|-------------|
| 33.1 | `renderRequestAndResponse signature includes request parameter and correct return type` | `Promise<TApiClientResult<ResponseType>>`. |
| 33.2 | `renderRequestAndResponse calls correct HTTP client function` | `this.post<TDto>(...)` for POST. |
| 33.3 | `renderRequestAndResponse returns [null, response] when !ok` | Guard present. |
| 33.4 | `renderRequestAndResponse returns [new ResponseType(data), response] on success` | Correct instantiation. |
| 33.5 | `renderRequestAndResponse adds URLSearchParams block when hasQueryParams` | `new URLSearchParams()` in output. |
| 33.6 | `renderRequestAndResponse appends "?${queryParams}" to URL when hasQueryParams` | URL template includes query string. |
| 33.7 | `renderRequestAndResponse adds FormData block when isFormEndpoint` | `new FormData()` and append calls in output. |
| 33.8 | `renderRequestAndResponse removes empty lines from output` | No consecutive blank lines. |

### renderRequestOnly

| # | Test name | Description |
|---|-----------|-------------|
| 33.9 | `renderRequestOnly return type is Promise<TApiClientResult<null>>` | Confirmed. |
| 33.10 | `renderRequestOnly returns [null, response]` | Confirmed. |
| 33.11 | `renderRequestOnly adds query params block when hasQueryParams` | Confirmed. |
| 33.12 | `renderRequestOnly adds FormData block when isFormEndpoint` | Confirmed. |

### renderResponseOnly

| # | Test name | Description |
|---|-----------|-------------|
| 33.13 | `renderResponseOnly signature has no request parameter` | Function signature only has options. |
| 33.14 | `renderResponseOnly adds bodyVar "undefined, " for non-GET methods` | POST/PUT/etc. pass `undefined` body. |
| 33.15 | `renderResponseOnly adds NO bodyVar for GET method` | No body argument. |
| 33.16 | `renderResponseOnly returns [null, response] when !ok` | Guard present. |
| 33.17 | `renderResponseOnly returns [new Response(data), response] on success` | Confirmed. |

### renderNoRequestNoResponse

| # | Test name | Description |
|---|-----------|-------------|
| 33.18 | `renderNoRequestNoResponse has no request parameter in signature` | Only options. |
| 33.19 | `renderNoRequestNoResponse uses "undefined, " body for non-GET methods` | Confirmed. |
| 33.20 | `renderNoRequestNoResponse returns [null, response]` | Confirmed. |

### renderRequestAndStreamedResponse

| # | Test name | Description |
|---|-----------|-------------|
| 33.21 | `renderRequestAndStreamedResponse produces async generator function with "*" prefix` | `async *methodName(...)`. |
| 33.22 | `renderRequestAndStreamedResponse yields new ResponseType(chunkDto) for each chunk` | `yield new X(chunkDto)` in output. |
| 33.23 | `renderRequestAndStreamedResponse adds FormData block when isFormEndpoint` | `new FormData()` and appends. |
| 33.24 | `renderRequestAndStreamedResponse uses postFormDataIterable for form endpoints` | Function name includes `postFormDataIterable`. |

---

## 34. Generator — stripUrlChars / splitAtUrlChars helpers

| # | Test name | Description |
|---|-----------|-------------|
| 34.1 | `splitAtUrlChars splits on "/"` | `"/api/users"` → `["", "api", "users"]`. |
| 34.2 | `splitAtUrlChars splits on "-"` | `"create-user"` → `["create", "user"]`. |
| 34.3 | `splitAtUrlChars splits on "_"` | `"create_user"` → `["create", "user"]`. |
| 34.4 | `splitAtUrlChars splits on "{"` | `"{userId}"` → `["", "userId", ""]`. |
| 34.5 | `splitAtUrlChars does not split on alphanumeric characters` | `"createUser"` → `["createUser"]`. |
| 34.6 | `stripUrlChars capitalizes first char of each segment` | `"api/users/list"` → `"ApiUsersList"`. |
| 34.7 | `stripUrlChars handles leading slash (empty first segment)` | `"/api/users"` → `"ApiUsers"` (empty segment becomes empty string, then uppercased → still empty). |
| 34.8 | `stripUrlChars handles dashes` | `"create-user-request"` → `"CreateUserRequest"`. |
| 34.9 | `stripUrlChars handles path params in curly braces` | `"users/{userId}"` → `"UsersUserId"`. |

---

## 35. Generator — generateApi() full flow

These are integration-style unit tests that mock `fetch` (for the OpenAPI document) and `fs` (for file writing).

| # | Test name | Description |
|---|-----------|-------------|
| 35.1 | `generateApi logs error and returns when OpenAPI fetch fails` | Mock fetch returning `ok: false` — logs error, does not write file. |
| 35.2 | `generateApi skips IFormFile component (does not add to modelComponents)` | Document with only IFormFile schema — no model output. |
| 35.3 | `generateApi classifies enum schemas correctly` | Schema with `enum` array — added to enumComponents, not modelComponents. |
| 35.4 | `generateApi classifies request schemas correctly` | Schema referenced from requestBody — added to requestComponents. |
| 35.5 | `generateApi classifies response schemas correctly` | Schema referenced from responses — added to responseComponents. |
| 35.6 | `generateApi classifies all remaining schemas as models` | Schema not referenced as request or response — added to modelComponents. |
| 35.7 | `generateApi adds schema to responsesMarkedAsUnions when x-union-response set` | Confirmed. |
| 35.8 | `generateApi handles multipart/form-data without $ref (inline schema)` | Generates synthetic FormData request type using operationId. |
| 35.9 | `generateApi handles multipart/form-data with $ref` | Maps operationId to the $ref name in endpointToFormRequestNameMap. |
| 35.10 | `generateApi includes file header comment in output` | `AUTO-GENERATED FILE` comment present in written file. |
| 35.11 | `generateApi includes eslint-disable comment in output` | `/* eslint-disable */` present. |
| 35.12 | `generateApi includes import statement from "apx.rest"` | `import { ApiClient ... } from "apx.rest"` in output. |
| 35.13 | `generateApi renders all requestComponents in output` | Each request type present. |
| 35.14 | `generateApi renders all responseComponents in output` | Each response type and class present. |
| 35.15 | `generateApi renders all enumComponents in output` | Each enum present. |
| 35.16 | `generateApi renders all modelComponents in output` | Each model type and class present. |
| 35.17 | `generateApi renders the client class extending ApiClient` | `export class MyClient extends ApiClient` in output. |
| 35.18 | `generateApi renders client constructor with super(baseUrl)` | Literal URL wrapped in quotes, env var without. |
| 35.19 | `generateApi wraps string baseUrl in quotes` | `clientBaseUrlValue: "https://api.example.com"` → `super("https://api.example.com")`. |
| 35.20 | `generateApi does NOT wrap non-http baseUrl in quotes (env var)` | `clientBaseUrlValue: "import.meta.env.VITE_API_URL"` → `super(import.meta.env.VITE_API_URL)`. |
| 35.21 | `generateApi writes output file to configured outputBaseDirectory` | `fs.writeFile` called with correct path. |
| 35.22 | `generateApi creates output directory recursively` | `fs.mkdir` called with `{ recursive: true }`. |
| 35.23 | `generateApi output filename is "{clientName}.ts"` | Confirmed. |
| 35.24 | `generateApi marks streamed endpoints via streamedEndpoints config` | Endpoint in list → ApiPath.isStreamed = true → generator method rendered. |
| 35.25 | `generateApi handles paths with no components section (empty document)` | No components — no types rendered, only client class. |
| 35.26 | `generateApi handles endpoint with no requestBody` | No request — method renders without request parameter. |
| 35.27 | `generateApi handles endpoint with no 200 response body` | content is null — no response dto. |
| 35.28 | `generateApi handles path parameters in endpoint URL` | `{id}` in path — rendered as template literal. |
| 35.29 | `generateApi handles query parameters` | Operation.parameters with `in: "query"` — URLSearchParams added to method. |
| 35.30 | `generateApi uses operationId as method name when present` | Confirmed. |
| 35.31 | `generateApi clears all module-level maps between API generations` | Second `generateApi` call starts with empty maps. |

---

## 36. Generator — multi-API config loop

| # | Test name | Description |
|---|-----------|-------------|
| 36.1 | `generate calls generateApi once per API in config` | 3 APIs in config — `generateApi` called 3 times. |
| 36.2 | `generate sets apiIndex correctly for each iteration` | First call: `apiIndex=0`, second: `apiIndex=1`, etc. |
| 36.3 | `generate clears module-level state between API generations` | After first run, maps are cleared before second run. |
| 36.4 | `generate does nothing when no configs found (numConfigs = 0)` | `generateApi` never called. |

---

*Total tests: ~230*
