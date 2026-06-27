import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	ApiClient,
	HeaderType,
	EExpectedDataResponseType,
	type TApiRequestOptions,
} from "../../src/ApiClient.js";

// ─── Concrete subclass exposing protected members ────────────────────────────

class TestClient extends ApiClient {
	constructor(baseUrl: string) {
		super(baseUrl);
	}
	public getBasicHeaders() { return this.basicHeaders; }
	public getTransientHeaders() { return this.transientHeaders; }
	public getPersistentHeaders() { return this.persistentHeaders; }
	public async exposeBuildHeaders(options?: TApiRequestOptions) {
		return this.buildHeaders(options);
	}
	public exposeBuildRequestOptions(options?: TApiRequestOptions) {
		return this.buildRequestOptions(options);
	}
	public exposeHandleResponseChunk<T>(chunk: Uint8Array) {
		return this.handleResponseChunk<T>(chunk);
	}
}

// ─── Fetch mock helpers ───────────────────────────────────────────────────────

function makeFetchResponse(
	status: number,
	body: string,
	extraProps: Record<string, unknown> = {}
) {
	const ok = status >= 200 && status < 300;
	return {
		ok,
		status,
		text: vi.fn().mockResolvedValue(body),
		body: null,
		...extraProps,
	} as unknown as Response;
}

function makeStreamResponse(chunks: Uint8Array[], ok = true) {
	let index = 0;
	const reader = {
		read: vi.fn().mockImplementation(async () => {
			if (index < chunks.length) {
				return { done: false, value: chunks[index++] };
			}
			return { done: true, value: undefined };
		}),
	};
	return {
		ok,
		status: ok ? 200 : 500,
		body: { getReader: () => reader },
	} as unknown as Response;
}

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
	mockFetch.mockReset();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

// ─── 1. Constructor & URL Building ───────────────────────────────────────────

describe("ApiClient — constructor & URL building", () => {
	it("appends trailing slash when baseUrl has none", () => {
		const client = new TestClient("https://api.example.com");
		expect(client.baseUrl).toBe("https://api.example.com/");
	});

	it("does not double-append trailing slash when already present", () => {
		const client = new TestClient("https://api.example.com/");
		expect(client.baseUrl).toBe("https://api.example.com/");
	});

	it("handles empty string baseUrl without adding slash", () => {
		const client = new TestClient("");
		expect(client.baseUrl).toBe("");
	});

	it("baseUrl getter returns the stored value", () => {
		const client = new TestClient("https://x.io/");
		expect(client.baseUrl).toBe("https://x.io/");
	});

	it("buildUrl strips leading slash from path", () => {
		const client = new TestClient("https://api.example.com/");
		expect(client.buildUrl("/users/1")).toBe("https://api.example.com/users/1");
	});

	it("buildUrl does not double-slash when path has no leading slash", () => {
		const client = new TestClient("https://api.example.com/");
		expect(client.buildUrl("users/1")).toBe("https://api.example.com/users/1");
	});

	it("buildUrl handles empty path", () => {
		const client = new TestClient("https://api.example.com/");
		expect(client.buildUrl("")).toBe("https://api.example.com/");
	});
});

// ─── 2. Header Management ────────────────────────────────────────────────────

describe("ApiClient — header management", () => {
	it("setHeader stores in transientHeaders by default", () => {
		const client = new TestClient("https://example.com/");
		client.setHeader("X-Foo", "bar");
		expect(client.getTransientHeaders()["X-Foo"]).toBe("bar");
		expect(client.getPersistentHeaders()["X-Foo"]).toBeUndefined();
	});

	it("setHeader with HeaderType.Transient stores in transientHeaders", () => {
		const client = new TestClient("https://example.com/");
		client.setHeader("X-A", "1", HeaderType.Transient);
		expect(client.getTransientHeaders()["X-A"]).toBe("1");
	});

	it("setHeader with HeaderType.Persistent stores in persistentHeaders", () => {
		const client = new TestClient("https://example.com/");
		client.setHeader("X-B", "2", HeaderType.Persistent);
		expect(client.getPersistentHeaders()["X-B"]).toBe("2");
		expect(client.getTransientHeaders()["X-B"]).toBeUndefined();
	});

	it("setHeader throws on invalid HeaderType value", () => {
		const client = new TestClient("https://example.com/");
		expect(() => client.setHeader("X-C", "3", 99 as HeaderType)).toThrow("Invalid header type");
	});

	it("useBearerTokenByDefault true causes buildRequestOptions to set useBearerToken=true", () => {
		const client = new TestClient("https://example.com/");
		client.useBearerTokenByDefault(true);
		const opts = client.exposeBuildRequestOptions({});
		expect(opts.useBearerToken).toBe(true);
	});

	it("useBearerTokenByDefault false leaves useBearerToken false", () => {
		const client = new TestClient("https://example.com/");
		client.useBearerTokenByDefault(false);
		const opts = client.exposeBuildRequestOptions({});
		expect(opts.useBearerToken).toBe(false);
	});
});

