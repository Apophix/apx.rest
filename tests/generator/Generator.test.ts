import { describe, it, expect } from "vitest";
import { generateOutputString } from "../../generator/Generator.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_OPTS = {
	documentUrl: "https://api.example.com/openapi.json",
	streamedEndpoints: [] as string[],
	clientName: "MyApiClient",
	clientBaseUrl: "https://api.example.com",
};

function gen(doc: object, opts: Partial<typeof DEFAULT_OPTS> = {}): string {
	return generateOutputString(doc, { ...DEFAULT_OPTS, ...opts });
}

/** Minimal valid OpenAPI doc with a single GET endpoint and no components. */
function minimalDoc(overrides: Record<string, any> = {}): object {
	return {
		paths: {
			"/health": {
				get: {
					operationId: "getHealth",
					responses: { "200": {} },
				},
			},
		},
		components: { schemas: {} },
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// 1. File header & boilerplate
// ---------------------------------------------------------------------------

describe("generateOutputString — file header & boilerplate", () => {
	it("contains the auto-generated banner", () => {
		const out = gen(minimalDoc());
		expect(out).toContain("AUTO-GENERATED FILE — apx.rest");
	});

	it("contains the eslint-disable comment", () => {
		const out = gen(minimalDoc());
		expect(out).toContain("/* eslint-disable */");
	});

	it("contains the apx.rest import statement", () => {
		const out = gen(minimalDoc());
		expect(out).toContain('import { ApiClient, type TApiRequestOptions, type TApiClientResult } from "apx.rest"');
	});

	it("embeds the documentUrl in the header comment", () => {
		const out = gen(minimalDoc(), { documentUrl: "https://my-server/api/v2/openapi.json" });
		expect(out).toContain("https://my-server/api/v2/openapi.json");
	});

	it("contains a 'Generated on:' timestamp line", () => {
		const out = gen(minimalDoc());
		expect(out).toMatch(/Generated on: \d{4}-\d{2}-\d{2}T/);
	});
});

// ---------------------------------------------------------------------------
// 2. Client class skeleton
// ---------------------------------------------------------------------------

describe("generateOutputString — client class", () => {
	it("emits the correct class name", () => {
		const out = gen(minimalDoc(), { clientName: "PetStoreClient" });
		expect(out).toContain("export class PetStoreClient extends ApiClient");
	});

	it("wraps a raw http URL in double quotes in the constructor", () => {
		const out = gen(minimalDoc(), { clientBaseUrl: "https://api.example.com" });
		expect(out).toContain(`super("https://api.example.com")`);
	});

	it("passes a non-http value (env var expression) through without extra quotes", () => {
		const out = gen(minimalDoc(), { clientBaseUrl: "process.env.API_BASE_URL!" });
		expect(out).toContain("super(process.env.API_BASE_URL!)");
	});

	it("opens and closes the class braces", () => {
		const out = gen(minimalDoc());
		expect(out).toContain("extends ApiClient {");
		expect(out.trimEnd().endsWith("}")).toBe(true);
	});

	it("constructor has no extra parameters", () => {
		const out = gen(minimalDoc());
		expect(out).toContain("public constructor()");
	});
});

// ---------------------------------------------------------------------------
// 3. Simple GET endpoint — no request, no response component
// ---------------------------------------------------------------------------

describe("generateOutputString — GET with no request/response", () => {
	const doc = {
		paths: {
			"/ping": {
				get: {
					operationId: "ping",
					responses: { "200": {} },
				},
			},
		},
		components: { schemas: {} },
	};

	it("emits a method named 'ping'", () => {
		expect(gen(doc)).toContain("ping(");
	});

	it("method signature has no request DTO param", () => {
		const out = gen(doc);
		// should not have a typed request parameter (only optional TApiRequestOptions)
		expect(out).not.toMatch(/ping\s*\(\s*\w+\s*:\s*T\w+Request/);
	});

	it("uses the get() client function", () => {
		expect(gen(doc)).toContain("this.get(");
	});
});

// ---------------------------------------------------------------------------
// 4. GET endpoint with a response component
// ---------------------------------------------------------------------------

describe("generateOutputString — GET with response component", () => {
	const doc = {
		paths: {
			"/items": {
				get: {
					operationId: "listItems",
					responses: {
						"200": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ItemListResponse" },
								},
							},
						},
					},
				},
			},
		},
		components: {
			schemas: {
				ItemListResponse: {
					type: "object",
					properties: {
						items: { type: "array", items: { type: "string" } },
						total: { type: "integer" },
					},
				},
			},
		},
	};

	it("emits a ResponseComponent type declaration for ItemListResponse", () => {
		const out = gen(doc);
		expect(out).toContain("export type TItemListResponseDto");
	});

	it("emits a ResponseComponent class for ItemListResponse", () => {
		const out = gen(doc);
		expect(out).toContain("export class ItemListResponse");
	});

	it("method return type references TItemListResponseDto", () => {
		const out = gen(doc);
		expect(out).toContain("TItemListResponseDto");
	});

	it("emits an 'items' property on the DTO type", () => {
		const out = gen(doc);
		expect(out).toContain("items");
	});

	it("emits a 'total' property on the DTO type", () => {
		const out = gen(doc);
		expect(out).toContain("total");
	});
});

