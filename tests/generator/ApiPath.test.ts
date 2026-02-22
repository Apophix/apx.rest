import { describe, it, expect, beforeEach } from "vitest";
import {
	ApiPath,
	RequestComponent,
	ResponseComponent,
	ModelComponent,
	EComponentType,
	requestComponents,
	responseComponents,
	responsesMarkedAsUnions,
	resetGeneratorState,
	type TApiPathDto,
} from "../../generator/Generator.js";

beforeEach(() => resetGeneratorState());

// ─── helpers ─────────────────────────────────────────────────────────────────

function makePath(overrides: Partial<TApiPathDto> = {}): ApiPath {
	return new ApiPath({
		endpoint: "api/items",
		method: "get",
		operationId: "",
		requestComponentName: "",
		responseComponentName: "",
		isStreamed: false,
		isFormEndpoint: false,
		parameters: [],
		...overrides,
	});
}

function addRequestComponent(name: string, properties: any[] = []) {
	requestComponents.set(
		name,
		new RequestComponent({
			name,
			properties,
			requiredProperties: [],
			componentType: EComponentType.Request,
		})
	);
}

function addResponseComponent(name: string, properties: any[] = []) {
	responseComponents.set(
		name,
		new ResponseComponent({
			name,
			properties,
			requiredProperties: [],
			componentType: EComponentType.Response,
		})
	);
}

function propDto(name: string, type: string, nullable = false) {
	return { name, type, nullable, referenceIsEnum: false, isFormField: false };
}

// ─── 1. Constructor & basic properties ───────────────────────────────────────

describe("ApiPath — constructor", () => {
	it("strips leading slash from endpoint", () => {
		const p = makePath({ endpoint: "/api/users" });
		expect(p.endpoint).toBe("api/users");
	});

	it("keeps endpoint without leading slash unchanged", () => {
		const p = makePath({ endpoint: "api/users" });
		expect(p.endpoint).toBe("api/users");
	});

	it("stores all dto fields", () => {
		const p = makePath({ method: "post", operationId: "createUser", isStreamed: true, isFormEndpoint: true });
		expect(p.method).toBe("post");
		expect(p.operationId).toBe("createUser");
		expect(p.isStreamed).toBe(true);
		expect(p.isFormEndpoint).toBe(true);
	});

	it("defaults parameters to empty array when not provided", () => {
		const p = new ApiPath({
			endpoint: "x",
			method: "get",
			operationId: "",
			requestComponentName: "",
			responseComponentName: "",
			isStreamed: false,
			isFormEndpoint: false,
		} as any);
		expect(p.parameters).toEqual([]);
	});
});

// ─── 2. Parameters ────────────────────────────────────────────────────────────