// ─── 3. buildRequestOptions ──────────────────────────────────────────────────

describe("ApiClient — buildRequestOptions", () => {
	it("returns sensible defaults when no options provided", () => {
		const client = new TestClient("https://example.com/");
		const opts = client.exposeBuildRequestOptions();
		expect(opts.useBearerToken).toBe(false);
		expect(opts.expectedDataResponseType).toBe(EExpectedDataResponseType.Json);
	});

	it("does NOT override explicitly-set useBearerToken=false even when default is true", () => {
		const client = new TestClient("https://example.com/");
		client.useBearerTokenByDefault(true);
		const opts = client.exposeBuildRequestOptions({ useBearerToken: false });
		expect(opts.useBearerToken).toBe(false);
	});

	it("defaults expectedDataResponseType to Json when not set", () => {
		const client = new TestClient("https://example.com/");
		const opts = client.exposeBuildRequestOptions({});
		expect(opts.expectedDataResponseType).toBe(EExpectedDataResponseType.Json);
	});

	it("throws when expectedDataResponseType is Text", () => {
		const client = new TestClient("https://example.com/");
		expect(() =>
			client.exposeBuildRequestOptions({ expectedDataResponseType: EExpectedDataResponseType.Text })
		).toThrow("Only Json response type is supported.");
	});

	it("throws when expectedDataResponseType is Blob", () => {
		const client = new TestClient("https://example.com/");
		expect(() =>
			client.exposeBuildRequestOptions({ expectedDataResponseType: EExpectedDataResponseType.Blob })
		).toThrow("Only Json response type is supported.");
	});

	it("merges basicHeaders into requestHeaders without overwriting existing keys", () => {
		const client = new TestClient("https://example.com/");
		client.getBasicHeaders()["X-Basic"] = "from-basic";
		const opts = client.exposeBuildRequestOptions({ requestHeaders: { "X-Basic": "from-request" } });
		expect(opts.requestHeaders!["X-Basic"]).toBe("from-request");
	});
});

// ─── 4. buildHeaders ─────────────────────────────────────────────────────────

describe("ApiClient — buildHeaders", () => {
	it("includes basicHeaders in returned headers", async () => {
		const client = new TestClient("https://example.com/");
		client.getBasicHeaders()["X-Basic"] = "yes";
		const headers = await client.exposeBuildHeaders({});
		expect(headers["X-Basic"]).toBe("yes");
	});

	it("appends Bearer token when useBearerToken=true", async () => {
		const client = new TestClient("https://example.com/");
		client.useBearerTokenProvider(async () => "my-token");
		const headers = await client.exposeBuildHeaders({ useBearerToken: true });
		expect(headers["Authorization"]).toBe("Bearer my-token");
	});

	it("throws when useBearerToken=true but no provider set", async () => {
		const client = new TestClient("https://example.com/");
		await expect(client.exposeBuildHeaders({ useBearerToken: true })).rejects.toThrow(
			"Bearer token is not provided"
		);
	});

	it("throws when useBearerToken=true and provider returns empty string", async () => {
		const client = new TestClient("https://example.com/");
		client.useBearerTokenProvider(async () => "");
		await expect(client.exposeBuildHeaders({ useBearerToken: true })).rejects.toThrow(
			"Bearer token is not provided"
		);
	});

	it("requestHeaders key wins over transientHeader key", async () => {
		const client = new TestClient("https://example.com/");
		client.setHeader("X-Foo", "transient", HeaderType.Transient);
		const headers = await client.exposeBuildHeaders({ requestHeaders: { "X-Foo": "request" } });
		expect(headers["X-Foo"]).toBe("request");
	});

	it("requestHeaders key wins over persistentHeader key", async () => {
		const client = new TestClient("https://example.com/");
		client.setHeader("X-Foo", "persistent", HeaderType.Persistent);
		const headers = await client.exposeBuildHeaders({ requestHeaders: { "X-Foo": "request" } });
		expect(headers["X-Foo"]).toBe("request");
	});

	it("clears transientHeaders after building", async () => {
		const client = new TestClient("https://example.com/");
		client.setHeader("X-Transient", "gone");
		await client.exposeBuildHeaders({});
		const headers2 = await client.exposeBuildHeaders({});
		expect(headers2["X-Transient"]).toBeUndefined();
	});

	it("does NOT clear persistentHeaders after building", async () => {
		const client = new TestClient("https://example.com/");
		client.setHeader("X-Persist", "stays", HeaderType.Persistent);
		await client.exposeBuildHeaders({});
		const headers2 = await client.exposeBuildHeaders({});
		expect(headers2["X-Persist"]).toBe("stays");
	});
});