// ---------------------------------------------------------------------------
// 5. POST endpoint with request and response
// ---------------------------------------------------------------------------

describe("generateOutputString — POST with request and response", () => {
	const doc = {
		paths: {
			"/items": {
				post: {
					operationId: "createItem",
					requestBody: {
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/CreateItemRequest" },
							},
						},
					},
					responses: {
						"200": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ItemResponse" },
								},
							},
						},
					},
				},
			},
		},
		components: {
			schemas: {
				CreateItemRequest: {
					type: "object",
					required: ["name"],
					properties: {
						name: { type: "string" },
						description: { type: "string", nullable: true },
					},
				},
				ItemResponse: {
					type: "object",
					properties: {
						id: { type: "integer" },
						name: { type: "string" },
					},
				},
			},
		},
	};

	it("emits a RequestComponent type for CreateItemRequest", () => {
		const out = gen(doc);
		expect(out).toContain("export type TCreateItemRequest");
	});

	it("RequestComponent only emits a type — no class body", () => {
		const out = gen(doc);
		// RequestComponent renders only a type alias, not a class
		expect(out).not.toContain("export class CreateItemRequest");
	});

	it("emits a ResponseComponent type for ItemResponse", () => {
		const out = gen(doc);
		expect(out).toContain("export type TItemResponseDto");
	});

	it("method accepts a TCreateItemRequest parameter", () => {
		const out = gen(doc);
		expect(out).toContain("TCreateItemRequest");
	});

	it("method uses the post() client function", () => {
		const out = gen(doc);
		// render includes type param: this.post<T>(...)
		expect(out).toContain("this.post<");
	});

	it("required 'name' property is non-nullable in the DTO type", () => {
		const out = gen(doc);
		// Required fields should not have '?' in type
		expect(out).toMatch(/name\s*:/);
		// The required field line should not be 'name?:'
		expect(out).not.toMatch(/name\?:/);
	});

	it("nullable 'description' property has '?' in the DTO type", () => {
		const out = gen(doc);
		expect(out).toContain("description?:");
	});
});

// ---------------------------------------------------------------------------
// 6. Enum component
// ---------------------------------------------------------------------------

describe("generateOutputString — enum component", () => {
	const doc = {
		paths: {
			"/orders": {
				get: {
					operationId: "listOrders",
					responses: { "200": {} },
				},
			},
		},
		components: {
			schemas: {
				OrderStatus: {
					type: "string",
					enum: ["Pending", "Processing", "Completed", "Cancelled"],
					"x-enumNames": ["Pending", "Processing", "Completed", "Cancelled"],
				},
			},
		},
	};

	it("emits an enum declaration for OrderStatus", () => {
		const out = gen(doc);
		expect(out).toContain("export enum OrderStatus");
	});

	it("includes all enum members", () => {
		const out = gen(doc);
		expect(out).toContain("Pending");
		expect(out).toContain("Processing");
		expect(out).toContain("Completed");
		expect(out).toContain("Cancelled");
	});

	it("enum values are quoted strings", () => {
		const out = gen(doc);
		expect(out).toContain('"Pending"');
	});
});

