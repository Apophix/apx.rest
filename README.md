# apx.rest

[![npm](https://img.shields.io/npm/v/apx.rest)](https://www.npmjs.com/package/apx.rest)
[![CI](https://github.com/Apophix/apx.rest/actions/workflows/ci.yml/badge.svg)](https://github.com/Apophix/apx.rest/actions/workflows/ci.yml)

A powerful TypeScript code generation tool for REST APIs that generates type-safe HTTP clients from OpenAPI specifications.

## 🚀 Features

- **Type-Safe API Clients**: Generate fully typed API clients from OpenAPI/Swagger specs
- **Zero Configuration**: Works out of the box with sensible defaults
- **Multiple API Support**: Generate clients for multiple APIs in one project
- **Stream Support**: Built-in support for streaming endpoints
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