// ─── 5. get() ────────────────────────────────────────────────────────────────

describe("ApiClient — get()", () => {
	it("returns parsed JSON data on 200 OK", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, '{"id":1}'));
		const { data, response } = await client.get<{ id: number }>("users/1");
		expect(data).toEqual({ id: 1 });
		expect(response.ok).toBe(true);
	});

	it("returns undefined data when response body is empty", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, ""));
		const { data } = await client.get("users/1");
		expect(data).toBeUndefined();
	});

	it("returns undefined data on non-OK status", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(404, "not found"));
		const { data, response } = await client.get("users/1");
		expect(data).toBeUndefined();
		expect(response.ok).toBe(false);
	});

	it("skips JSON parsing when skipJsonParsing=true", async () => {
		const client = new TestClient("https://api.example.com/");
		const mockResp = makeFetchResponse(200, '{"id":1}');
		mockFetch.mockResolvedValue(mockResp);
		const { data } = await client.get("users/1", { skipJsonParsing: true });
		expect(data).toBeUndefined();
		expect((mockResp as any).text).not.toHaveBeenCalled();
	});

	it("calls fetch with method GET", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.get("test");
		expect(mockFetch).toHaveBeenCalledWith(
			"https://api.example.com/test",
			expect.objectContaining({ method: "GET" })
		);
	});

	it("builds the correct URL", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.get("/items/42");
		expect(mockFetch.mock.calls[0][0]).toBe("https://api.example.com/items/42");
	});
});

// ─── 6. post() ───────────────────────────────────────────────────────────────

describe("ApiClient — post()", () => {
	it("sends body as JSON string", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.post("items", { name: "test" });
		const callArgs = mockFetch.mock.calls[0][1];
		expect(callArgs.body).toBe(JSON.stringify({ name: "test" }));
	});

	it("sends empty object JSON when body is null", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.post("items", null);
		expect(mockFetch.mock.calls[0][1].body).toBe("{}");
	});

	it("sends empty object JSON when body is undefined", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.post("items", undefined);
		expect(mockFetch.mock.calls[0][1].body).toBe("{}");
	});

	it("sets Content-Type application/json when not already set", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.post("items", {});
		expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBe("application/json");
	});

	it("does NOT override existing Content-Type header", async () => {
		const client = new TestClient("https://api.example.com/");
		client.setHeader("Content-Type", "text/plain");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.post("items", {});
		expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBe("text/plain");
	});

	it("returns parsed JSON data on 200 OK", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, '{"created":true}'));
		const { data } = await client.post<{ created: boolean }>("items", {});
		expect(data).toEqual({ created: true });
	});

	it("returns undefined data on non-OK response", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(400, '{"error":"bad"}'));
		const { data } = await client.post("items", {});
		expect(data).toBeUndefined();
	});

	it("skips JSON parsing when skipJsonParsing=true", async () => {
		const client = new TestClient("https://api.example.com/");
		const mockResp = makeFetchResponse(200, '{"id":1}');
		mockFetch.mockResolvedValue(mockResp);
		const { data } = await client.post("items", {}, { skipJsonParsing: true });
		expect(data).toBeUndefined();
		expect((mockResp as any).text).not.toHaveBeenCalled();
	});

	it("calls fetch with method POST", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.post("items", {});
		expect(mockFetch.mock.calls[0][1].method).toBe("POST");
	});
});