// ---------------------------------------------------------------------------
// 7. Integer enum (values without quotes)
// ---------------------------------------------------------------------------

describe("generateOutputString — integer enum", () => {
	const doc = {
		paths: {
			"/jobs": {
				get: {
					operationId: "listJobs",
					responses: { "200": {} },
				},
			},
		},
		components: {
			schemas: {
				JobPriority: {
					type: "integer",
					enum: [0, 1, 2],
					"x-enumNames": ["Low", "Normal", "High"],
				},
			},
		},
	};

	it("emits integer enum values without quotes", () => {
		const out = gen(doc);
		expect(out).toContain("Low = 0");
		expect(out).toContain("Normal = 1");
		expect(out).toContain("High = 2");
	});
});

// ---------------------------------------------------------------------------
// 8. Model component (neither request nor response)
// ---------------------------------------------------------------------------

describe("generateOutputString — model component", () => {
	const doc = {
		paths: {
			"/noop": {
				get: {
					operationId: "noop",
					responses: { "200": {} },
				},
			},
		},
		components: {
			schemas: {
				Address: {
					type: "object",
					properties: {
						street: { type: "string" },
						city: { type: "string" },
						postCode: { type: "string" },
					},
				},
			},
		},
	};

	it("emits a ModelComponent type for Address", () => {
		const out = gen(doc);
		expect(out).toContain("export type TAddressDto");
	});

	it("emits a ModelComponent class for Address", () => {
		const out = gen(doc);
		expect(out).toContain("export class Address");
	});

	it("includes all model properties", () => {
		const out = gen(doc);
		expect(out).toContain("street");
		expect(out).toContain("city");
		expect(out).toContain("postCode");
	});
});

// ---------------------------------------------------------------------------
// 9. Response with a $ref property (nested object)
// ---------------------------------------------------------------------------

describe("generateOutputString — response with $ref property", () => {
	const doc = {
		paths: {
			"/users/{id}": {
				get: {
					operationId: "getUser",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					responses: {
						"200": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/UserResponse" },
								},
							},
						},
					},
				},
			},
		},
		components: {
			schemas: {
				UserResponse: {
					type: "object",
					properties: {
						id: { type: "string" },
						address: { $ref: "#/components/schemas/Address" },
					},
				},
				Address: {
					type: "object",
					properties: { city: { type: "string" } },
				},
			},
		},
	};

	it("emits UserResponse class", () => {
		expect(gen(doc)).toContain("export class UserResponse");
	});

	it("Address $ref property is nullable in constructor (wrapped with conditional new)", () => {
		const out = gen(doc);
		// The constructor should use a conditional 'new Address(dto.address)' pattern
		expect(out).toContain("Address");
	});
});

// ---------------------------------------------------------------------------
// 10. Response with enum property
// ---------------------------------------------------------------------------

describe("generateOutputString — response with enum property", () => {
	const doc = {
		paths: {
			"/orders/{id}": {
				get: {
					operationId: "getOrder",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					responses: {
						"200": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/OrderResponse" },
								},
							},
						},
					},
				},
			},
		},
		components: {
			schemas: {
				OrderStatus: {
					type: "string",
					enum: ["Pending", "Completed"],
				},
				OrderResponse: {
					type: "object",
					properties: {
						id: { type: "integer" },
						status: { $ref: "#/components/schemas/OrderStatus" },
					},
				},
			},
		},
	};

	it("emits the OrderStatus enum", () => {
		expect(gen(doc)).toContain("export enum OrderStatus");
	});

	it("status property uses enum type (not TOrderStatusDto)", () => {
		const out = gen(doc);
		// Enum properties should use the plain enum name, not a DTO type
		expect(out).toContain("OrderStatus");
		expect(out).not.toContain("TOrderStatusDto");
	});
});

