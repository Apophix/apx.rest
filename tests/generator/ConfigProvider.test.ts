import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigProvider } from "../../generator/ConfigProvider.js";

// ─── Mock fs/promises ─────────────────────────────────────────────────────────

vi.mock("fs/promises", () => ({
	default: {
		access: vi.fn(),
		readFile: vi.fn(),
	},
}));

import fs from "fs/promises";
const mockAccess = fs.access as ReturnType<typeof vi.fn>;
const mockReadFile = fs.readFile as ReturnType<typeof vi.fn>;

function validConfigFile(apis: Record<string, any>[]) {
	return JSON.stringify({ apis });
}

beforeEach(() => {
	vi.resetAllMocks();
	vi.spyOn(process, "cwd").mockReturnValue("/fake/cwd");
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ─── getUserApiConfigs ────────────────────────────────────────────────────────

describe("ConfigProvider — getUserApiConfigs()", () => {
	it("returns null when config file does not exist", async () => {
		mockAccess.mockRejectedValue(new Error("ENOENT"));
		const provider = new ConfigProvider();
		const result = await provider.getUserApiConfigs();
		expect(result).toBeNull();
	});

	it("returns null when apis array is empty", async () => {
		mockAccess.mockResolvedValue(undefined);
		mockReadFile.mockResolvedValue(JSON.stringify({ apis: [] }));
		const provider = new ConfigProvider();
		const result = await provider.getUserApiConfigs();
		expect(result).toBeNull();
	});

	it("returns parsed api array on valid file", async () => {
		const apis = [{ clientName: "MyClient" }, { clientName: "OtherClient" }];
		mockAccess.mockResolvedValue(undefined);
		mockReadFile.mockResolvedValue(validConfigFile(apis));
		const provider = new ConfigProvider();
		const result = await provider.getUserApiConfigs();
		expect(result).toHaveLength(2);
		expect(result![0].clientName).toBe("MyClient");
	});

	it("reads from process.cwd() + apx-rest-config.json", async () => {
		mockAccess.mockResolvedValue(undefined);
		mockReadFile.mockResolvedValue(validConfigFile([{ clientName: "X" }]));
		const provider = new ConfigProvider();
		await provider.getUserApiConfigs();
		expect(mockReadFile).toHaveBeenCalledWith(
			expect.stringContaining("apx-rest-config.json"),
			expect.anything()
		);
		expect(mockReadFile.mock.calls[0][0]).toContain("fake");
		expect(mockReadFile.mock.calls[0][0]).toContain("cwd");
	});

	it("caches result — readFile called only once on second call", async () => {
		mockAccess.mockResolvedValue(undefined);
		mockReadFile.mockResolvedValue(validConfigFile([{ clientName: "X" }]));
		const provider = new ConfigProvider();
		await provider.getUserApiConfigs();
		await provider.getUserApiConfigs();
		expect(mockReadFile).toHaveBeenCalledTimes(1);
	});
});

// ─── getNumberOfUserConfigs ───────────────────────────────────────────────────

describe("ConfigProvider — getNumberOfUserConfigs()", () => {
	it("returns 0 when getUserApiConfigs returns null", async () => {
		mockAccess.mockRejectedValue(new Error("ENOENT"));
		const provider = new ConfigProvider();
		expect(await provider.getNumberOfUserConfigs()).toBe(0);
	});

	it("returns correct count from array", async () => {
		mockAccess.mockResolvedValue(undefined);
		mockReadFile.mockResolvedValue(validConfigFile([{}, {}, {}]));
		const provider = new ConfigProvider();
		expect(await provider.getNumberOfUserConfigs()).toBe(3);
	});
});

// ─── getValue ────────────────────────────────────────────────────────────────

describe("ConfigProvider — getValue()", () => {
	it("returns value from user config when key exists in both", async () => {
		mockAccess.mockResolvedValue(undefined);
		// default config has outputBaseDirectory = "src/clients"; user overrides it
		mockReadFile.mockResolvedValue(validConfigFile([{ outputBaseDirectory: "generated", clientName: "Client", clientBaseUrlValue: "http://x.com", openApiJsonDocumentUrl: "http://x.com/swagger" }]));
		const provider = new ConfigProvider();
		await provider.preload();
		const val = await provider.getValue("outputBaseDirectory");
		expect(val).toBe("generated");
	});

	it("returns default config value when key is missing in user config", async () => {
		mockAccess.mockResolvedValue(undefined);
		// user config does not have outputBaseDirectory — should fall back to default "src/clients"
		mockReadFile.mockResolvedValue(validConfigFile([{ clientName: "Client", clientBaseUrlValue: "http://x.com", openApiJsonDocumentUrl: "http://x.com/swagger" }]));
		const provider = new ConfigProvider();
		await provider.preload();
		const val = await provider.getValue("outputBaseDirectory");
		expect(val).toBe("src/clients");
	});

	it("throws when key not found in either config", async () => {
		mockAccess.mockResolvedValue(undefined);
		mockReadFile.mockResolvedValue(validConfigFile([{ clientName: "X" }]));
		const provider = new ConfigProvider();
		await provider.preload();
		await expect(provider.getValue("nonExistentKey")).rejects.toThrow("Config key nonExistentKey not found.");
	});

	it("uses correct apiIndex when multiple apis configured", async () => {
		mockAccess.mockResolvedValue(undefined);
		mockReadFile.mockResolvedValue(
			validConfigFile([
				{ clientName: "FirstClient" },
				{ clientName: "SecondClient" },
			])
		);
		const provider = new ConfigProvider();
		provider.apiIndex = 1;
		await provider.preload();
		const val = await provider.getValue("clientName");
		expect(val).toBe("SecondClient");
	});
});
