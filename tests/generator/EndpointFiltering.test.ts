import { describe, it, expect, vi, afterEach } from "vitest";
import { generateOutputString, type TGeneratorOptions } from "../../generator/Generator.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_OPTS: TGeneratorOptions = {
	documentUrl: "https://api.example.com/openapi.json",
	streamedEndpoints: [],
	clientName: "MyApiClient",
	clientBaseUrl: "https://api.example.com",
};

function gen(doc: object, opts: Partial<TGeneratorOptions> = {}): string {
	return generateOutputString(doc, { ...DEFAULT_OPTS, ...opts });
}

/** One GET endpoint per path, each with its own response schema. */
function filterDoc(): object {
	const op = (operationId: string, schema: string) => ({
		operationId,
		responses: {
			"200": {
				content: {
					"application/json": { schema: { $ref: `#/components/schemas/${schema}` } },
				},
			},
		},
	});
	return {
		paths: {
			"/users": { get: op("listUsers", "UserListResponse") },
			"/users/{id}": {
				get: op("getUser", "UserResponse"),
				delete: { operationId: "deleteUser", responses: { "204": {} } },
			},
			"/admin/jobs": { get: op("listJobs", "JobListResponse") },
			"/admin/jobs/{id}/logs": { get: op("getJobLogs", "JobLogsResponse") },
			"/health": { get: op("getHealth", "HealthResponse") },
		},
		components: {
			schemas: {
				UserListResponse: { type: "object", properties: { total: { type: "integer" } } },
				UserResponse: { type: "object", properties: { name: { type: "string" } } },
				JobListResponse: { type: "object", properties: { total: { type: "integer" } } },
				JobLogsResponse: { type: "object", properties: { lines: { type: "string" } } },
				HealthResponse: { type: "object", properties: { ok: { type: "boolean" } } },
			},
		},
	};
}

const ALL_METHODS = ["listUsers", "getUser", "deleteUser", "listJobs", "getJobLogs", "getHealth"];

function methodsIn(out: string): string[] {
	return ALL_METHODS.filter((name) => out.includes(`public async ${name}(`));
}

function captureLogs(): () => string[] {
	const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
	return () => logSpy.mock.calls.map((call) => call.join(" "));
}