// ---------------------------------------------------------------------------
// 11. Form data endpoint
// ---------------------------------------------------------------------------

describe("generateOutputString — multipart/form-data endpoint", () => {
	const doc = {
		paths: {
			"/upload": {
				post: {
					operationId: "uploadFile",
					requestBody: {
						content: {
							"multipart/form-data": {
								schema: {
									type: "object",
									properties: {
										file: { type: "string", format: "binary" },
										description: { type: "string" },
									},
									required: ["file"],
								},
							},
						},
					},
					responses: {
						"200": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/UploadResponse" },
								},
							},
						},
					},
				},
			},
		},
		components: {
			schemas: {
				UploadResponse: {
					type: "object",
					properties: { fileId: { type: "string" } },
				},
			},
		},
	};

	it("generates an UploadFileFormDataRequest type", () => {
		const out = gen(doc);
		expect(out).toContain("UploadFileFormDataRequest");
	});

	it("uses the postFormData client function", () => {
		const out = gen(doc);
		expect(out).toContain("postFormData");
	});

	it("file property is typed as File", () => {
		const out = gen(doc);
		expect(out).toContain("File");
	});
});

// ---------------------------------------------------------------------------
// 12. Streamed endpoint
// ---------------------------------------------------------------------------

describe("generateOutputString — streamed endpoint", () => {
	// Streaming (async generator) is only generated when the endpoint has a
	// request component (or path/query params) in addition to a response.
	const doc = {
		paths: {
			"/feed": {
				post: {
					operationId: "streamFeed",
					requestBody: {
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/FeedRequest" },
							},
						},
					},
					responses: {
						"200": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/FeedChunk" },
								},
							},
						},
					},
				},
			},
		},
		components: {
			schemas: {
				FeedRequest: {
					type: "object",
					properties: { cursor: { type: "string" } },
				},
				FeedChunk: {
					type: "object",
					properties: { data: { type: "string" } },
				},
			},
		},
	};

	it("marks method as async generator when endpoint is in streamedEndpoints", () => {
		const out = gen(doc, { streamedEndpoints: ["/feed"] });
		expect(out).toContain("async *");
	});

	it("uses an iterable client function when streamed", () => {
		const out = gen(doc, { streamedEndpoints: ["/feed"] });
		expect(out).toContain("Iterable<");
	});

	it("does NOT mark method as generator when endpoint is not in streamedEndpoints", () => {
		const out = gen(doc, { streamedEndpoints: [] });
		expect(out).not.toContain("async *");
	});
});

// ---------------------------------------------------------------------------
// 12b. Streamed union type with no request body (known gap — partial failure)
//
// When a GET endpoint is in streamedEndpoints but has no request body/params,
// render() falls through to renderResponseOnly() instead of the streamed path.
//
// clientMethodName always prepends "*" for streamed endpoints, so the method
// signature becomes "public async *streamEvents(...)" — but renderResponseOnly
// produces the wrong body: a Promise return type with no yield.
//
// Expected correct behaviour (failing assertions documented below):
//   • Return type should be AsyncGenerator<EventUnion>, not Promise<TApiClientResult<...>>
//   • Body should use for-await + yield (an Iterable client call)
//
// Assertions that currently PASS despite the bug:
//   • "async *" is present (clientMethodName adds "*" prefix unconditionally)
//   • switch()/match() methods on EventUnion (ResponseComponent is correct)
// ---------------------------------------------------------------------------