// ─── 7. postFormData() ───────────────────────────────────────────────────────

describe("ApiClient — postFormData()", () => {
	it("calls fetch with method POST", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.postFormData("upload", new FormData());
		expect(mockFetch.mock.calls[0][1].method).toBe("POST");
	});

	it("sends FormData as body", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		const fd = new FormData();
		await client.postFormData("upload", fd);
		expect(mockFetch.mock.calls[0][1].body).toBe(fd);
	});

	it("does NOT set Content-Type when none is configured (lets fetch add the multipart boundary)", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.postFormData("upload", new FormData());
		expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
	});

	it("deletes a configured Content-Type header (to allow browser multipart boundary)", async () => {
		const client = new TestClient("https://api.example.com/");
		client.setHeader("Content-Type", "application/json");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.postFormData("upload", new FormData());
		expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
	});

	it("deletes a persistent Content-Type header (to allow browser multipart boundary)", async () => {
		const client = new TestClient("https://api.example.com/");
		client.setHeader("Content-Type", "application/json", HeaderType.Persistent);
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.postFormData("upload", new FormData());
		expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
	});

	it("returns parsed JSON on OK response", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, '{"ok":true}'));
		const { data } = await client.postFormData<{ ok: boolean }>("upload", new FormData());
		expect(data).toEqual({ ok: true });
	});

	it("returns undefined data on non-OK response", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(400, "error"));
		const { data } = await client.postFormData("upload", new FormData());
		expect(data).toBeUndefined();
	});

	it("skips JSON parsing when skipJsonParsing=true", async () => {
		const client = new TestClient("https://api.example.com/");
		const mockResp = makeFetchResponse(200, '{"id":1}');
		mockFetch.mockResolvedValue(mockResp);
		await client.postFormData("upload", new FormData(), { skipJsonParsing: true });
		expect((mockResp as any).text).not.toHaveBeenCalled();
	});
});

// ─── 8. put() ────────────────────────────────────────────────────────────────

describe("ApiClient — put()", () => {
	it("calls fetch with method PUT", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.put("items/1", { name: "x" });
		expect(mockFetch.mock.calls[0][1].method).toBe("PUT");
	});

	it("sends body as JSON", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.put("items/1", { x: 1 });
		expect(mockFetch.mock.calls[0][1].body).toBe(JSON.stringify({ x: 1 }));
	});

	it("sends empty object when body is null", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.put("items/1", null);
		expect(mockFetch.mock.calls[0][1].body).toBe("{}");
	});

	it("sets Content-Type application/json", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.put("items/1", {});
		expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBe("application/json");
	});

	it("does NOT override existing Content-Type", async () => {
		const client = new TestClient("https://api.example.com/");
		client.setHeader("Content-Type", "text/plain");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.put("items/1", {});
		expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBe("text/plain");
	});

	it("returns parsed data on OK", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, '{"updated":true}'));
		const { data } = await client.put<{ updated: boolean }>("items/1", {});
		expect(data).toEqual({ updated: true });
	});

	it("returns undefined data on non-OK", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(404, ""));
		const { data } = await client.put("items/1", {});
		expect(data).toBeUndefined();
	});
});

// ─── 9. patch() ──────────────────────────────────────────────────────────────

describe("ApiClient — patch()", () => {
	it("calls fetch with method PATCH", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.patch("items/1", { name: "x" });
		expect(mockFetch.mock.calls[0][1].method).toBe("PATCH");
	});

	it("sends body as JSON", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.patch("items/1", { partial: true });
		expect(mockFetch.mock.calls[0][1].body).toBe(JSON.stringify({ partial: true }));
	});

	it("sends empty object when body is null", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.patch("items/1", null);
		expect(mockFetch.mock.calls[0][1].body).toBe("{}");
	});

	it("sets Content-Type application/json", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.patch("items/1", {});
		expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBe("application/json");
	});

	it("returns parsed data on OK", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, '{"patched":true}'));
		const { data } = await client.patch<{ patched: boolean }>("items/1", {});
		expect(data).toEqual({ patched: true });
	});

	it("returns undefined data on non-OK", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(422, ""));
		const { data } = await client.patch("items/1", {});
		expect(data).toBeUndefined();
	});
});