afterEach(() => {
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Which client methods are generated
// ---------------------------------------------------------------------------

describe("generateOutputString — endpoint filtering", () => {
	it("generates every endpoint when no filter is given", () => {
		expect(methodsIn(gen(filterDoc()))).toEqual(ALL_METHODS);
	});

	it("generates every endpoint when both lists are empty", () => {
		const out = gen(filterDoc(), { includeEndpoints: [], excludeEndpoints: [] });
		expect(methodsIn(out)).toEqual(ALL_METHODS);
	});

	it("includeEndpoints keeps only matching paths", () => {
		const out = gen(filterDoc(), { includeEndpoints: ["/users/**"] });
		expect(methodsIn(out)).toEqual(["listUsers", "getUser", "deleteUser"]);
	});

	it("includeEndpoints keeps every HTTP method of a matching path", () => {
		const out = gen(filterDoc(), { includeEndpoints: ["/users/{id}"] });
		expect(methodsIn(out)).toEqual(["getUser", "deleteUser"]);
	});

	it("includeEndpoints accepts several patterns", () => {
		const out = gen(filterDoc(), { includeEndpoints: ["/health", "/admin/jobs"] });
		expect(methodsIn(out)).toEqual(["listJobs", "getHealth"]);
	});

	it("excludeEndpoints removes matching paths", () => {
		const out = gen(filterDoc(), { excludeEndpoints: ["/admin/**"] });
		expect(methodsIn(out)).toEqual(["listUsers", "getUser", "deleteUser", "getHealth"]);
	});

	it("single star matches one segment only", () => {
		const out = gen(filterDoc(), { includeEndpoints: ["/admin/*"] });
		expect(methodsIn(out)).toEqual(["listJobs"]);
	});

	it("exclude wins over include", () => {
		const out = gen(filterDoc(), {
			includeEndpoints: ["/users/**", "/admin/**"],
			excludeEndpoints: ["/admin/jobs/*/logs"],
		});
		expect(methodsIn(out)).toEqual(["listUsers", "getUser", "deleteUser", "listJobs"]);
	});

	it("generates an empty client when every endpoint is filtered out", () => {
		const out = gen(filterDoc(), { excludeEndpoints: ["/**"] });
		expect(methodsIn(out)).toEqual([]);
		expect(out).toContain("export class MyApiClient extends ApiClient {");
		expect(out.trimEnd().endsWith("}")).toBe(true);
	});

	it("still honours streamedEndpoints for included endpoints", () => {
		const doc = {
			paths: {
				"/feed": {
					post: {
						operationId: "streamFeed",
						requestBody: {
							content: { "application/json": { schema: { $ref: "#/components/schemas/FeedRequest" } } },
						},
						responses: {
							"200": {
								content: { "application/json": { schema: { $ref: "#/components/schemas/FeedChunk" } } },
							},
						},
					},
				},
				"/health": { get: { operationId: "getHealth", responses: { "200": {} } } },
			},
			components: {
				schemas: {
					FeedRequest: { type: "object", properties: { cursor: { type: "string" } } },
					FeedChunk: { type: "object", properties: { data: { type: "string" } } },
				},
			},
		};
		const out = gen(doc, { includeEndpoints: ["/feed"], streamedEndpoints: ["/feed"] });
		expect(out).toContain("async *streamFeedStream(");
		expect(out).not.toContain("getHealth(");
	});

	it("throws a clear error for an invalid pattern list", () => {
		expect(() => gen(filterDoc(), { includeEndpoints: "/users" as any })).toThrow(
			'"includeEndpoints" must be an array of strings.'
		);
		expect(() => gen(filterDoc(), { excludeEndpoints: [""] })).toThrow(
			'"excludeEndpoints" entry at index 0 must be a non-empty string.'
		);
	});
});

// ---------------------------------------------------------------------------
// Effect on generated types
// ---------------------------------------------------------------------------

describe("generateOutputString — endpoint filtering and component types", () => {
	it("still emits component schemas used only by filtered-out endpoints", () => {
		const out = gen(filterDoc(), { includeEndpoints: ["/health"] });
		expect(out).toContain("export class JobLogsResponse");
		expect(out).toContain("export type TJobLogsResponseDto");
	});

	it("keeps the schema classification of filtered-out endpoints unchanged", () => {
		// a schema used as a request body by an excluded endpoint stays a request type
		const doc = {
			paths: {
				"/users": {
					post: {
						operationId: "createUser",
						requestBody: {
							content: {
								"application/json": { schema: { $ref: "#/components/schemas/CreateUserRequest" } },
							},
						},
						responses: { "201": {} },
					},
				},
				"/health": { get: { operationId: "getHealth", responses: { "200": {} } } },
			},
			components: {
				schemas: {
					CreateUserRequest: { type: "object", properties: { name: { type: "string" } } },
				},
			},
		};
		const out = gen(doc, { excludeEndpoints: ["/users"] });
		expect(out).toContain("export type TCreateUserRequest = {");
		expect(out).not.toContain("export class CreateUserRequest");
		expect(out).not.toContain("createUser(");
	});

	it("does not emit inline form-data request types for filtered-out endpoints", () => {
		const doc = {
			paths: {
				"/upload": {
					post: {
						operationId: "uploadFile",
						requestBody: {
							content: {
								"multipart/form-data": {
									schema: { type: "object", properties: { file: { type: "string", format: "binary" } } },
								},
							},
						},
						responses: { "200": {} },
					},
				},
				"/health": { get: { operationId: "getHealth", responses: { "200": {} } } },
			},
			components: { schemas: {} },
		};
		expect(gen(doc)).toContain("UploadFileFormDataRequest");

		const out = gen(doc, { excludeEndpoints: ["/upload"] });
		expect(out).not.toContain("UploadFileFormDataRequest");
		expect(out).not.toContain("postFormData");
		expect(out).toContain("public async getHealth(");
	});
});

// ---------------------------------------------------------------------------
// Log output
// ---------------------------------------------------------------------------

describe("generateOutputString — endpoint filtering log output", () => {
	it("logs a summary when a filter is active", () => {
		const lines = captureLogs();
		gen(filterDoc(), { includeEndpoints: ["/users/**"] });
		expect(lines().some((line) => line.includes("generating 2 of 5 endpoint paths"))).toBe(true);
	});

	it("logs each skipped endpoint path", () => {
		const lines = captureLogs();
		gen(filterDoc(), { excludeEndpoints: ["/health"] });
		expect(lines().some((line) => line.includes("Skipping filtered endpoint /health"))).toBe(true);
	});

	it("does not log a summary when no filter is active", () => {
		const lines = captureLogs();
		gen(filterDoc());
		expect(lines().some((line) => line.includes("Endpoint filter"))).toBe(false);
	});

	it("warns about include and exclude patterns that match nothing", () => {
		const lines = captureLogs();
		gen(filterDoc(), { includeEndpoints: ["/users", "/userz/**"], excludeEndpoints: ["/nope"] });
		expect(lines().some((line) => line.includes('includeEndpoints pattern "/userz/**" did not match'))).toBe(true);
		expect(lines().some((line) => line.includes('excludeEndpoints pattern "/nope" did not match'))).toBe(true);
		expect(lines().some((line) => line.includes('pattern "/users" did not match'))).toBe(false);
	});

	it("warns when the filter removes every endpoint", () => {
		const lines = captureLogs();
		gen(filterDoc(), { includeEndpoints: ["/nothing"] });
		expect(lines().some((line) => line.includes("excluded every endpoint"))).toBe(true);
	});

	it("does not warn about an empty client when some endpoints remain", () => {
		const lines = captureLogs();
		gen(filterDoc(), { includeEndpoints: ["/health"] });
		expect(lines().some((line) => line.includes("excluded every endpoint"))).toBe(false);
	});
});