describe("generateOutputString — streamed union response with no request (known gap)", () => {
	const doc = {
		paths: {
			"/events/stream": {
				get: {
					operationId: "streamEvents",
					"x-union-response": true,
					responses: {
						"200": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/EventUnion" },
								},
							},
						},
					},
				},
			},
		},
		components: {
			schemas: {
				EventUnion: {
					type: "object",
					properties: {
						created: { $ref: "#/components/schemas/CreatedEvent" },
						deleted: { $ref: "#/components/schemas/DeletedEvent" },
					},
				},
				CreatedEvent: {
					type: "object",
					properties: { id: { type: "string" } },
				},
				DeletedEvent: {
					type: "object",
					properties: { id: { type: "string" } },
				},
			},
		},
	};

	it("method signature has async * (clientMethodName adds * for all streamed endpoints)", () => {
		// Passes incidentally — clientMethodName prepends "*" unconditionally when
		// isStreamed=true, but renderResponseOnly still uses this name.
		const out = gen(doc, { streamedEndpoints: ["/events/stream"] });
		expect(out).toContain("async *");
	});

	it("return type should be AsyncGenerator, not Promise — KNOWN FAILURE", () => {
		// KNOWN FAILURE: renderResponseOnly is called and emits
		//   Promise<TApiClientResult<EventUnion>>  instead of  AsyncGenerator<EventUnion>
		const out = gen(doc, { streamedEndpoints: ["/events/stream"] });
		expect(out).toContain("AsyncGenerator<");
	});

	it("body should use an iterable client call (for-await + yield) — KNOWN FAILURE", () => {
		// KNOWN FAILURE: renderResponseOnly emits a plain await + return, not a
		// for-await loop with yield new EventUnion(chunkDto).
		const out = gen(doc, { streamedEndpoints: ["/events/stream"] });
		expect(out).toContain("Iterable<");
	});

	it("EventUnion class has switch() method (ResponseComponent is correctly marked as union)", () => {
		const out = gen(doc, { streamedEndpoints: ["/events/stream"] });
		expect(out).toContain("public switch(");
	});

	it("EventUnion class has match<TResult>() method (ResponseComponent is correctly marked as union)", () => {
		const out = gen(doc, { streamedEndpoints: ["/events/stream"] });
		expect(out).toContain("match<TResult>(");
	});
});



describe("generateOutputString — path parameters", () => {
	const doc = {
		paths: {
			"/users/{userId}/posts/{postId}": {
				get: {
					operationId: "getUserPost",
					parameters: [
						{ name: "userId", in: "path", required: true, schema: { type: "string" } },
						{ name: "postId", in: "path", required: true, schema: { type: "integer" } },
					],
					responses: { "200": {} },
				},
			},
		},
		components: { schemas: {} },
	};

	it("includes userId in the method signature", () => {
		expect(gen(doc)).toContain("userId");
	});

	it("includes postId in the method signature", () => {
		expect(gen(doc)).toContain("postId");
	});

	it("interpolates path params into the URL string", () => {
		const out = gen(doc);
		// builtEndpointUrl replaces {param} with ${request.param}
		expect(out).toContain("${request.userId}");
		expect(out).toContain("${request.postId}");
	});
});

// ---------------------------------------------------------------------------
// 14. Query parameters
// ---------------------------------------------------------------------------

describe("generateOutputString — query parameters", () => {
	const doc = {
		paths: {
			"/search": {
				get: {
					operationId: "search",
					parameters: [
						{ name: "q", in: "query", required: true, schema: { type: "string" } },
						{ name: "page", in: "query", required: false, schema: { type: "integer" } },
						{ name: "active", in: "query", required: false, schema: { type: "boolean" } },
					],
					responses: { "200": {} },
				},
			},
		},
		components: { schemas: {} },
	};

	it("includes query param names in the method signature", () => {
		const out = gen(doc);
		expect(out).toContain("q");
		expect(out).toContain("page");
		expect(out).toContain("active");
	});

	it("builds a URLSearchParams block", () => {
		expect(gen(doc)).toContain("URLSearchParams");
	});

	it("appends query string to the URL", () => {
		const out = gen(doc);
		// the variable is named queryParams, not searchParams
		expect(out).toContain("queryParams");
	});

	it("required query param has no '?' in the type", () => {
		const out = gen(doc);
		expect(out).toMatch(/q\s*:/);
		expect(out).not.toMatch(/q\?:/);
	});

	it("optional query param has '?' in the type", () => {
		const out = gen(doc);
		expect(out).toMatch(/page\?:/);
	});
});