// ─── 10. delete() ────────────────────────────────────────────────────────────

describe("ApiClient — delete()", () => {
	it("calls fetch with method DELETE", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.delete("items/1");
		expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
	});

	it("sets Content-Type when body is provided", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.delete("items/1", { id: 1 });
		expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBe("application/json");
	});

	it("does NOT set Content-Type when body is absent", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.delete("items/1");
		expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
	});

	it("sends body as JSON when provided", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.delete("items/1", { reason: "test" });
		expect(mockFetch.mock.calls[0][1].body).toBe(JSON.stringify({ reason: "test" }));
	});

	it("sends no body when body is undefined", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, "{}"));
		await client.delete("items/1");
		expect(mockFetch.mock.calls[0][1].body).toBeUndefined();
	});

	it("parses response JSON even on non-OK status (no early return guard)", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(400, '{"error":"bad"}'));
		const { data } = await client.delete<{ error: string }>("items/1");
		expect(data).toEqual({ error: "bad" });
	});

	it("returns undefined data when response body is empty", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeFetchResponse(200, ""));
		const { data } = await client.delete("items/1");
		expect(data).toBeUndefined();
	});

	it("skips JSON parsing when skipJsonParsing=true", async () => {
		const client = new TestClient("https://api.example.com/");
		const mockResp = makeFetchResponse(200, '{"id":1}');
		mockFetch.mockResolvedValue(mockResp);
		await client.delete("items/1", undefined, { skipJsonParsing: true });
		expect((mockResp as any).text).not.toHaveBeenCalled();
	});
});

// ─── 11. getRawIterable() ────────────────────────────────────────────────────

describe("ApiClient — getRawIterable()", () => {
	it("yields Uint8Array chunks from a readable stream", async () => {
		const client = new TestClient("https://api.example.com/");
		const chunk1 = new Uint8Array([1, 2]);
		const chunk2 = new Uint8Array([3, 4]);
		mockFetch.mockResolvedValue(makeStreamResponse([chunk1, chunk2]));
		const chunks: Uint8Array[] = [];
		for await (const c of client.getRawIterable("stream")) {
			chunks.push(c);
		}
		expect(chunks).toEqual([chunk1, chunk2]);
	});

	it("stops after done=true from the reader", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([new Uint8Array([1])]));
		let count = 0;
		for await (const _ of client.getRawIterable("stream")) { count++; }
		expect(count).toBe(1);
	});

	it("returns early (yields nothing) when response is not OK", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([], false));
		const chunks: Uint8Array[] = [];
		for await (const c of client.getRawIterable("stream")) { chunks.push(c); }
		expect(chunks).toHaveLength(0);
	});

	it("throws when response.body is null on an OK response", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue({ ok: true, status: 200, body: null } as unknown as Response);
		const gen = client.getRawIterable("stream");
		await expect(gen.next()).rejects.toThrow("Response body is null");
	});

	it("calls fetch with method GET", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([]));
		for await (const _ of client.getRawIterable("stream")) { /* drain */ }
		expect(mockFetch.mock.calls[0][1].method).toBe("GET");
	});
});

// ─── 12. postRawIterable() ───────────────────────────────────────────────────

