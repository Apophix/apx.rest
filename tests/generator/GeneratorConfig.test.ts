import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { Generator } from "../../generator/Generator.js";

// End-to-end: apx-rest-config.json on disk → Generator.generate() → client file on disk.
// Uses a local OpenAPI file so no network access is needed.

const openApiDoc = {
	paths: {
		"/users": { get: { operationId: "listUsers", responses: { "200": {} } } },
		"/users/{id}": { get: { operationId: "getUser", responses: { "200": {} } } },
		"/internal/metrics": { get: { operationId: "getMetrics", responses: { "200": {} } } },
	},
	components: { schemas: {} },
};

let workDir: string;

async function runWithConfig(apiConfig: Record<string, any>): Promise<string> {
	await fs.writeFile(path.join(workDir, "openapi.json"), JSON.stringify(openApiDoc));
	await fs.writeFile(
		path.join(workDir, "apx-rest-config.json"),
		JSON.stringify({
			apis: [
				{
					openApiJsonDocumentUrl: "openapi.json",
					clientName: "TestClient",
					clientBaseUrlValue: "https://api.example.com",
					outputBaseDirectory: "out",
					...apiConfig,
				},
			],
		})
	);
	await new Generator().generate();
	return fs.readFile(path.join(workDir, "out", "TestClient.ts"), { encoding: "utf-8" });
}

beforeEach(async () => {
	workDir = await fs.mkdtemp(path.join(os.tmpdir(), "apx-rest-filter-"));
	vi.spyOn(process, "cwd").mockReturnValue(workDir);
	vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(async () => {
	vi.restoreAllMocks();
	await fs.rm(workDir, { recursive: true, force: true });
});

describe("Generator.generate() — endpoint filter config", () => {
	it("generates every endpoint when the config has no filter keys", async () => {
		const out = await runWithConfig({});
		expect(out).toContain("public async listUsers(");
		expect(out).toContain("public async getUser(");
		expect(out).toContain("public async getMetrics(");
	});

	it("reads includeEndpoints from apx-rest-config.json", async () => {
		const out = await runWithConfig({ includeEndpoints: ["/users/**"] });
		expect(out).toContain("public async listUsers(");
		expect(out).toContain("public async getUser(");
		expect(out).not.toContain("getMetrics(");
	});

	it("reads excludeEndpoints from apx-rest-config.json", async () => {
		const out = await runWithConfig({ excludeEndpoints: ["/internal/**"] });
		expect(out).toContain("public async listUsers(");
		expect(out).not.toContain("getMetrics(");
	});

	it("applies include and exclude together", async () => {
		const out = await runWithConfig({
			includeEndpoints: ["/users/**"],
			excludeEndpoints: ["/users/{id}"],
		});
		expect(out).toContain("public async listUsers(");
		expect(out).not.toContain("getUser(");
		expect(out).not.toContain("getMetrics(");
	});

	it("rejects an invalid includeEndpoints value before it reads the document", async () => {
		const readFileSpy = vi.spyOn(fs, "readFile");
		await expect(runWithConfig({ includeEndpoints: "/users" })).rejects.toThrow(
			'"includeEndpoints" must be an array of strings.'
		);
		const documentReads = readFileSpy.mock.calls.filter(([file]) => String(file).endsWith("openapi.json"));
		expect(documentReads).toHaveLength(0);
	});

	it("splits one document into several clients with per-entry filters", async () => {
		await fs.writeFile(path.join(workDir, "openapi.json"), JSON.stringify(openApiDoc));
		const entry = (clientName: string, includeEndpoints: string[]) => ({
			openApiJsonDocumentUrl: "openapi.json",
			clientName,
			clientBaseUrlValue: "https://api.example.com",
			outputBaseDirectory: "out",
			includeEndpoints,
		});
		await fs.writeFile(
			path.join(workDir, "apx-rest-config.json"),
			JSON.stringify({
				apis: [entry("UsersClient", ["/users/**"]), entry("InternalClient", ["/internal/**"])],
			})
		);

		await new Generator().generate();

		const users = await fs.readFile(path.join(workDir, "out", "UsersClient.ts"), { encoding: "utf-8" });
		const internal = await fs.readFile(path.join(workDir, "out", "InternalClient.ts"), { encoding: "utf-8" });
		expect(users).toContain("export class UsersClient extends ApiClient");
		expect(users).toContain("public async listUsers(");
		expect(users).not.toContain("getMetrics(");
		expect(internal).toContain("export class InternalClient extends ApiClient");
		expect(internal).toContain("public async getMetrics(");
		expect(internal).not.toContain("listUsers(");
	});

	it("rejects an invalid excludeEndpoints entry", async () => {
		await expect(runWithConfig({ excludeEndpoints: [42] })).rejects.toThrow(
			'"excludeEndpoints" entry at index 0 must be a non-empty string.'
		);
	});
});