// ---------------------------------------------------------------------------
// 15. Union response (x-union-response)
// ---------------------------------------------------------------------------

describe("generateOutputString — union response", () => {
	const doc = {
		paths: {
			"/events/{id}": {
				get: {
					operationId: "getEvent",
					"x-union-response": true,
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					responses: {
						"200": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/EventUnion" },
								},
							},
						},
					},
				},
			},
		},
		components: {
			schemas: {
				EventUnion: {
					type: "object",
					properties: { type: { type: "string" } },
				},
			},
		},
	};

	it("emits a switch() method on the EventUnion class", () => {
		expect(gen(doc)).toContain("switch(");
	});

	it("emits a match() method on the EventUnion class", () => {
		// match<TResult>( — note the type parameter
		expect(gen(doc)).toContain("match<TResult>(");
	});
});

// ---------------------------------------------------------------------------
// 16. Multiple endpoints — correct ordering and isolation
// ---------------------------------------------------------------------------

describe("generateOutputString — multiple endpoints", () => {
	const doc = {
		paths: {
			"/items": {
				get: {
					operationId: "listItems",
					responses: {
						"200": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ItemListResponse" },
								},
							},
						},
					},
				},
				post: {
					operationId: "createItem",
					requestBody: {
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/CreateItemRequest" },
							},
						},
					},
					responses: { "201": {} },
				},
			},
			"/items/{id}": {
				delete: {
					operationId: "deleteItem",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					responses: { "204": {} },
				},
			},
		},
		components: {
			schemas: {
				ItemListResponse: {
					type: "object",
					properties: { items: { type: "array", items: { type: "string" } } },
				},
				CreateItemRequest: {
					type: "object",
					properties: { name: { type: "string" } },
				},
			},
		},
	};

	it("emits a listItems method", () => {
		expect(gen(doc)).toContain("listItems(");
	});

	it("emits a createItem method", () => {
		expect(gen(doc)).toContain("createItem(");
	});

	it("emits a deleteItem method", () => {
		expect(gen(doc)).toContain("deleteItem(");
	});

	it("only one class declaration is emitted", () => {
		const out = gen(doc);
		const matches = out.match(/export class MyApiClient/g);
		expect(matches?.length).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// 17. Repeated calls are isolated (no state bleed between invocations)
// ---------------------------------------------------------------------------

describe("generateOutputString — call isolation", () => {
	it("a second call with a different clientName produces the new name", () => {
		gen(minimalDoc(), { clientName: "FirstClient" });
		const out = gen(minimalDoc(), { clientName: "SecondClient" });
		expect(out).toContain("SecondClient");
		expect(out).not.toContain("FirstClient");
	});

	it("components from first call do not leak into second call", () => {
		const docWithEnum = {
			paths: { "/x": { get: { operationId: "x", responses: { "200": {} } } } },
			components: { schemas: { MyEnum: { type: "string", enum: ["A", "B"] } } },
		};
		gen(docWithEnum);
		// second call with no enums should not contain MyEnum
		const out = gen(minimalDoc());
		expect(out).not.toContain("MyEnum");
	});
});

// ---------------------------------------------------------------------------
// 18. No components section in document
// ---------------------------------------------------------------------------

describe("generateOutputString — document with no components", () => {
	it("generates without throwing when components section is absent", () => {
		const doc = {
			paths: {
				"/ping": {
					get: { operationId: "ping", responses: { "200": {} } },
				},
			},
		};
		expect(() => gen(doc)).not.toThrow();
	});

	it("still emits the client class", () => {
		const doc = {
			paths: {
				"/ping": {
					get: { operationId: "ping", responses: { "200": {} } },
				},
			},
		};
		expect(gen(doc)).toContain("export class MyApiClient");
	});
});

// ---------------------------------------------------------------------------
// 19. Date-time property in response
// ---------------------------------------------------------------------------

describe("generateOutputString — date-time property", () => {
	const doc = {
		paths: {
			"/events": {
				get: {
					operationId: "listEvents",
					responses: {
						"200": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/EventResponse" },
								},
							},
						},
					},
				},
			},
		},
		components: {
			schemas: {
				EventResponse: {
					type: "object",
					properties: {
						id: { type: "string" },
						createdAt: { type: "string", format: "date-time" },
					},
				},
			},
		},
	};

	it("types createdAt as Date in the class", () => {
		const out = gen(doc);
		expect(out).toContain("createdAt");
		expect(out).toContain("Date");
	});

	it("constructor wraps createdAt with new Date()", () => {
		const out = gen(doc);
		expect(out).toContain("new Date(");
	});

	it("the DTO type exists for EventResponse", () => {
		// renderImplementsDto (with Omit<>) is a getter but is not used in
		// the rendered output — the constructor uses the full dtoName.
		const out = gen(doc);
		expect(out).toContain("export type TEventResponseDto");
	});
});