describe("ApiClient — postRawIterable()", () => {
	it("yields chunks on OK streamed response", async () => {
		const client = new TestClient("https://api.example.com/");
		const chunk = new Uint8Array([9]);
		mockFetch.mockResolvedValue(makeStreamResponse([chunk]));
		const result: Uint8Array[] = [];
		for await (const c of client.postRawIterable("stream", {})) { result.push(c); }
		expect(result).toEqual([chunk]);
	});

	it("throws when response.body is null (checked before ok check)", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue({ ok: true, status: 200, body: null } as unknown as Response);
		const gen = client.postRawIterable("stream", {});
		await expect(gen.next()).rejects.toThrow("Response body is null");
	});

	it("returns early when response is not OK", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([], false));
		const chunks: Uint8Array[] = [];
		for await (const c of client.postRawIterable("stream", {})) { chunks.push(c); }
		expect(chunks).toHaveLength(0);
	});

	it("sets Content-Type application/json", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([]));
		for await (const _ of client.postRawIterable("s", {})) { /* drain */ }
		expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBe("application/json");
	});

	it("serialises body to JSON string", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([]));
		for await (const _ of client.postRawIterable("s", { q: 1 })) { /* drain */ }
		expect(mockFetch.mock.calls[0][1].body).toBe(JSON.stringify({ q: 1 }));
	});

	it("calls fetch with method POST", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([]));
		for await (const _ of client.postRawIterable("s", {})) { /* drain */ }
		expect(mockFetch.mock.calls[0][1].method).toBe("POST");
	});
});

// ─── 13-15. put/patch/deleteRawIterable() ────────────────────────────────────

describe("ApiClient — putRawIterable()", () => {
	it("calls fetch with method PUT", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([]));
		for await (const _ of client.putRawIterable("s", {})) { /* drain */ }
		expect(mockFetch.mock.calls[0][1].method).toBe("PUT");
	});

	it("throws when response.body is null after ok check", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue({ ok: true, status: 200, body: null } as unknown as Response);
		const gen = client.putRawIterable("s", {});
		await expect(gen.next()).rejects.toThrow("Response body is null");
	});

	it("returns early when response.ok is false", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([], false));
		const chunks: Uint8Array[] = [];
		for await (const c of client.putRawIterable("s", {})) { chunks.push(c); }
		expect(chunks).toHaveLength(0);
	});
});

describe("ApiClient — patchRawIterable()", () => {
	it("calls fetch with method PATCH", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([]));
		for await (const _ of client.patchRawIterable("s", {})) { /* drain */ }
		expect(mockFetch.mock.calls[0][1].method).toBe("PATCH");
	});

	it("throws when response.body is null", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue({ ok: true, status: 200, body: null } as unknown as Response);
		const gen = client.patchRawIterable("s", {});
		await expect(gen.next()).rejects.toThrow("Response body is null");
	});
});

describe("ApiClient — deleteRawIterable()", () => {
	it("calls fetch with method DELETE", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([]));
		for await (const _ of client.deleteRawIterable("s")) { /* drain */ }
		expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
	});

	it("always sets Content-Type application/json", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([]));
		for await (const _ of client.deleteRawIterable("s")) { /* drain */ }
		expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBe("application/json");
	});

	it("throws when response.body is null", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue({ ok: true, status: 200, body: null } as unknown as Response);
		const gen = client.deleteRawIterable("s");
		await expect(gen.next()).rejects.toThrow("Response body is null");
	});

	it("returns early when response.ok is false", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([], false));
		const chunks: Uint8Array[] = [];
		for await (const c of client.deleteRawIterable("s")) { chunks.push(c); }
		expect(chunks).toHaveLength(0);
	});
});

// ─── 16. postFormDataRawIterable() ───────────────────────────────────────────

describe("ApiClient — postFormDataRawIterable()", () => {
	it("yields chunks on OK response", async () => {
		const client = new TestClient("https://api.example.com/");
		const chunk = new Uint8Array([5]);
		mockFetch.mockResolvedValue(makeStreamResponse([chunk]));
		const result: Uint8Array[] = [];
		for await (const c of client.postFormDataRawIterable("s", new FormData())) { result.push(c); }
		expect(result).toEqual([chunk]);
	});

	it("throws when response.body is null (checked before ok check)", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue({ ok: true, status: 200, body: null } as unknown as Response);
		const gen = client.postFormDataRawIterable("s", new FormData());
		await expect(gen.next()).rejects.toThrow("Response body is null");
	});

	it("deletes Content-Type header (to allow browser multipart boundary)", async () => {
		const client = new TestClient("https://api.example.com/");
		client.setHeader("Content-Type", "application/json");
		mockFetch.mockResolvedValue(makeStreamResponse([]));
		for await (const _ of client.postFormDataRawIterable("s", new FormData())) { /* drain */ }
		expect(mockFetch.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
	});

	it("sends FormData as body", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([]));
		const fd = new FormData();
		for await (const _ of client.postFormDataRawIterable("s", fd)) { /* drain */ }
		expect(mockFetch.mock.calls[0][1].body).toBe(fd);
	});

	it("returns early when response.ok is false", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([], false));
		const chunks: Uint8Array[] = [];
		for await (const c of client.postFormDataRawIterable("s", new FormData())) { chunks.push(c); }
		expect(chunks).toHaveLength(0);
	});
});

