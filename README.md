# apx.rest

[![npm](https://img.shields.io/npm/v/apx.rest)](https://www.npmjs.com/package/apx.rest)
[![CI](https://github.com/Apophix/apx.rest/actions/workflows/ci.yml/badge.svg)](https://github.com/Apophix/apx.rest/actions/workflows/ci.yml)

A powerful TypeScript code generation tool for REST APIs that generates type-safe HTTP clients from OpenAPI specifications.

## 🚀 Features

- **Type-Safe API Clients**: Generate fully typed API clients from OpenAPI/Swagger specs
- **Zero Configuration**: Works out of the box with sensible defaults
- **Multiple API Support**: Generate clients for multiple APIs in one project
- **Stream Support**: Built-in support for streaming endpoints
- **Endpoint Filtering**: Include or exclude endpoints with path patterns
- **Modern TypeScript**: Uses latest TypeScript features and best practices
- **Full HTTP Methods**: Support for GET, POST, PUT, PATCH, DELETE operations
- **Request/Response Models**: Auto-generates DTOs and response classes
- **Enum Support**: Proper enum generation from OpenAPI specifications
- **Path Parameters**: Full support for parameterized endpoints
- **Query Parameters**: Type-safe query parameter handling

## 📦 Installation

```bash
npm install apx.rest
```

## 🛠️ Usage

### 1. Create Configuration File

Create an `apx-rest-config.json` file in your project root:

```json
{
  "apis": [
    {
      "openApiJsonDocumentUrl": "https://api.example.com/swagger.json",
      "clientName": "MyApiClient",
      "clientBaseUrlValue": "https://api.example.com",
      "outputBaseDirectory": "./src/clients",
      "streamedEndpoints": ["/api/stream"]
    }
  ]
}
```

### 2. Generate API Client

Run the code generator:

```bash
npx apx-gen
```

This will generate a TypeScript client file at `./src/clients/MyApiClient.ts`.

### 3. Use Generated Client

```typescript
import { MyApiClient } from './clients/MyApiClient';

const client = new MyApiClient();

// Type-safe API calls
const [user, response] = await client.getUserById({ id: '123' });
if (user) {
  console.log(user.name); // Fully typed!
}

// Handle streaming endpoints
for await (const data of client.getDataStream()) {
  console.log(data);
}
```

### 4. Next.js Configuration (Required)

> I know almost nothing about the node/npm package ecosystem, so if someone knows why this is necessary please let me know.
> I'm also unsure if this is still needed after the most recent updates to this package, I don't work much with Next.js anymore. 

For Next.js projects, you need to add `apx.rest` to the `transpilePackages` array in your `next.config.js` to ensure the package is properly transpiled:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['apx.rest'],
  // ... other config options
};

module.exports = nextConfig;
```

Or if using `next.config.mjs`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['apx.rest'],
  // ... other config options
};

export default nextConfig;
```

This ensures that the TypeScript package is properly compiled for your Next.js application. If you are not using Next.js, ignore this step.


## 📋 Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `openApiJsonDocumentUrl` | string | URL to your OpenAPI/Swagger JSON document, or a file path (absolute or relative) to a local JSON file |
| `clientName` | string | Name of the generated client class |
| `clientBaseUrlValue` | string | Base URL for API requests |
| `outputBaseDirectory` | string | Directory where client will be generated |
| `streamedEndpoints` | string[] | List of endpoints that return streaming data |
| `includeEndpoints` | string[] | Path patterns of endpoints to generate. When empty or omitted, all endpoints are generated. Default: `[]`. See [Filtering Endpoints](#-filtering-endpoints). |
| `excludeEndpoints` | string[] | Path patterns of endpoints to skip. An exclude match always wins over an include match. Default: `[]`. See [Filtering Endpoints](#-filtering-endpoints). |
| `ignoreTlsErrors` | boolean | Disable TLS certificate validation when fetching the OpenAPI document. Default: `false`. Only enable for local dev with self-signed certs — not recommended if generating from a third-party source. |

### Multiple APIs Example

```json
{
  "apis": [
    {
      "openApiJsonDocumentUrl": "https://api1.example.com/swagger.json",
      "clientName": "UserApiClient",
      "clientBaseUrlValue": "https://api1.example.com",
      "outputBaseDirectory": "./src/clients"
    },
    {
      "openApiJsonDocumentUrl": "https://api2.example.com/swagger.json",
      "clientName": "PaymentApiClient", 
      "clientBaseUrlValue": "https://api2.example.com",
      "outputBaseDirectory": "./src/clients"
    }
  ]
}
```

## 🔍 Filtering Endpoints

Use `includeEndpoints` and `excludeEndpoints` to generate client methods for only part of an API. Each option is a list of path patterns. The generator compares each pattern with the path keys in the `paths` section of the OpenAPI document, for example `/users/{id}`.

```json
{
  "apis": [
    {
      "openApiJsonDocumentUrl": "https://api.example.com/swagger.json",
      "clientName": "PublicApiClient",
      "clientBaseUrlValue": "https://api.example.com",
      "includeEndpoints": ["/api/v1/**"],
      "excludeEndpoints": ["/api/v1/admin/**", "/api/v1/**/internal"]
    }
  ]
}
```

This config generates methods for all endpoints under `/api/v1`. It skips the endpoints under `/api/v1/admin` and every path under `/api/v1` that ends in `/internal`.

### How the Filter Decides

The generator applies these rules to each endpoint path:

1. If the path matches an `excludeEndpoints` pattern, the generator skips it.
2. Else, if `includeEndpoints` is empty or omitted, the generator keeps it.
3. Else, the generator keeps the path only if it matches an `includeEndpoints` pattern.

An exclude match always wins. If you omit both options, the generator keeps all endpoints, as in earlier versions.

The filter works on paths, not on HTTP methods. When a path matches, the generator keeps or skips all of its methods (GET, POST, and so on) together.

### Pattern Syntax

Patterns are globs. A glob is a text pattern with wildcard characters.

| Syntax | Matches | Example pattern | Matches | Does not match |
|--------|---------|-----------------|---------|----------------|
| text | The same text. Matching is case-sensitive. | `/health` | `/health` | `/Health`, `/healthz` |
| `*` | Zero or more characters in one path segment. It never matches `/`. | `/users/*` | `/users/{id}` | `/users`, `/users/{id}/orders` |
| `?` | Exactly one character in one path segment. It never matches `/`. | `/api/v?/users` | `/api/v1/users` | `/api/v10/users` |
| `**` | Zero or more full path segments. It must be a full segment, between slashes or at an end. | `/admin/**` | `/admin`, `/admin/users/{id}` | `/administrator` |

More rules:

- A path segment is the text between two `/` characters.
- All other characters match only themselves. This includes `.`, `+`, `(`, `)`, `[`, `]`, and the `{` `}` braces of path parameters. For example, `/users/{id}` does not match `/users/{userId}`.
- Use `*` to match any path parameter name. For example, `/users/*/orders` matches `/users/{id}/orders` and `/users/{userId}/orders`.
- `**` inside a segment, such as `v**`, works the same as `*`. It does not cross a `/`.
- The generator ignores a missing leading `/` and any trailing `/`. The patterns `users`, `/users`, and `/users/` are equal.
- The pattern `/` matches only the root path. The pattern `/**` matches all paths.

### Common Examples

| Goal | Config |
|------|--------|
| Generate only one area of the API | `"includeEndpoints": ["/orders/**"]` |
| Generate two areas | `"includeEndpoints": ["/orders/**", "/customers/**"]` |
| Skip admin endpoints | `"excludeEndpoints": ["/admin/**"]` |
| Skip health checks at any depth | `"excludeEndpoints": ["/**/health"]` |
| Generate one version but skip a sub-area | `"includeEndpoints": ["/api/v2/**"], "excludeEndpoints": ["/api/v2/beta/**"]` |
| Generate only top-level collections | `"includeEndpoints": ["/*"]` |
| Skip one exact path | `"excludeEndpoints": ["/users/{id}/avatar"]` |

### Split One API into Several Clients

Each entry in `apis` has its own filter. You can generate separate clients from one document:

```json
{
  "apis": [
    {
      "openApiJsonDocumentUrl": "https://api.example.com/swagger.json",
      "clientName": "UsersClient",
      "clientBaseUrlValue": "https://api.example.com",
      "includeEndpoints": ["/users/**"]
    },
    {
      "openApiJsonDocumentUrl": "https://api.example.com/swagger.json",
      "clientName": "OrdersClient",
      "clientBaseUrlValue": "https://api.example.com",
      "includeEndpoints": ["/orders/**"]
    }
  ]
}
```

### Effect on Generated Types

The filter removes client methods. It does not remove schemas from `components.schemas`:

- The generator still emits every component schema as a type or class, also schemas that only skipped endpoints use. This keeps types that other code imports stable when you change the filter.
- A schema keeps the same kind of output (request type, response class, or model class) as without the filter.
- Exception: inline `multipart/form-data` request types (the `...FormDataRequest` types) belong to one endpoint. The generator does not emit them for skipped endpoints.

### Filter Interaction with `streamedEndpoints`

The generator applies the filter first. It then applies `streamedEndpoints` to the endpoints that remain. A path in `streamedEndpoints` that the filter skips has no effect.

### Logs and Errors

When a filter is set, the generator logs how many endpoint paths it keeps, for example `Endpoint filter: generating 12 of 40 endpoint paths.` It also logs each skipped path.

The generator logs a warning in these cases:

- A pattern matches no endpoint. This is often a typo, for example `/user/**` instead of `/users/**`.
- The filter skips all endpoints. The generator still writes the client, but the class has no methods.

The generator stops with an error before it reads the OpenAPI document in these cases:

- `includeEndpoints` or `excludeEndpoints` is not an array, for example `"includeEndpoints": "/users/**"`.
- An entry is not a string, or is an empty string.

## 🏗️ Generated Code Structure

The generator creates:

- **Request DTOs**: Type definitions for API request payloads
- **Response DTOs**: Type definitions for API responses  
- **Model Classes**: Full classes with constructors for complex objects
- **Enum Types**: Proper TypeScript enums from OpenAPI specs
- **API Client**: Main client class with all endpoint methods

### Example Generated Method

```typescript
public async createUser(
  request: CreateUserRequest, 
  options?: TApiRequestOptions
): Promise<TApiClientResult<User>> {
  const { response, data } = await this.post<CreateUserResponseDto>(
    'users', 
    request, 
    options
  );
  
  if (!response.ok || !data) {
    return [null, response];
  }
  
  return [new User(data), response];
}
```

## 🔧 API Client Features

### Built-in HTTP Methods

The base `ApiClient` class provides:

- `get<T>(path, options)` - GET requests
- `post<T>(path, body, options)` - POST requests  
- `put<T>(path, body, options)` - PUT requests
- `patch<T>(path, body, options)` - PATCH requests
- `delete<T>(path, body, options)` - DELETE requests
- `getRawIterable(path, options)` - Streaming requests

### Request Options

```typescript
type TApiRequestOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  // ... other fetch options
};
```

### Response Handling

All methods return a tuple of `[data, response]`:

```typescript
const [user, response] = await client.getUser({ id: '123' });

if (user) {
  // Success - user is fully typed
  console.log(user.name);
} else {
  // Error - check response.status, response.statusText
  console.error(`Error: ${response.status} ${response.statusText}`);
}
```

## 🎯 Advanced Features

### Custom Headers

```typescript
const [data, response] = await client.getUser(
  { id: '123' },
  {
    headers: {
      'Authorization': 'Bearer token',
      'X-Custom-Header': 'value'
    }
  }
);
```

### Request Cancellation

```typescript
const controller = new AbortController();

const [data, response] = await client.getUser(
  { id: '123' },
  { signal: controller.signal }
);

// Cancel the request
controller.abort();
```

### Streaming Data

```typescript
for await (const chunk of client.getDataStream()) {
  // Process streaming data
  console.log(chunk);
}
```

## 🛡️ Type Safety

apx.rest generates fully type-safe clients:

- **Compile-time validation**: Catch API mismatches at build time
- **IntelliSense support**: Full autocomplete in your IDE
- **Null safety**: Proper handling of optional and nullable fields
- **Enum validation**: Type-safe enum usage

## 🔄 Regeneration

The generator adds comments to indicate generated files:

```typescript
// This file was generated by apx.rest
// Do not modify this file directly
// File will be overwritten!!
```

Simply run `npx apx-gen` again to regenerate when your API changes.

## 📁 Project Structure

```
your-project/
├── apx-rest-config.json      # Configuration file
├── src/
│   ├── clients/              # Generated clients
│   │   ├── MyApiClient.ts   # Generated API client
│   │   └── ...
│   └── ...
└── package.json
```

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [npm Package](https://www.npmjs.com/package/apx.rest)
- [GitHub Repository](https://github.com/Apophix/apx.rest)
- [Issues & Bug Reports](https://github.com/Apophix/apx.rest/issues)

---

**apx.rest** - Making REST API consumption type-safe and effortless! 🚀