// ---------------------------------------------------------------------------
// 20. Array response property
// ---------------------------------------------------------------------------

describe("generateOutputString — array properties", () => {
	const doc = {
		paths: {
			"/lists": {
				get: {
					operationId: "getLists",
					responses: {
						"200": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/ListsResponse" },
								},
							},
						},
					},
				},
			},
		},
		components: {
			schemas: {
				ListsResponse: {
					type: "object",
					properties: {
						tags: { type: "array", items: { type: "string" } },
						counts: { type: "array", items: { type: "integer" } },
					},
				},
			},
		},
	};

	it("types a string array property as string[]", () => {
		const out = gen(doc);
		expect(out).toContain("string[]");
	});

	it("types an integer array property as number[]", () => {
		const out = gen(doc);
		expect(out).toContain("number[]");
	});
});

// ---------------------------------------------------------------------------
// 21. Dictionary (additionalProperties) property
// ---------------------------------------------------------------------------

describe("generateOutputString — dictionary property", () => {
	const doc = {
		paths: {
			"/meta": {
				get: {
					operationId: "getMeta",
					responses: {
						"200": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/MetaResponse" },
								},
							},
						},
					},
				},
			},
		},
		components: {
			schemas: {
				MetaResponse: {
					type: "object",
					properties: {
						labels: {
							type: "object",
							additionalProperties: { type: "string" },
						},
					},
				},
			},
		},
	};

	it("types a dictionary property as Record<string, string>", () => {
		expect(gen(doc)).toContain("Record<string, string>");
	});

	it("constructor assigns dictionary as a Map", () => {
		expect(gen(doc)).toContain("Map");
	});
});

// ---------------------------------------------------------------------------
// 22. PUT and PATCH endpoints
// ---------------------------------------------------------------------------

describe("generateOutputString — PUT and PATCH", () => {
	const doc = {
		paths: {
			"/items/{id}": {
				put: {
					operationId: "replaceItem",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					requestBody: {
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ItemRequest" },
							},
						},
					},
					responses: { "200": {} },
				},
				patch: {
					operationId: "updateItem",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					requestBody: {
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ItemRequest" },
							},
						},
					},
					responses: { "200": {} },
				},
			},
		},
		components: {
			schemas: {
				ItemRequest: {
					type: "object",
					properties: { name: { type: "string" } },
				},
			},
		},
	};

	it("PUT endpoint uses the put() client function", () => {
		expect(gen(doc)).toContain("this.put(");
	});

	it("PATCH endpoint uses the patch() client function", () => {
		expect(gen(doc)).toContain("this.patch(");
	});
});

// ---------------------------------------------------------------------------
// 23. DELETE endpoint
// ---------------------------------------------------------------------------

describe("generateOutputString — DELETE", () => {
	const doc = {
		paths: {
			"/items/{id}": {
				delete: {
					operationId: "deleteItem",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					responses: { "204": {} },
				},
			},
		},
		components: { schemas: {} },
	};

	it("DELETE endpoint uses the delete() client function", () => {
		expect(gen(doc)).toContain("this.delete(");
	});
});