// ─── 17. handleResponseChunk() ───────────────────────────────────────────────

describe("ApiClient — handleResponseChunk()", () => {
	function makeChunk(text: string): Uint8Array {
		return new TextEncoder().encode(text);
	}

	it("parses JSON from line index 2 of the chunk", () => {
		const client = new TestClient("https://api.example.com/");
		const text = "event: update\nid: 1\ndata: {\"value\":42}\n";
		const result = client.exposeHandleResponseChunk<{ value: number }>(makeChunk(text));
		expect(result).toEqual({ value: 42 });
	});

	it('strips everything before the first "{" on line 2', () => {
		const client = new TestClient("https://api.example.com/");
		const text = "line0\nline1\ndata: {\"x\":1}\n";
		const result = client.exposeHandleResponseChunk<{ x: number }>(makeChunk(text));
		expect(result.x).toBe(1);
	});

	it("throws when decoded text is empty", () => {
		const client = new TestClient("https://api.example.com/");
		expect(() => client.exposeHandleResponseChunk(new Uint8Array())).toThrow("Response body is null");
	});

	it("throws when chunk has fewer than 3 lines", () => {
		const client = new TestClient("https://api.example.com/");
		expect(() =>
			client.exposeHandleResponseChunk(makeChunk("line0\nline1"))
		).toThrow("Streamed response chunk is not valid.");
	});

	it("throws when line 2 is empty", () => {
		const client = new TestClient("https://api.example.com/");
		expect(() =>
			client.exposeHandleResponseChunk(makeChunk("line0\nline1\n\n"))
		).toThrow("Streamed response chunk is not valid.");
	});

	it("throws when line 2 contains no '{'", () => {
		const client = new TestClient("https://api.example.com/");
		expect(() =>
			client.exposeHandleResponseChunk(makeChunk("line0\nline1\nno-json-here\n"))
		).toThrow(SyntaxError);
	});
});

// ─── 18. High-level iterables ────────────────────────────────────────────────

describe("ApiClient — high-level iterables", () => {
	function validChunk(payload: object): Uint8Array {
		const text = `event: msg\nid: 1\ndata: ${JSON.stringify(payload)}\n`;
		return new TextEncoder().encode(text);
	}

	it("getIterable delegates to getRawIterable and parses chunks", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([validChunk({ n: 1 })]));
		const items: { n: number }[] = [];
		for await (const item of client.getIterable<{ n: number }>("s")) { items.push(item); }
		expect(items).toEqual([{ n: 1 }]);
	});

	it("postIterable parses chunks", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([validChunk({ n: 2 })]));
		const items: { n: number }[] = [];
		for await (const item of client.postIterable<{ n: number }>("s", {})) { items.push(item); }
		expect(items).toEqual([{ n: 2 }]);
	});

	it("putIterable parses chunks", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([validChunk({ n: 3 })]));
		const items: { n: number }[] = [];
		for await (const item of client.putIterable<{ n: number }>("s", {})) { items.push(item); }
		expect(items).toEqual([{ n: 3 }]);
	});

	it("patchIterable parses chunks", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([validChunk({ n: 4 })]));
		const items: { n: number }[] = [];
		for await (const item of client.patchIterable<{ n: number }>("s", {})) { items.push(item); }
		expect(items).toEqual([{ n: 4 }]);
	});

	it("deleteIterable parses chunks", async () => {
		const client = new TestClient("https://api.example.com/");
		mockFetch.mockResolvedValue(makeStreamResponse([validChunk({ n: 5 })]));
		const items: { n: number }[] = [];
		for await (const item of client.deleteIterable<{ n: number }>("s")) { items.push(item); }
		expect(items).toEqual([{ n: 5 }]);
	});
});