describe("ApiPath — hasParameters / queryParams", () => {
	it("hasParameters returns false for empty array", () => {
		expect(makePath({ parameters: [] }).hasParameters).toBe(false);
	});

	it("hasParameters returns true when parameters present", () => {
		const p = makePath({ parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", items: null } }] });
		expect(p.hasParameters).toBe(true);
	});

	it("queryParams filters to only in='query' parameters", () => {
		const p = makePath({
			parameters: [
				{ in: "path", name: "id", required: true, schema: { type: "string", items: null } },
				{ in: "query", name: "page", required: false, schema: { type: "integer", items: null } },
			],
		});
		expect(p.queryParams).toHaveLength(1);
		expect(p.queryParams[0].name).toBe("page");
	});

	it("hasQueryParams returns false when no query params", () => {
		expect(makePath({ parameters: [] }).hasQueryParams).toBe(false);
	});

	it("hasQueryParams returns true when query params present", () => {
		const p = makePath({
			parameters: [{ in: "query", name: "search", required: false, schema: { type: "string", items: null } }],
		});
		expect(p.hasQueryParams).toBe(true);
	});
});

// ─── 3. Path params ───────────────────────────────────────────────────────────

describe("ApiPath — pathParams", () => {
	it("extracts placeholder names from endpoint", () => {
		const p = makePath({ endpoint: "users/{userId}/posts/{postId}" });
		expect(p.pathParams).toEqual(["userId", "postId"]);
	});

	it("returns empty array when no placeholders", () => {
		expect(makePath({ endpoint: "users" }).pathParams).toEqual([]);
	});

	it("hasPathParams returns false when no path params", () => {
		expect(makePath({ endpoint: "users" }).hasPathParams).toBe(false);
	});

	it("hasPathParams returns true when path params present", () => {
		expect(makePath({ endpoint: "users/{id}" }).hasPathParams).toBe(true);
	});
});

// ─── 4. builtEndpointUrl ─────────────────────────────────────────────────────

describe("ApiPath — builtEndpointUrl", () => {
	it("replaces {param} with template literal syntax", () => {
		const p = makePath({ endpoint: "users/{id}" });
		expect(p.builtEndpointUrl).toBe("users/${request.id}");
	});

	it("handles multiple path params", () => {
		const p = makePath({ endpoint: "users/{userId}/posts/{postId}" });
		expect(p.builtEndpointUrl).toBe("users/${request.userId}/posts/${request.postId}");
	});

	it("leaves endpoint unchanged when no path params", () => {
		const p = makePath({ endpoint: "users" });
		expect(p.builtEndpointUrl).toBe("users");
	});
});

// ─── 5. shouldSkipRequest ────────────────────────────────────────────────────

describe("ApiPath — shouldSkipRequest", () => {
	it("returns true when no requestComponent but has path params", () => {
		const p = makePath({ endpoint: "users/{id}", requestComponentName: "" });
		expect(p.shouldSkipRequest).toBe(true);
	});

	it("returns false when no request and no path params", () => {
		const p = makePath({ endpoint: "users", requestComponentName: "" });
		expect(p.shouldSkipRequest).toBe(false);
	});

	it("returns true when all requestComponent properties are path params", () => {
		addRequestComponent("DeleteUserRequest", [propDto("id", "string") as any]);
		const p = makePath({ endpoint: "users/{id}", requestComponentName: "DeleteUserRequest" });
		expect(p.shouldSkipRequest).toBe(true);
	});

	it("returns false when requestComponent has non-path-param properties", () => {
		addRequestComponent("UpdateUserRequest", [propDto("id", "string") as any, propDto("name", "string") as any]);
		const p = makePath({ endpoint: "users/{id}", requestComponentName: "UpdateUserRequest" });
		expect(p.shouldSkipRequest).toBe(false);
	});
});

// ─── 6. requestStr ───────────────────────────────────────────────────────────

describe("ApiPath — requestStr", () => {
	it("returns '' for GET method", () => {
		expect(makePath({ method: "get" }).requestStr).toBe("");
	});

	it("returns ', undefined' when no requestComponent and method is POST", () => {
		expect(makePath({ method: "post", requestComponentName: "" }).requestStr).toBe(", undefined");
	});

	it("returns ', formData' when isFormEndpoint=true", () => {
		addRequestComponent("UploadRequest");
		const p = makePath({ method: "post", requestComponentName: "UploadRequest", isFormEndpoint: true });
		expect(p.requestStr).toBe(", formData");
	});

	it("returns ', undefined' when shouldSkipRequest", () => {
		addRequestComponent("DeleteReq", [propDto("id", "string") as any]);
		const p = makePath({ endpoint: "items/{id}", method: "delete", requestComponentName: "DeleteReq" });
		expect(p.requestStr).toBe(", undefined");
	});

	it("returns ', request' for POST with a requestComponent that should not be skipped", () => {
		addRequestComponent("CreateReq", [propDto("name", "string") as any]);
		const p = makePath({ method: "post", requestComponentName: "CreateReq" });
		expect(p.requestStr).toBe(", request");
	});
});

// ─── 7. clientMethodName ─────────────────────────────────────────────────────

describe("ApiPath — clientMethodName", () => {
	it("uses operationId lowercased when present", () => {
		const p = makePath({ operationId: "CreateUser" });
		expect(p.clientMethodName).toBe("createUser");
	});

	it("strips non-alphanumeric chars from operationId", () => {
		const p = makePath({ operationId: "create-user-item" });
		expect(p.clientMethodName).toBe("createUserItem");
	});

	it("adds Stream suffix when isStreamed=true", () => {
		const p = makePath({ operationId: "GetFeed", isStreamed: true });
		expect(p.clientMethodName).toContain("Stream");
	});

	it("adds '*' generator prefix when isStreamed=true", () => {
		const p = makePath({ operationId: "GetFeed", isStreamed: true });
		expect(p.clientMethodName.startsWith("*")).toBe(true);
	});

	it("uses responseComponent name (minus 'Response') for GET without operationId", () => {
		addResponseComponent("UserListResponse");
		const p = makePath({ method: "get", operationId: "", responseComponentName: "UserListResponse" });
		expect(p.clientMethodName).toBe("userList");
	});

	it("falls back to 'get{Resource}' for GET with no operationId and no response component", () => {
		const p = makePath({ method: "get", operationId: "", endpoint: "api/users" });
		expect(p.clientMethodName).toBe("getApiUsers");
	});

	it("uses requestComponent name (minus 'Request') for POST without operationId", () => {
		addRequestComponent("CreateUserRequest");
		const p = makePath({ method: "post", operationId: "", requestComponentName: "CreateUserRequest" });
		expect(p.clientMethodName).toBe("createUser");
	});

	it("falls back to 'create{Resource}' for POST with no operationId and no request component", () => {
		const p = makePath({ method: "post", operationId: "", endpoint: "api/users" });
		expect(p.clientMethodName).toBe("createApiUsers");
	});

	it("falls back to 'replace{Resource}' for PUT with no operationId and no request component", () => {
		const p = makePath({ method: "put", operationId: "", endpoint: "items" });
		expect(p.clientMethodName).toBe("replaceItems");
	});

	it("falls back to 'delete{Resource}' for DELETE with no operationId and no request component", () => {
		const p = makePath({ method: "delete", operationId: "", endpoint: "items" });
		expect(p.clientMethodName).toBe("deleteItems");
	});

	it("falls back to 'update{Resource}' for PATCH with no operationId and no request component", () => {
		const p = makePath({ method: "patch", operationId: "", endpoint: "items" });
		expect(p.clientMethodName).toBe("updateItems");
	});

	it("throws for unknown HTTP method", () => {
		const p = makePath({ method: "options", operationId: "" });
		expect(() => p.clientMethodName).toThrow("Unknown method: options");
	});
});

// ─── 8. render() — dispatch logic ────────────────────────────────────────────

describe("ApiPath — render() dispatch", () => {
	it("dispatches to renderRequestAndResponse when hasRequest && responseComponent", () => {
		addRequestComponent("CreateReq", [propDto("name", "string") as any]);
		addResponseComponent("ItemResp", [propDto("id", "string") as any]);
		const p = makePath({
			method: "post",
			operationId: "createItem",
			requestComponentName: "CreateReq",
			responseComponentName: "ItemResp",
		});
		const rendered = p.render();
		expect(rendered).toContain("Promise<TApiClientResult<ItemResp>>");
		expect(rendered).toContain("(request: TCreateReq");
	});

	it("dispatches to renderRequestOnly when hasRequest && no responseComponent", () => {
		addRequestComponent("CreateReq", [propDto("name", "string") as any]);
		const p = makePath({
			method: "post",
			operationId: "doThing",
			requestComponentName: "CreateReq",
			responseComponentName: "",
		});
		const rendered = p.render();
		expect(rendered).toContain("Promise<TApiClientResult<null>>");
	});

	it("dispatches to renderResponseOnly when no request && responseComponent", () => {
		addResponseComponent("ItemListResp", [propDto("items", "array") as any]);
		const p = makePath({
			method: "get",
			operationId: "listItems",
			requestComponentName: "",
			responseComponentName: "ItemListResp",
		});
		const rendered = p.render();
		expect(rendered).toContain("Promise<TApiClientResult<ItemListResp>>");
		expect(rendered).not.toContain("request:");
	});

	it("dispatches to renderNoRequestNoResponse when no request && no response", () => {
		const p = makePath({
			method: "delete",
			operationId: "purgeAll",
			requestComponentName: "",
			responseComponentName: "",
		});
		const rendered = p.render();
		expect(rendered).toContain("Promise<TApiClientResult<null>>");
		expect(rendered).not.toContain("request:");
	});

	it("injects inline path param type when hasPathParams and no request component", () => {
		const p = makePath({
			endpoint: "users/{id}",
			method: "get",
			operationId: "getUser",
			requestComponentName: "",
			responseComponentName: "",
		});
		const rendered = p.render();
		expect(rendered).toContain("{ id: string }");
	});

	it("builds intersection type when hasPathParams and has request component", () => {
		addRequestComponent("UpdateReq", [propDto("name", "string") as any]);
		const p = makePath({
			endpoint: "users/{id}",
			method: "put",
			operationId: "updateUser",
			requestComponentName: "UpdateReq",
			responseComponentName: "",
		});
		const rendered = p.render();
		expect(rendered).toContain("{ id: string } & TUpdateReq");
	});

	it("dispatches to streamed response when isStreamed=true", () => {
		addRequestComponent("FeedReq", [propDto("topic", "string") as any]);
		addResponseComponent("FeedChunk", [propDto("data", "string") as any]);
		const p = makePath({
			method: "post",
			operationId: "streamFeed",
			requestComponentName: "FeedReq",
			responseComponentName: "FeedChunk",
			isStreamed: true,
		});
		const rendered = p.render();
		expect(rendered).toContain("AsyncGenerator<FeedChunk>");
	});
});

// ─── 9. Rendered method bodies ───────────────────────────────────────────────

describe("ApiPath — renderRequestAndResponse output", () => {
	beforeEach(() => {
		addRequestComponent("CreateItemRequest", [propDto("name", "string") as any]);
		addResponseComponent("ItemResponse", [propDto("id", "string") as any]);
	});

	it("returns [null, response] guard on !ok", () => {
		const p = makePath({ method: "post", operationId: "createItem", requestComponentName: "CreateItemRequest", responseComponentName: "ItemResponse" });
		expect(p.render()).toContain("return [null, response]");
	});

	it("returns [new ResponseType(data), response] on success", () => {
		const p = makePath({ method: "post", operationId: "createItem", requestComponentName: "CreateItemRequest", responseComponentName: "ItemResponse" });
		expect(p.render()).toContain("new ItemResponse(data)");
	});

	it("uses correct HTTP client function name (post for POST)", () => {
		const p = makePath({ method: "post", operationId: "createItem", requestComponentName: "CreateItemRequest", responseComponentName: "ItemResponse" });
		expect(p.render()).toContain("this.post<");
	});

	it("adds URLSearchParams block when hasQueryParams", () => {
		const p = makePath({
			method: "post",
			operationId: "searchItems",
			requestComponentName: "CreateItemRequest",
			responseComponentName: "ItemResponse",
			parameters: [{ in: "query", name: "page", required: false, schema: { type: "integer", items: null } }],
		});
		expect(p.render()).toContain("new URLSearchParams()");
	});

	it("appends query string to URL when hasQueryParams", () => {
		const p = makePath({
			method: "post",
			operationId: "searchItems",
			requestComponentName: "CreateItemRequest",
			responseComponentName: "ItemResponse",
			parameters: [{ in: "query", name: "page", required: false, schema: { type: "integer", items: null } }],
		});
		expect(p.render()).toContain("?${queryParams}");
	});

	it("adds FormData block when isFormEndpoint", () => {
		addRequestComponent("UploadReq", [{ name: "file", type: "string", format: "binary", nullable: false, referenceIsEnum: false, isFormField: true } as any]);
		addResponseComponent("UploadResp", [propDto("url", "string") as any]);
		const p = makePath({
			method: "post",
			operationId: "upload",
			requestComponentName: "UploadReq",
			responseComponentName: "UploadResp",
			isFormEndpoint: true,
		});
		const rendered = p.render();
		expect(rendered).toContain("new FormData()");
		expect(rendered).toContain("formData.append(");
	});
});

describe("ApiPath — renderNoRequestNoResponse output", () => {
	it("no request param in signature", () => {
		const p = makePath({ method: "delete", operationId: "purge" });
		expect(p.render()).not.toContain("request:");
	});

	it("uses 'undefined, ' body for non-GET methods", () => {
		const p = makePath({ method: "delete", operationId: "purge" });
		expect(p.render()).toContain("undefined, options");
	});

	it("does NOT include 'undefined, ' for GET method", () => {
		const p = makePath({ method: "get", operationId: "health" });
		expect(p.render()).not.toContain("undefined,");
	});

	it("returns [null, response]", () => {
		const p = makePath({ method: "delete", operationId: "purge" });
		expect(p.render()).toContain("[null, response]");
	});
});

describe("ApiPath — render() query param type mapping", () => {
	it("maps integer query param to 'number'", () => {
		const p = makePath({
			method: "get",
			operationId: "list",
			parameters: [{ in: "query", name: "page", required: true, schema: { type: "integer", items: null } }],
		});
		expect(p.render()).toContain("page: number");
	});

	it("maps date-time format query param to 'string'", () => {
		const p = makePath({
			method: "get",
			operationId: "list",
			parameters: [{ in: "query", name: "from", required: true, schema: { type: "string", format: "date-time", items: null } }],
		});
		expect(p.render()).toContain("from: string");
	});

	it("maps array query param to 'itemType[]'", () => {
		const p = makePath({
			method: "get",
			operationId: "list",
			parameters: [{ in: "query", name: "ids", required: true, schema: { type: "array", items: { type: "string" } } }],
		});
		expect(p.render()).toContain("ids: string[]");
	});

	it("marks optional query params with '?'", () => {
		const p = makePath({
			method: "get",
			operationId: "list",
			parameters: [{ in: "query", name: "search", required: false, schema: { type: "string", items: null } }],
		});
		expect(p.render()).toContain("search?:");
	});

	it("marks required query params without '?'", () => {
		const p = makePath({
			method: "get",
			operationId: "list",
			parameters: [{ in: "query", name: "id", required: true, schema: { type: "string", items: null } }],
		});
		const rendered = p.render();
		expect(rendered).toContain("id: string");
		expect(rendered).not.toContain("id?:");
	});
});

describe("ApiPath — form endpoint uses postFormData client function", () => {
	it("sets clientFunctionName to 'postFormData' for form endpoints", () => {
		addRequestComponent("UploadReq", [{ name: "file", type: "string", format: "binary", nullable: false, referenceIsEnum: false, isFormField: true } as any]);
		const p = makePath({
			method: "post",
			operationId: "upload",
			requestComponentName: "UploadReq",
			isFormEndpoint: true,
		});
		expect(p.render()).toContain("postFormData");
	});
});