// ---------------------------------------------------------------------------
// 24. Snapshot-style: complete small API output
// ---------------------------------------------------------------------------

describe("generateOutputString — complete small API snapshot", () => {
	const doc = {
		paths: {
			"/todos": {
				get: {
					operationId: "listTodos",
					responses: {
						"200": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/TodoListResponse" },
								},
							},
						},
					},
				},
				post: {
					operationId: "createTodo",
					requestBody: {
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/CreateTodoRequest" },
							},
						},
					},
					responses: {
						"201": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/TodoResponse" },
								},
							},
						},
					},
				},
			},
			"/todos/{id}": {
				get: {
					operationId: "getTodo",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					responses: {
						"200": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/TodoResponse" },
								},
							},
						},
					},
				},
				delete: {
					operationId: "deleteTodo",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					responses: { "204": {} },
				},
			},
		},
		components: {
			schemas: {
				TodoStatus: {
					type: "string",
					enum: ["Open", "Done"],
					"x-enumNames": ["Open", "Done"],
				},
				CreateTodoRequest: {
					type: "object",
					required: ["title"],
					properties: {
						title: { type: "string" },
						dueDate: { type: "string", format: "date-time", nullable: true },
					},
				},
				TodoResponse: {
					type: "object",
					properties: {
						id: { type: "string" },
						title: { type: "string" },
						status: { $ref: "#/components/schemas/TodoStatus" },
						createdAt: { type: "string", format: "date-time" },
					},
				},
				TodoListResponse: {
					type: "object",
					properties: {
						todos: {
							type: "array",
							items: { $ref: "#/components/schemas/TodoResponse" },
						},
						total: { type: "integer" },
					},
				},
			},
		},
	};

	let out: string;
	it("generates without throwing", () => {
		expect(() => { out = gen(doc, { clientName: "TodoClient" }); }).not.toThrow();
	});

	it("contains the client class", () => {
		out = gen(doc, { clientName: "TodoClient" });
		expect(out).toContain("export class TodoClient extends ApiClient");
	});

	it("contains CreateTodoRequest type and class", () => {
		out = gen(doc, { clientName: "TodoClient" });
		// RequestComponent renders only a type alias (no class, no Dto suffix)
		expect(out).toContain("export type TCreateTodoRequest");
	});

	it("contains TodoResponse type and class", () => {
		out = gen(doc, { clientName: "TodoClient" });
		expect(out).toContain("export type TTodoResponseDto");
		expect(out).toContain("export class TodoResponse");
	});

	it("contains TodoListResponse type and class", () => {
		out = gen(doc, { clientName: "TodoClient" });
		expect(out).toContain("export type TTodoListResponseDto");
		expect(out).toContain("export class TodoListResponse");
	});

	it("contains TodoStatus enum", () => {
		out = gen(doc, { clientName: "TodoClient" });
		expect(out).toContain("export enum TodoStatus");
		expect(out).toContain('"Open"');
		expect(out).toContain('"Done"');
	});

	it("contains all four client methods", () => {
		out = gen(doc, { clientName: "TodoClient" });
		expect(out).toContain("listTodos(");
		expect(out).toContain("createTodo(");
		expect(out).toContain("getTodo(");
		expect(out).toContain("deleteTodo(");
	});

	it("createTodo uses this.post() with type parameter", () => {
		out = gen(doc, { clientName: "TodoClient" });
		expect(out).toContain("this.post<");
	});

	it("deleteTodo uses this.delete()", () => {
		out = gen(doc, { clientName: "TodoClient" });
		expect(out).toContain("this.delete(");
	});

	it("TodoResponse constructor wraps createdAt with new Date()", () => {
		out = gen(doc, { clientName: "TodoClient" });
		expect(out).toContain("new Date(");
	});

	it("output starts with the auto-generated banner and ends with class closing brace", () => {
		out = gen(doc, { clientName: "TodoClient" });
		expect(out.startsWith("// ------")).toBe(true);
		expect(out.trimEnd().endsWith("}")).toBe(true);
	});
});
