import { describe, it, expect } from "vitest";
import { stripUrlChars, splitAtUrlChars } from "../../generator/Generator.js";

describe("splitAtUrlChars", () => {
	it("splits on forward slash", () => {
		expect(splitAtUrlChars("/api/users")).toEqual(["", "api", "users"]);
	});

	it("splits on hyphen", () => {
		expect(splitAtUrlChars("create-user")).toEqual(["create", "user"]);
	});

	it("splits on underscore", () => {
		expect(splitAtUrlChars("create_user")).toEqual(["create", "user"]);
	});

	it("splits on opening curly brace", () => {
		const parts = splitAtUrlChars("{userId}");
		expect(parts).toContain("userId");
	});

	it("does not split on alphanumeric characters", () => {
		expect(splitAtUrlChars("createUser")).toEqual(["createUser"]);
	});

	it("splits on period", () => {
		expect(splitAtUrlChars("api.v2")).toEqual(["api", "v2"]);
	});
});

describe("stripUrlChars", () => {
	it("capitalizes first character of each segment and joins", () => {
		expect(stripUrlChars("api/users/list")).toBe("ApiUsersList");
	});

	it("handles dashes between words", () => {
		expect(stripUrlChars("create-user-request")).toBe("CreateUserRequest");
	});

	it("handles underscores between words", () => {
		expect(stripUrlChars("get_all_items")).toBe("GetAllItems");
	});

	it("handles path params in curly braces", () => {
		// {userId} splits into ["", "userId", ""] — empty segments produce empty strings
		const result = stripUrlChars("users/{userId}");
		expect(result).toContain("UserId");
	});

	it("single word is just capitalised", () => {
		expect(stripUrlChars("users")).toBe("Users");
	});

	it("already-capitalised input stays capitalised", () => {
		expect(stripUrlChars("Users")).toBe("Users");
	});
});
